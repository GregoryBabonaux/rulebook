import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const tidyLayout = new Function(`${fs.readFileSync(new URL('../../src/build/layout.js', import.meta.url), 'utf8')}; return tidyLayout;`)();
const n = (id, children = [], open = true) => ({ id, children, open });

test('leaves stack on y, parents are centred on their children, depth gives x', () => {
  const tree = n('root', [n('a', [n('a1'), n('a2')]), n('b')]);
  const { nodes, height } = tidyLayout(tree, { colWidth: 100, rowHeight: 10 });
  const at = Object.fromEntries(nodes.map((p) => [p.node.id, p]));
  assert.deepEqual([at.a1.y, at.a2.y, at.b.y], [0, 10, 20]);
  assert.equal(at.a.y, 5);
  assert.equal(at.root.y, 12.5);
  assert.deepEqual([at.root.x, at.a.x, at.a1.x], [0, 100, 200]);
  assert.equal(height, 30);
});

test('a closed node is laid out as a leaf and hides its subtree', () => {
  const tree = n('root', [n('a', [n('a1'), n('a2')], false), n('b')]);
  const { nodes } = tidyLayout(tree, { colWidth: 100, rowHeight: 10 });
  assert.deepEqual(nodes.map((p) => p.node.id), ['root', 'a', 'b']);
});

const placeWithOffsets = new Function(`${fs.readFileSync(new URL('../../src/build/layout.js', import.meta.url), 'utf8')}; return placeWithOffsets;`)();

test('a moved node carries its whole branch; siblings stay put', () => {
  const tree = n('root', [n('a', [n('a1'), n('a2')]), n('b')]);
  const { nodes } = tidyLayout(tree, { colWidth: 100, rowHeight: 10 });
  const placed = placeWithOffsets(nodes, { a: { dx: 30, dy: -5 }, a2: { dx: 0, dy: 7 } });
  const at = Object.fromEntries(placed.map((p) => [p.node.id, p]));
  assert.deepEqual([at.a.x, at.a.y], [130, 0]);
  assert.deepEqual([at.a1.x, at.a1.y], [230, -5]);
  assert.deepEqual([at.a2.x, at.a2.y], [230, 12]);
  assert.deepEqual([at.b.x, at.b.y], [100, 20]);
  assert.deepEqual([at.root.x, at.root.y], [0, 12.5]);
  assert.equal(at.a1.parent, at.a, 'parents point at moved entries');
});
