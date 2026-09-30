interface ParserNode {
  name: string;
  location: { startOffset?: number; endOffset?: number };
  children: Record<string, unknown[]>;
}

export type JavaNodeKind = 'other' | 'method' | 'block' | 'statement' |
  'if' | 'expression' | 'variable' | 'field' | 'for' | 'foreach' | 'while' | 'do' | 'return';

export interface SourceRange {
  startOffset: number;
  endOffset: number;
}

export interface JavaSyntaxNode extends SourceRange {
  kind: JavaNodeKind;
  children: JavaSyntaxNode[];
  condition?: SourceRange;
  branches?: SourceRange[];
}

const kinds: Record<string, JavaNodeKind> = {
  methodDeclaration: 'method',
  block: 'block',
  blockStatement: 'statement',
  ifStatement: 'if',
  expressionStatement: 'expression',
  localVariableDeclarationStatement: 'variable',
  fieldDeclaration: 'field',
  basicForStatement: 'for',
  enhancedForStatement: 'foreach',
  whileStatement: 'while',
  doStatement: 'do',
  returnStatement: 'return',
};

function range(node: ParserNode): SourceRange {
  return {
    startOffset: node.location.startOffset ?? 0,
    endOffset: (node.location.endOffset ?? -1) + 1,
  };
}

function toSyntaxNode(node: ParserNode): JavaSyntaxNode {
  const children = Object.values(node.children)
    .flat()
    .filter((child): child is ParserNode =>
      typeof child === 'object' && child !== null && 'children' in child)
    .map(toSyntaxNode)
    .sort((a, b) => a.startOffset - b.startOffset);
  const startOffset = Number.isFinite(node.location.startOffset)
    ? node.location.startOffset!
    : children[0]?.startOffset ?? 0;
  const endOffset = Number.isFinite(node.location.endOffset)
    ? node.location.endOffset! + 1
    : children.at(-1)?.endOffset ?? startOffset;

  const controlFlow = ['ifStatement', 'whileStatement', 'enhancedForStatement'].includes(node.name);
  const expression = controlFlow
    ? node.children.expression?.[0] as ParserNode | undefined
    : undefined;
  const firstHeader = node.name === 'enhancedForStatement'
    ? node.children.localVariableDeclaration?.[0] as ParserNode | undefined
    : undefined;
  const condition: SourceRange | undefined = expression
    ? firstHeader
      ? { startOffset: range(firstHeader).startOffset, endOffset: range(expression).endOffset }
      : range(expression)
    : undefined;
  const branches = controlFlow ? node.children.statement : undefined;

  return {
    kind: kinds[node.name] ?? 'other',
    startOffset,
    endOffset,
    children,
    ...(condition ? { condition } : {}),
    ...(branches ? { branches: branches.map((branch) => range(branch as ParserNode)) } : {}),
  };
}

// Keep the parser library and its CST out of the VS Code integration.
export async function parseJava(source: string): Promise<JavaSyntaxNode> {
  const { parse } = await import('java-parser');
  return toSyntaxNode(parse(source) as ParserNode);
}
