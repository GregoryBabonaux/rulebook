// Horizontal tidy tree: depth on the x axis, leaves stacked on the y axis, each parent centred
// on its visible children. A closed node is laid out as a leaf. Plain script (no export): it is
// inlined in the HTML and evaluated by the tests.
function tidyLayout(root, opts) {
  const col = (opts && opts.colWidth) || 240;
  const row = (opts && opts.rowHeight) || 34;
  const placed = [];
  let next = 0;
  function visit(node, depth, parent) {
    const kids = node.open && node.children ? node.children : [];
    const entry = { node: node, depth: depth, parent: parent, x: depth * col, y: 0 };
    placed.push(entry);
    if (!kids.length) {
      entry.y = next * row;
      next += 1;
      return entry;
    }
    const children = kids.map(function (child) { return visit(child, depth + 1, entry); });
    entry.y = (children[0].y + children[children.length - 1].y) / 2;
    return entry;
  }
  visit(root, 0, null);
  return { nodes: placed, height: Math.max(next, 1) * row };
}

// Manual moves: each node may carry an offset { dx, dy }; a node's position adds the offsets of
// itself and of every ancestor, so moving a node moves its whole branch and nothing else.
function placeWithOffsets(placed, offsets) {
  const shift = new Map();
  const moved = new Map();
  return placed.map(function (p) {
    const own = (offsets && offsets[p.node.id]) || { dx: 0, dy: 0 };
    const inherited = p.parent ? shift.get(p.parent) : { dx: 0, dy: 0 };
    const total = { dx: inherited.dx + own.dx, dy: inherited.dy + own.dy };
    shift.set(p, total);
    const entry = { node: p.node, depth: p.depth, parent: p.parent ? moved.get(p.parent) : null, x: p.x + total.dx, y: p.y + total.dy };
    moved.set(p, entry);
    return entry;
  });
}
