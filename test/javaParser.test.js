const assert = require('node:assert/strict');
const test = require('node:test');
const { parseJava } = require('../out/javaParser.js');

function findNodes(node, kind) {
  return [
    ...(node.kind === kind ? [node] : []),
    ...node.children.flatMap((child) => findNodes(child, kind)),
  ];
}

test('identifies methods, if statements, loops, and return statements', async () => {
  const source = `class Example {
    int count(int limit) {
      if (limit < 0) return 0;
      for (int i = 0; i < limit; i++) { }
      for (String value : values) { }
      while (limit > 0) { limit--; }
      do { limit++; } while (limit < 1);
      return limit;
    }
  }`;

  const tree = await parseJava(source);
  for (const [kind, expectedCount] of [
    ['method', 1], ['if', 1], ['for', 1], ['foreach', 1],
    ['while', 1], ['do', 1], ['return', 2],
  ]) {
    assert.equal(findNodes(tree, kind).length, expectedCount, kind);
  }

  const method = findNodes(tree, 'method')[0];
  assert.match(source.slice(method.startOffset, method.endOffset), /^int count\(/);
  const returns = findNodes(method, 'return');
  assert.equal(source.slice(returns[0].startOffset, returns[0].endOffset), 'return 0;');
  assert.equal(source.slice(returns[1].startOffset, returns[1].endOffset), 'return limit;');
});

test('returns an empty syntax tree for an empty Java document', async () => {
  const tree = await parseJava('');
  assert.equal(tree.startOffset, 0);
  assert.equal(tree.endOffset, 0);
  assert.deepEqual(tree.children, []);
});
