const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/dsa-traces.js');
const { generate, defaults } = globalThis.DSATraces;
let seed = 73;
const random = n => { seed = (1664525 * seed + 1013904223) >>> 0; return seed % n; };
function checkTree(n, low = -Infinity, high = Infinity) {
  if (!n) return { height: 0, values: [] };
  assert.ok(n.value > low && n.value < high);
  const left = checkTree(n.left, low, n.value), right = checkTree(n.right, n.value, high);
  assert.equal(n.height, 1 + Math.max(left.height, right.height));
  assert.ok(Math.abs(left.height - right.height) <= 1);
  return { height: n.height, values: [...left.values, n.value, ...right.values] };
}
test('all default traces use immutable, source-synchronized snapshots and leave inputs untouched', () => {
  for (const kind of Object.keys(defaults)) {
    const input = JSON.parse(JSON.stringify(defaults[kind])), before = JSON.stringify(input);
    const trace = generate(kind, input);
    assert.equal(JSON.stringify(input), before);
    assert.ok(trace.frames.length > 1);
    for (const frame of trace.frames) {
      assert.ok(Object.isFrozen(frame) && Object.isFrozen(frame.view));
      assert.ok(frame.line >= 0 && frame.line < trace.pseudocode.length);
      assert.ok(Array.isArray(frame.stack) && Array.isArray(frame.memory));
      assert.equal(typeof frame.explanation, 'string');
    }
    assert.notEqual(trace.frames[0].view, trace.frames.at(-1).view);
  }
});
test('binary search modes match linear references with duplicates and empty input', () => {
  for (let trial = 0; trial < 100; trial++) {
    const values = Array.from({ length: random(30) }, () => random(20) - 10).sort((a, b) => a - b), target = random(26) - 13;
    for (const mode of ['exact', 'first', 'last', 'lower_bound', 'upper_bound']) {
      let result;
      if (mode === 'last') result = values.lastIndexOf(target);
      else if (mode === 'exact' || mode === 'first') result = values.indexOf(target);
      else { result = values.findIndex(v => mode === 'upper_bound' ? v > target : v >= target); if (result === -1) result = values.length; }
      assert.equal(generate('binary-search', { values, target, mode }).result, result);
    }
  }
});
test('AVL covers all four rotations and real deletion rebalance', () => {
  for (const values of [[30, 20, 10], [10, 20, 30], [30, 10, 20], [10, 30, 20]]) {
    const trace = generate('avl-tree', { values });
    assert.equal(trace.result.value, 20);
    assert.deepEqual(checkTree(trace.result).values, [10, 20, 30]);
    assert.ok(trace.frames.at(-1).counters.rotations >= 1);
  }
  const trace = generate('avl-tree', { values: [9, 5, 10, 0, 6, 11, -1, 1, 2], delete: [10] });
  checkTree(trace.result);
  assert.ok(trace.frames.some(f => f.explanation.includes('Remove 10')));
  assert.ok(trace.frames.at(-1).counters.rotations > generate('avl-tree', { values: [9, 5, 10, 0, 6, 11, -1, 1, 2] }).frames.at(-1).counters.rotations);
});
test('AVL randomized insert/delete results obey set semantics, BST ordering, heights and balance', () => {
  for (let trial = 0; trial < 60; trial++) {
    const values = Array.from({ length: 25 }, () => random(40)), remove = Array.from({ length: 20 }, () => random(40));
    const expected = [...new Set(values)].filter(v => !remove.includes(v)).sort((a, b) => a - b);
    assert.deepEqual(checkTree(generate('avl-tree', { values, delete: remove }).result).values, expected);
  }
  assert.equal(generate('avl-tree', { values: [1], delete: [1, 1] }).result, null);
});
test('Dijkstra distances match Bellman-Ford on directed and undirected graphs', () => {
  for (let trial = 0; trial < 40; trial++) {
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f'], edges = [];
    for (const from of nodes) for (const to of nodes) if (random(5) === 0) edges.push({ from, to, weight: random(12) });
    const directed = trial % 2 === 0;
    const dist = Object.fromEntries(nodes.map(n => [n, Infinity])); dist.a = 0;
    const allEdges = directed ? edges : [...edges, ...edges.map(e => ({ from: e.to, to: e.from, weight: e.weight }))];
    for (let i = 0; i < nodes.length - 1; i++) for (const e of allEdges) dist[e.to] = Math.min(dist[e.to], dist[e.from] + e.weight);
    for (const n of nodes) if (!Number.isFinite(dist[n])) dist[n] = null;
    const trace = generate('dijkstra', { nodes, edges, source: 'a', directed });
    assert.deepEqual(trace.result.distances, dist);
    for (const frame of trace.frames) for (const node of frame.view.nodes) if (node.settled) assert.equal(node.distance, dist[node.id]);
  }
});
test('knapsack matches exhaustive subsets, including zero-weight items and zero capacity', () => {
  for (let trial = 0; trial < 70; trial++) {
    const items = Array.from({ length: random(8) }, () => ({ weight: random(6), value: random(15) })), capacity = random(12);
    let best = 0;
    for (let mask = 0; mask < (1 << items.length); mask++) {
      let weight = 0, value = 0;
      items.forEach((item, i) => { if (mask & (1 << i)) { weight += item.weight; value += item.value; } });
      if (weight <= capacity) best = Math.max(best, value);
    }
    const result = generate('knapsack', { items, capacity }).result;
    assert.equal(result.value, best);
    assert.ok(result.weight <= capacity);
    assert.equal(new Set(result.chosen).size, result.chosen.length);
    assert.equal(result.chosen.reduce((sum, i) => sum + items[i].value, 0), best);
  }
});
test('reject malformed, unbounded and semantically invalid teaching inputs', () => {
  for (const [kind, input] of [
    ['unknown', {}], ['binary-search', null], ['binary-search', { values: [2, 1], target: 1 }],
    ['binary-search', { values: [NaN], target: 1 }], ['binary-search', { values: [], target: 1, mode: 'typo' }],
    ['avl-tree', { values: Array(33).fill(1) }], ['dijkstra', { source: 'a', edges: [{ from: 'a', to: 'b', weight: -1 }] }],
    ['dijkstra', { nodes: ['a'], source: 'a', edges: [{ from: 'a', to: 'b', weight: 1 }] }],
    ['knapsack', { items: [], capacity: 41 }], ['knapsack', { items: [{ weight: 0.5, value: 2 }], capacity: 1 }]
  ]) assert.throws(() => generate(kind, input));
});
