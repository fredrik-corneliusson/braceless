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
  for (const child of node.children) {
    if (child.startOffset <= range.startOffset && child.endOffset >= range.endOffset) {
      const match = nodeAt(child, range);
      if (match) return match;
    }
  }
  return undefined;
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

function gapLines(source: string, startOffset: number, endOffset: number, indent: string): string[] {
  const gap = source.slice(startOffset, endOffset);
  const parts = gap.split(/\r?\n/);
  const lines: string[] = [];
  let offset = startOffset;
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (part.trim()) {
      lines.push(raw(source, { startOffset: offset, endOffset: offset + part.length }, indent));
    } else if (index > 0 && index < parts.length - 1) {
      lines.push('');
    }
    offset += part.length;
    if (index < parts.length - 1) {
      offset += source.startsWith('\r\n', offset) ? 2 : 1;
    }
  }
  return lines;
}

function renderSwitch(source: string, node: JavaSyntaxNode, indent: string): string {
  if (!node.condition || !node.switchBlock || !node.switchArms?.length) {
    return source.slice(node.startOffset, node.endOffset);
  }
  const selector = source.slice(node.condition.startOffset, node.condition.endOffset).trim();
  const armIndent = indent + INDENT;
  const lines: string[] = [];
  let cursor = node.switchBlock.startOffset + 1;
  for (const arm of node.switchArms) {
    lines.push(...gapLines(source, cursor, arm.startOffset, armIndent));
    if (!arm.body || !arm.bodyKind || !arm.labels.length || arm.bodyKind === 'other') {
      lines.push(raw(source, arm, armIndent));
      cursor = arm.endOffset;
      continue;
    }
    const labels = arm.labels.map((label) => source.slice(label.startOffset, label.endOffset).trim());
    const heading = labels.map((label) => `${armIndent}${label}${arm.separator === 'arrow' ? ' ->' : ':'}`);
    const bodyNode = nodeAt(node, arm.body);
    if (arm.bodyKind === 'expression') {
      heading[heading.length - 1] += ` ${source.slice(arm.body.startOffset, arm.body.endOffset).trim()}`;
    } else {
      const bodyIndent = armIndent + INDENT;
      const body = arm.bodyKind === 'block' && bodyNode
        ? renderBlock(source, bodyNode, bodyIndent)
        : arm.bodyKind === 'statements' && bodyNode
          ? renderStatements(source, bodyNode, arm.body.startOffset, arm.body.endOffset, bodyIndent)
          : raw(source, arm.body, bodyIndent);
      heading.push(body);
    }
    lines.push(...heading);
    cursor = arm.endOffset;
  }
  lines.push(...gapLines(source, cursor, node.switchBlock.endOffset - 1, armIndent));
  return `switch ${selector}:\n${lines.join('\n')}`;
}

function embeddedSwitches(node: JavaSyntaxNode): JavaSyntaxNode[] {
  const switches: JavaSyntaxNode[] = [];
  const collect = (current: JavaSyntaxNode): void => {
    for (const child of current.children) {
      if (child.kind === 'switch') switches.push(child);
      else collect(child);
    }
  };
  collect(node);
  return switches.sort((a, b) => a.startOffset - b.startOffset);
}

function renderTerminated(source: string, node: JavaSyntaxNode, indent: string): string {
  const lineStart = source.lastIndexOf('\n', node.startOffset - 1) + 1;
  const sourceIndent = source.slice(lineStart, node.startOffset).match(/^\s*/)?.[0] ?? '';
  let result = '';
  let cursor = node.startOffset;
  for (const expression of embeddedSwitches(node)) {
    result += source.slice(cursor, expression.startOffset) +
      renderSwitch(source, expression, indent || sourceIndent);
    cursor = expression.endOffset;
  }
  result += source.slice(cursor, node.endOffset);
  return indent + result.trim().replace(/;$/, '');
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
  if (node.kind === 'return' || node.kind === 'yield' || node.kind === 'expression' || node.kind === 'variable') {
    return renderTerminated(source, node, indent);
  }
  if (node.kind === 'block') {
    return renderBlock(source, node, indent);
  }
  // Unsupported syntax, including basic for and do loops, stays in Java form.
  return raw(source, statement, indent);
}

function renderBlock(source: string, block: JavaSyntaxNode, indent: string): string {
  return renderStatements(source, block, block.startOffset + 1, block.endOffset - 1, indent);
}

function renderStatements(
  source: string, container: JavaSyntaxNode, startOffset: number, endOffset: number, indent: string
): string {
  const statements: JavaSyntaxNode[] = [];
  const collect = (node: JavaSyntaxNode): void => {
    for (const child of node.children) {
      if (child.kind === 'statement') statements.push(child);
      else if (child.kind !== 'block') collect(child);
    }
  };
  collect(container);
  statements.sort((a, b) => a.startOffset - b.startOffset);
  const lines: string[] = [];
  let cursor = startOffset;
  for (const statement of statements) {
    lines.push(...gapLines(source, cursor, statement.startOffset, indent));
    lines.push(renderStatement(source, statement, indent));
    cursor = statement.endOffset;
  }
  lines.push(...gapLines(source, cursor, endOffset, indent));
  return lines.join('\n');
}

function renderMethod(source: string, method: JavaSyntaxNode): string {
  const block = descendants(method, 'block')[0];
  if (!block) return source.slice(method.startOffset, method.endOffset);
  const lineStart = source.lastIndexOf('\n', method.startOffset - 1) + 1;
  const indent = source.slice(lineStart, method.startOffset).match(/^\s*/)?.[0] ?? '';
  const header = source.slice(method.startOffset, block.startOffset).trimEnd();
  const body = renderBlock(source, block, indent + INDENT);
  const hasBlankBodyRows = source.slice(block.startOffset + 1, block.endOffset - 1)
    .split(/\r?\n/).length > 2;
  return `${header}:${body || hasBlankBodyRows ? `\n${body}` : ''}`;
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
        : renderTerminated(source, declaration, ''));
    cursor = declaration.endOffset;
  }
  return result + source.slice(cursor);
}
