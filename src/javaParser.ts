interface ParserNode {
  name: string;
  location: { startOffset?: number; endOffset?: number };
  children: Record<string, unknown[]>;
}

export type JavaNodeKind = 'other' | 'method' | 'if' | 'for' | 'while' | 'do' | 'return';

export interface JavaSyntaxNode {
  kind: JavaNodeKind;
  startOffset: number;
  endOffset: number; // Exclusive, like VS Code document offsets.
  children: JavaSyntaxNode[];
}

const kinds: Record<string, JavaNodeKind> = {
  methodDeclaration: 'method',
  ifStatement: 'if',
  basicForStatement: 'for',
  enhancedForStatement: 'for',
  whileStatement: 'while',
  doStatement: 'do',
  returnStatement: 'return',
};

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

  return {
    kind: kinds[node.name] ?? 'other',
    startOffset,
    endOffset,
    children,
  };
}

// Keep the parser library and its CST out of the VS Code integration.
export async function parseJava(source: string): Promise<JavaSyntaxNode> {
  const { parse } = await import('java-parser');
  return toSyntaxNode(parse(source) as ParserNode);
}
