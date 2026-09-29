/* Deterministic teaching traces. These snapshots do not instrument edited code. */
(function (global) {
  'use strict';
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  const copy = value => JSON.parse(JSON.stringify(value));
  const number = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e9;
  function requireInput(ok, message) { if (!ok) throw new Error(message); }
  function numbers(values, max = 32) {
    requireInput(Array.isArray(values) && values.length <= max && values.every(number), `Expected at most ${max} finite numbers (absolute value ≤ 1e9).`);
  }
  function recorder(pseudocode) {
    const frames = [];
    return { add(line, explanation, variables, view, counters = {}, stack = [], memory = [], prediction) {
      requireInput(frames.length < 6000, 'Trace exceeds the 6,000 frame teaching limit.');
      frames.push(freeze(copy({ line, explanation, variables, stack, memory, counters, view, ...(prediction ? { prediction } : {}) })));
    }, finish(result) { return freeze({ frames, pseudocode, result }); } };
  }
  function binary(input) {
    const { values, target, mode = 'exact' } = input;
    numbers(values, 128); requireInput(number(target), 'Target must be a finite number.');
    requireInput(values.every((v, i) => !i || values[i - 1] <= v), 'Binary search requires sorted input.');
    requireInput(['exact', 'first', 'last', 'lower_bound', 'upper_bound'].includes(mode), 'Unknown binary search mode.');
    const t = recorder(['lo = 0; hi = n  // half-open [lo, hi)', 'while lo < hi:', '    mid = lo + floor((hi - lo) / 2)', '    if a[mid] < target (or <= for upper bound): lo = mid + 1', '    else: hi = mid', 'return boundary (or verify candidate for exact/first/last)']);
    let lo = 0, hi = values.length, mid = null, comparisons = 0;
    const upper = mode === 'upper_bound' || mode === 'last';
    const frame = (line, explanation, result = null, prediction) => t.add(line, explanation, { lo, hi, mid, target, mode }, { kind: 'array', values, low: lo, high: hi, mid, target, active: mid === null ? [] : [mid], result }, { comparisons }, [], [{ label: 'Conceptual contiguous array; O(1) auxiliary indices', cells: values }], prediction);
    frame(0, 'The answer is a boundary in [0, n]; the active element interval is half-open.');
    while (lo < hi) {
      frame(1, 'The unresolved interval is nonempty.');
      mid = lo + Math.floor((hi - lo) / 2); frame(2, 'Choose a midpoint without adding both endpoints.', null, { prompt: 'Which boundary changes next?', options: ['lo = mid + 1', 'hi = mid'], answer: (upper ? values[mid] <= target : values[mid] < target) ? 0 : 1, explanation: upper ? 'Upper bound excludes values equal to the target on the left.' : 'Lower bound keeps equal values as potential first positions.' });
      comparisons++;
      if (upper ? values[mid] <= target : values[mid] < target) { lo = mid + 1; frame(3, 'The midpoint belongs to the excluded left partition.'); }
      else { hi = mid; frame(4, 'Keep the midpoint as a possible boundary; exclude everything to its right.'); }
    }
    let result = lo;
    if (mode === 'last') result = lo > 0 && values[lo - 1] === target ? lo - 1 : -1;
    if (mode === 'first' || mode === 'exact') result = lo < values.length && values[lo] === target ? lo : -1;
    mid = null; frame(5, 'The interval is empty. Boundary modes may return n; occurrence modes return -1 when absent.', result);
    return t.finish(result);
  }
  function avl(input) {
    const values = input.values, deletions = input.delete === undefined ? [] : input.delete;
    numbers(values); numbers(deletions);
    const t = recorder(['search by BST ordering', 'insert leaf / delete node (use inorder successor for two children)', 'recompute height = 1 + max(left height, right height)', 'if left-heavy and left child right-heavy: rotate left on child', 'if left-heavy: rotate right', 'if right-heavy and right child left-heavy: rotate right on child', 'if right-heavy: rotate left', 'return balanced subtree']);
    let root = null, serial = 0, rotations = 0, visits = 0;
    const h = n => n ? n.height : 0;
    const update = n => { n.height = 1 + Math.max(h(n.left), h(n.right)); };
    const snapshot = (line, explanation, active, stack = []) => {
      const nodes = []; const walk = n => { if (!n) return; nodes.push({ id: n.id, value: n.value, height: n.height, left: n.left?.id || null, right: n.right?.id || null }); walk(n.left); walk(n.right); }; walk(root);
      t.add(line, explanation, {}, { kind: 'tree', root: root?.id || null, nodes, active: active ? [active.id] : [], operation: explanation }, { rotations, visits }, stack, nodes.map(n => ({ label: `${n.id}: value, height, left pointer, right pointer`, ...n })));
    };
    // A holder lets rotations appear attached to the complete tree in every snapshot.
    const holder = { root: null };
    function emit(line, text, node, stack) { root = holder.root; snapshot(line, text, node, stack); }
    function rotate(parent, key, left, line, stack) {
      const old = parent[key], pivot = left ? old.right : old.left;
      if (left) { old.right = pivot.left; pivot.left = old; } else { old.left = pivot.right; pivot.right = old; }
      update(old); update(pivot); parent[key] = pivot; rotations++;
      emit(line, `${left ? 'Left' : 'Right'} rotation preserves inorder ordering.`, pivot, stack);
    }
    function balance(parent, key, stack) {
      const n = parent[key]; if (!n) return;
      update(n); emit(2, 'Update the height while unwinding the search path.', n, stack);
      const b = h(n.left) - h(n.right);
      if (b > 1) {
        if (h(n.left.left) < h(n.left.right)) rotate(n, 'left', true, 3, stack);
        rotate(parent, key, false, 4, stack);
      } else if (b < -1) {
        if (h(n.right.right) < h(n.right.left)) rotate(n, 'right', false, 5, stack);
        rotate(parent, key, true, 6, stack);
      }
      emit(7, 'This subtree now satisfies the AVL height bound.', parent[key], stack);
    }
    function insert(parent, key, value, stack) {
      let n = parent[key];
      if (!n) { n = parent[key] = { id: `n${++serial}`, value, height: 1, left: null, right: null }; emit(1, `Insert ${value} as a leaf.`, n, stack); return; }
      visits++; const path = [...stack, { node: n.id, operation: 'insert', value }]; emit(0, `Compare ${value} with ${n.value}.`, n, path);
      if (value === n.value) { emit(7, 'Set semantics: duplicate keys are ignored.', n, path); return; }
      insert(n, value < n.value ? 'left' : 'right', value, path); balance(parent, key, stack);
    }
    function remove(parent, key, value, stack) {
      const n = parent[key]; if (!n) return;
      visits++; const path = [...stack, { node: n.id, operation: 'delete', value }]; emit(0, `Search for deletion key ${value}.`, n, path);
      if (value < n.value) remove(n, 'left', value, path);
      else if (value > n.value) remove(n, 'right', value, path);
      else if (!n.left || !n.right) { parent[key] = n.left || n.right; emit(1, `Remove ${value}; reconnect its only child, if any.`, parent[key], stack); }
      else {
        let successor = n.right; while (successor.left) successor = successor.left;
        const replacement = successor.value;
        // Remove first so every emitted structural snapshot retains unique keys.
        remove(n, 'right', replacement, path); n.value = replacement;
        emit(1, `Replace ${value} with inorder successor ${replacement}.`, n, stack);
      }
      balance(parent, key, stack);
    }
    emit(0, 'Begin with an empty AVL set.', null, []);
    values.forEach(v => insert(holder, 'root', v, []));
    deletions.forEach(v => remove(holder, 'root', v, []));
    emit(7, 'All operations complete; inspect the final BST ordering and balance factors.', holder.root, []);
    return t.finish(copy(holder.root));
  }
  function dijkstra(input) {
    const { edges, source, directed = true } = input;
    requireInput(Array.isArray(edges) && edges.length <= 96, 'Expected at most 96 edges.');
    const id = x => typeof x === 'string' && x.length > 0 && x.length <= 24;
    requireInput(edges.every(e => e && id(e.from) && id(e.to) && number(e.weight) && e.weight >= 0), 'Edges need string endpoints and nonnegative finite weights.');
    const nodes = input.nodes || [...new Set([source, ...edges.flatMap(e => [e.from, e.to])])];
    requireInput(Array.isArray(nodes) && nodes.length <= 20 && nodes.every(id) && new Set(nodes).size === nodes.length && nodes.includes(source), 'Expected unique node IDs including the source (at most 20).');
    requireInput(edges.every(e => nodes.includes(e.from) && nodes.includes(e.to)), 'Every edge endpoint must be a declared node.');
    requireInput(typeof directed === 'boolean', 'directed must be boolean.');
    const t = recorder(['distance[source] = 0; push (0, source) into min-heap', 'while heap is not empty: pop minimum (d, u)', 'if d != distance[u] or u is settled: skip stale entry', 'settle u: its shortest distance is final', 'for each outgoing edge (u, v, w):', '    if d + w < distance[v]: update distance and predecessor; push candidate', 'return distances and predecessor tree']);
    const dist = Object.fromEntries(nodes.map(n => [n, null])), previous = Object.fromEntries(nodes.map(n => [n, null])), settled = new Set(), queue = [];
    let comparisons = 0, relaxations = 0, pops = 0;
    const less = (a, b) => { comparisons++; return a.distance < b.distance || (a.distance === b.distance && a.id < b.id); };
    const push = value => { queue.push(value); let i = queue.length - 1; while (i > 0) { const p = Math.floor((i - 1) / 2); if (!less(queue[i], queue[p])) break; [queue[i], queue[p]] = [queue[p], queue[i]]; i = p; } };
    const pop = () => { const first = queue[0], last = queue.pop(); if (queue.length) { queue[0] = last; let i = 0; while (2 * i + 1 < queue.length) { let child = 2 * i + 1; if (child + 1 < queue.length && less(queue[child + 1], queue[child])) child++; if (!less(queue[child], queue[i])) break; [queue[i], queue[child]] = [queue[child], queue[i]]; i = child; } } return first; };
    const adjacency = new Map(nodes.map(n => [n, []])); edges.forEach(e => { adjacency.get(e.from).push({ to: e.to, weight: e.weight }); if (!directed) adjacency.get(e.to).push({ to: e.from, weight: e.weight }); });
    const frame = (line, text, active = [], extra = {}) => t.add(line, text, { distances: dist, previous, ...extra }, { kind: 'graph', nodes: nodes.map(id => ({ id, distance: dist[id], settled: settled.has(id) })), edges, active, queue, source, directed }, { heapComparisons: comparisons, relaxations, pops }, [], [{ label: 'Conceptual distance/predecessor maps and binary min-heap', distances: dist, previous, queue }]);
    dist[source] = 0; push({ id: source, distance: 0 }); frame(0, 'Null distances mean unreachable so far. The source starts at zero.');
    while (queue.length) {
      const { id: u, distance: d } = pop(); pops++; frame(1, `Pop minimum candidate ${u} at distance ${d}.`, [u]);
      if (d !== dist[u] || settled.has(u)) { frame(2, 'Discard a superseded queue entry.', [u]); continue; }
      settled.add(u); frame(3, 'Nonnegative weights ensure no later path can improve this settled distance.', [u]);
      for (const { to: v, weight: w } of adjacency.get(u)) {
        relaxations++; frame(4, `Try edge ${u} → ${v} of weight ${w}.`, [u, v], { candidate: d + w });
        if (dist[v] === null || d + w < dist[v]) { dist[v] = d + w; previous[v] = u; push({ id: v, distance: dist[v] }); frame(5, `Improve ${v} and push a new candidate. Old heap entries may remain.`, [v]); }
      }
    }
    frame(6, 'Finished. Null denotes unreachable; predecessors reconstruct shortest paths.');
    return t.finish({ distances: dist, previous });
  }
  function knapsack(input) {
    const { items, capacity } = input;
    requireInput(Number.isInteger(capacity) && capacity >= 0 && capacity <= 40, 'Capacity must be an integer between 0 and 40.');
    requireInput(Array.isArray(items) && items.length <= 16 && items.every(x => x && Number.isInteger(x.weight) && x.weight >= 0 && x.weight <= 40 && number(x.value) && x.value >= 0), 'Use at most 16 items with integer weights 0–40 and nonnegative finite values.');
    const t = recorder(['dp[0][c] = 0 for every capacity c', 'for i = 1..n: for c = 0..capacity:', '    skip = dp[i-1][c]', '    take = value[i-1] + dp[i-1][c-weight[i-1]] if item fits', '    dp[i][c] = max(skip, take)', 'walk backward: if dp[i][c] != dp[i-1][c], choose item and subtract weight', 'return best value and chosen item indices']);
    const rows = Array.from({ length: items.length + 1 }, () => Array(capacity + 1).fill(0));
    let updates = 0; const chosen = [];
    const frame = (line, text, i, c, extra = {}) => t.add(line, text, { i, c, ...extra }, { kind: 'table', rows, rowLabels: rows.map((_, i) => `${i} items`), columnLabels: rows[0].map((_, c) => String(c)), active: i === null ? [] : [[i, c]], chosen, items, capacity }, { updates }, [], [{ label: 'Conceptual (n+1) × (capacity+1) value table; each item uses only the previous row', cells: (items.length + 1) * (capacity + 1) }]);
    frame(0, 'With no items the best value is zero, including at zero capacity.', 0, 0);
    for (let i = 1; i <= items.length; i++) for (let c = 0; c <= capacity; c++) {
      const item = items[i - 1], skip = rows[i - 1][c], take = item.weight <= c ? item.value + rows[i - 1][c - item.weight] : null;
      frame(1, 'Solve a state using only states with fewer available items.', i, c);
      frame(2, 'Option one: exclude this item.', i, c, { skip });
      frame(3, take === null ? 'The item does not fit.' : 'Option two: include this item exactly once using the previous row.', i, c, { skip, take });
      rows[i][c] = Math.max(skip, take === null ? skip : take); updates++;
      frame(4, 'Store the better feasible choice; ties prefer excluding the item during reconstruction.', i, c, { skip, take });
    }
    let c = capacity;
    for (let i = items.length; i > 0; i--) {
      if (rows[i][c] !== rows[i - 1][c]) { chosen.push(i - 1); c -= items[i - 1].weight; }
      frame(5, 'Move to the previous row. Included items reduce remaining capacity, even if their weight is zero.', i - 1, c);
    }
    chosen.reverse(); frame(6, 'Reconstruction identifies a feasible optimal subset.', items.length, capacity);
    return t.finish({ value: rows[items.length][capacity], chosen, weight: chosen.reduce((sum, i) => sum + items[i].weight, 0) });
  }
  const defaults = freeze({
    'binary-search': { values: [1, 3, 3, 5, 8, 13, 21], target: 3, mode: 'lower_bound' },
    'avl-tree': { values: [30, 10, 20, 40, 50, 25], delete: [10] },
    dijkstra: { nodes: ['A', 'B', 'C', 'D', 'E'], source: 'A', edges: [{ from: 'A', to: 'B', weight: 4 }, { from: 'A', to: 'C', weight: 1 }, { from: 'C', to: 'B', weight: 2 }, { from: 'B', to: 'D', weight: 1 }, { from: 'C', to: 'D', weight: 5 }] },
    knapsack: { items: [{ weight: 2, value: 3 }, { weight: 3, value: 4 }, { weight: 4, value: 5 }, { weight: 5, value: 8 }], capacity: 7 }
  });
  const generators = { 'binary-search': binary, 'avl-tree': avl, dijkstra, knapsack };
  global.DSATraces = Object.freeze({ defaults, generate(kind, input) {
    requireInput(Object.prototype.hasOwnProperty.call(generators, kind), 'Unknown teaching trace.');
    requireInput(input === undefined || (input !== null && typeof input === 'object' && !Array.isArray(input)), 'Trace input must be an object.');
    return generators[kind](input === undefined ? copy(defaults[kind]) : input);
  } });
})(typeof window !== 'undefined' ? window : globalThis);
