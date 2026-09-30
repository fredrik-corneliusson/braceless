import { JavaSyntaxNode, SourceRange } from './javaParser';

const INDENT = '    ';

function descendants(node: JavaSyntaxNode, kind: JavaSyntaxNode['kind']): JavaSyntaxNode[] {
  return node.children.flatMap((child) => [
    ...(child.kind === kind ? [child] : []),
    ...descendants(child, kind),
  ]);
}

function nodeAt(node: JavaSyntaxNode, range: SourceRange): JavaSyntaxNode | undefined {
  if (node.startOffset === range.startOffset && node.endOffset === range.endOffset) {
    return node;
  }
  return node.children.find((child) =>
    child.startOffset <= range.startOffset && child.endOffset >= range.endOffset &&
    nodeAt(child, range) !== undefined);
}

function unwrap(node: JavaSyntaxNode): JavaSyntaxNode {
  if (node.kind !== 'other' && node.kind !== 'statement') {
    return node;
  }
  return node.children.length === 1 ? unwrap(node.children[0]) : node;
}

function raw(source: string, range: SourceRange, indent: string): string {
  const fragment = source.slice(range.startOffset, range.endOffset);
  const lines = fragment.trim().split(/\r?\n/);
  const firstOffset = range.startOffset + fragment.search(/\S/);
  const lineStart = source.lastIndexOf('\n', firstOffset - 1) + 1;
  const prefix = source.slice(lineStart, firstOffset);
  const margin = /^\s*$/.test(prefix) ? prefix.length : 0;
  return lines.map((line, index) => {
    const leading = line.match(/^\s*/)?.[0].length ?? 0;
    return indent + line.slice(index === 0 ? 0 : Math.min(margin, leading)).trimEnd();
  }).join('\n');
}

function renderStatement(source: string, statement: JavaSyntaxNode, indent: string): string {
  const node = unwrap(statement);
  if ((node.kind === 'if' || node.kind === 'foreach' || node.kind === 'while') &&
      node.condition && node.branches?.length) {
    const condition = source.slice(node.condition.startOffset, node.condition.endOffset).trim();
    const renderBranch = (branch: SourceRange): string => {
      const branchNode = nodeAt(node, branch);
      if (!branchNode) {
        return raw(source, branch, indent + INDENT);
      }
      const body = unwrap(branchNode);
      return body.kind === 'block'
        ? renderBlock(source, body, indent + INDENT)
        : renderStatement(source, branchNode, indent + INDENT);
    };
    const keyword = node.kind === 'foreach' ? 'for' : node.kind;
    let result = `${indent}${keyword} ${condition}:\n${renderBranch(node.branches[0])}`;
    if (node.kind === 'if' && node.branches[1]) {
      result += `\n${indent}else:\n${renderBranch(node.branches[1])}`;
    }
    return result;
  }
  if (node.kind === 'return' || node.kind === 'expression' || node.kind === 'variable') {
    return indent + source.slice(node.startOffset, node.endOffset).trim().replace(/;$/, '');
  }
  if (node.kind === 'block') {
    return renderBlock(source, node, indent);
  }
  // Unsupported syntax, including basic for and do loops, stays in Java form.
  return raw(source, statement, indent);
}

function renderBlock(source: string, block: JavaSyntaxNode, indent: string): string {
  const statements: JavaSyntaxNode[] = [];
  const collect = (node: JavaSyntaxNode): void => {
    for (const child of node.children) {
      if (child.kind === 'statement') statements.push(child);
      else if (child.kind !== 'block') collect(child);
    }
  };
  collect(block);
  statements.sort((a, b) => a.startOffset - b.startOffset);
  const lines: string[] = [];
  let cursor = block.startOffset + 1;
  for (const statement of statements) {
    const gap = source.slice(cursor, statement.startOffset);
    if (gap.trim()) {
      lines.push(raw(source, { startOffset: cursor, endOffset: statement.startOffset }, indent));
    }
    lines.push(renderStatement(source, statement, indent));
    cursor = statement.endOffset;
  }
  const gap = source.slice(cursor, block.endOffset - 1);
  if (gap.trim()) {
    lines.push(raw(source, { startOffset: cursor, endOffset: block.endOffset - 1 }, indent));
  }
  return lines.join('\n');
}

function renderMethod(source: string, method: JavaSyntaxNode): string {
  const block = descendants(method, 'block')[0];
  if (!block) return source.slice(method.startOffset, method.endOffset);
  const lineStart = source.lastIndexOf('\n', method.startOffset - 1) + 1;
  const indent = source.slice(lineStart, method.startOffset).match(/^\s*/)?.[0] ?? '';
  const header = source.slice(method.startOffset, block.startOffset).trimEnd();
  const body = renderBlock(source, block, indent + INDENT);
  return `${header}:${body ? `\n${body}` : ''}`;
}

export function renderPseudo(source: string, tree: JavaSyntaxNode): string {
  const declarations: JavaSyntaxNode[] = [];
  const collectDeclarations = (node: JavaSyntaxNode): void => {
    for (const child of node.children) {
      if (child.kind === 'method' || child.kind === 'field') declarations.push(child);
      else collectDeclarations(child);
    }
  };
  collectDeclarations(tree);
  declarations.sort((a, b) => a.startOffset - b.startOffset);
  let result = '';
  let cursor = 0;
  for (const declaration of declarations) {
    result += source.slice(cursor, declaration.startOffset) +
      (declaration.kind === 'method'
        ? renderMethod(source, declaration)
        : source.slice(declaration.startOffset, declaration.endOffset).replace(/;$/, ''));
    cursor = declaration.endOffset;
  }
  return result + source.slice(cursor);
}
