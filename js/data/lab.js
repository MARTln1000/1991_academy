/* 1991 Academy — The Lab.
   Implement-it-yourself problems: LeetCode-style DSA, classical ML
   models from scratch, and neural networks you build and SEE work.
   Each problem: sandboxed tests + (often) a visualization driven by
   the learner's own code. */
window.MARTINIUM = window.MARTINIUM || { tracks: {}, order: [] };

window.MARTINIUM.lab = [
  /* ============ DSA — the arena ============ */
  {
    id: "lab-two-sum",
    track: "dsa",
    difficulty: "easy",
    xp: 30,
    title: "Two Sum",
    blurb: "The interview classic: find the pair that hits the target — in one pass.",
    fnName: "twoSum",
    brief: `
<p>Given an array of numbers and a target, return the indices <code>[i, j]</code> (i &lt; j) of the two numbers that add up to the target, or <code>[]</code> if no pair exists. Exactly one valid pair exists when there is one.</p>
<p>The O(n²) double loop works. The interview answer is O(n): one pass with a hash map of numbers already seen — you met this exact move in the Arrays &amp; Hash Maps lesson.</p>`,
    starter: `// Return [i, j] with i < j such that nums[i] + nums[j] === target.
// Return [] if no pair exists.
function twoSum(nums, target) {
  // hint: map from value -> its index, filled as you walk
  return [];
}`,
    tests: `
__check("basic pair", twoSum([2, 7, 11, 15], 9), [0, 1]);
__check("pair is later", twoSum([3, 2, 4], 6), [1, 2]);
__check("duplicates", twoSum([3, 3], 6), [0, 1]);
__check("no answer -> []", twoSum([1, 2, 3], 100), []);
__check("negatives", twoSum([-3, 4, 3, 90], 0), [0, 2]);
`,
    hints: [
      "Walk the array once. For each x, ask: 'have I already seen target − x?' A plain object or Map answers in O(1).",
      "Store seen[value] = index as you go. When the complement is in the map, you have both indices — the stored one first.",
    ],
  },
  {
    id: "lab-valid-parens",
    track: "dsa",
    difficulty: "easy",
    xp: 30,
    title: "Valid Parentheses",
    blurb: "(), [], {} — nested and interleaved. The textbook stack problem.",
    fnName: "isValid",
    brief: `
<p>Given a string of only <code>()[]{}</code>, return <code>true</code> if brackets close in the correct order: every opener is closed by the matching closer, most-recent first.</p>
<p><code>"({[]})"</code> is valid; <code>"([)]"</code> is not. "Most recent open must close first" is the definition of LIFO — this is the stack lesson made executable.</p>`,
    starter: `// true if every bracket closes correctly, false otherwise.
function isValid(s) {
  // push openers; on a closer, the stack top must match
  return true;
}`,
    tests: `
__check("simple", isValid("()"), true);
__check("sequence", isValid("()[]{}"), true);
__check("nested", isValid("({[]})"), true);
__check("wrong pair", isValid("(]"), false);
__check("interleaved", isValid("([)]"), false);
__check("unclosed opener", isValid("(("), false);
__check("closer first", isValid(")("), false);
__check("empty string", isValid(""), true);
`,
    hints: [
      "Push every opener onto a stack (array with push/pop). On a closer, pop and compare — mismatch or empty stack means invalid.",
      "After the loop the stack must be EMPTY: leftover openers like '((' are also invalid.",
    ],
  },
  {
    id: "lab-max-subarray",
    track: "dsa",
    difficulty: "medium",
    xp: 50,
    title: "Maximum Subarray (Kadane)",
    blurb: "Best contiguous run in one pass — the most elegant O(n) trick in the book.",
    fnName: "maxSubarraySum",
    brief: `
<p>Return the largest possible sum of a <strong>contiguous</strong> subarray (at least one element).</p>
<p>Kadane's insight: walking left to right, the best subarray <em>ending here</em> is either "just this element" or "this element + the best ending at the previous position" — whichever is larger. Track the best-ending-here and the best-overall; one pass, O(1) space. It's dynamic programming compressed to two variables.</p>`,
    starter: `// Largest sum of a contiguous, non-empty subarray.
function maxSubarraySum(nums) {
  // best ending at this index vs best seen anywhere
  return 0;
}`,
    tests: `
__check("classic", maxSubarraySum([-2, 1, -3, 4, -1, 2, 1, -5, 4]), 6);
__check("all negative", maxSubarraySum([-3, -1, -2]), -1);
__check("single element", maxSubarraySum([5]), 5);
__check("all positive", maxSubarraySum([1, 2, 3]), 6);
__check("recovery after dip", maxSubarraySum([5, -9, 6, -2, 3]), 7);
`,
    hints: [
      "Two variables: endingHere = max(x, endingHere + x); best = max(best, endingHere). Initialize both to nums[0].",
      "All-negative arrays are the classic trap — starting best at 0 fails. Start from the first element instead.",
    ],
  },
  {
    id: "lab-sort-steps",
    track: "dsa",
    difficulty: "easy",
    xp: 30,
    title: "Bubble Sort — Watch It Work",
    blurb: "Implement bubble sort that records every swap — then watch your own algorithm dance.",
    fnName: "bubbleSortSteps",
    brief: `
<p>Implement bubble sort, but make it <strong>narrate</strong>: return an array of snapshots — the initial array, then a copy after <em>every adjacent swap</em>. The visualizer below will animate your snapshots as bars.</p>
<p>Bubble sort: repeatedly sweep the array; whenever two neighbors are out of order, swap them. After each full sweep the largest remaining value has "bubbled" to its place. If a sweep makes no swaps, you're done.</p>
<p>Contract: <code>snapshots[0]</code> = the input; each next snapshot differs from the previous by exactly one adjacent swap; the last is sorted. An already-sorted input returns just <code>[input]</code>.</p>`,
    starter: `// Return snapshots: [initial, after-each-adjacent-swap...].
// Last snapshot must be sorted ascending.
function bubbleSortSteps(arr) {
  const a = arr.slice();
  const steps = [a.slice()];
  // sweep, swap neighbors, push a.slice() after every swap
  return steps;
}`,
    tests: `
var s = bubbleSortSteps([5, 3, 8, 1]);
__check("first snapshot is the input", s[0], [5, 3, 8, 1]);
__check("last snapshot is sorted", s[s.length - 1], [1, 3, 5, 8]);
function oneAdjacentSwap(a, b) {
  var d = [];
  for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) d.push(i);
  return d.length === 2 && d[1] === d[0] + 1 &&
         a[d[0]] === b[d[1]] && a[d[1]] === b[d[0]];
}
var stepsOk = true;
for (var i = 1; i < s.length; i++) if (!oneAdjacentSwap(s[i - 1], s[i])) stepsOk = false;
__check("every step is exactly one adjacent swap", stepsOk, true);
__check("already sorted -> just the input", bubbleSortSteps([1, 2, 3]).length, 1);
var t = bubbleSortSteps([2, 1]);
__check("two elements need one swap", t.length === 2 && t[1][0] === 1 && t[1][1] === 2, true);
`,
    hints: [
      "Nested loops: outer repeats while swaps happen, inner walks j from 0 to length−2 comparing a[j] and a[j+1].",
      "Push a.slice() (a COPY) right after each swap — pushing 'a' itself gives you an array of identical references.",
    ],
    viz: {
      kind: "bars",
      input: [7, 2, 9, 4, 11, 1, 8, 5, 12, 3, 10, 6],
    },
  },
  {
    id: "lab-bfs-path",
    track: "dsa",
    difficulty: "medium",
    xp: 50,
    title: "Pathfinder — BFS Through the Maze",
    blurb: "Return the actual shortest route, then watch it snake across the grid.",
    fnName: "findPath",
    brief: `
<p>A grid of <code>0</code> (open) and <code>1</code> (wall). Return <strong>the cells of a shortest path</strong> from the top-left to the bottom-right as <code>[[r, c], ...]</code> including both endpoints — or <code>[]</code> if unreachable. Moves: up/down/left/right.</p>
<p>You solved the <em>distance</em> version in the missions. Recovering the <em>route</em> needs one more idea: when you enqueue a cell, remember its <strong>parent</strong> (the cell you came from). Reach the goal, then walk parents backwards and reverse.</p>
<p>Any shortest path is accepted — the tests verify validity and optimal length, and the visualizer animates yours.</p>`,
    starter: `// Return the cells of one shortest path, start to goal inclusive,
// or [] if the goal is unreachable.
function findPath(grid) {
  // BFS with a parent map; walk parents back from the goal
  return [];
}`,
    tests: `
function validShortest(grid, path, cellCount) {
  if (cellCount === 0) return Array.isArray(path) && path.length === 0;
  if (!Array.isArray(path) || path.length !== cellCount) return false;
  var R = grid.length, C = grid[0].length;
  if (path[0][0] !== 0 || path[0][1] !== 0) return false;
  var last = path[path.length - 1];
  if (last[0] !== R - 1 || last[1] !== C - 1) return false;
  for (var i = 0; i < path.length; i++) {
    var r = path[i][0], c = path[i][1];
    if (r < 0 || c < 0 || r >= R || c >= C || grid[r][c] === 1) return false;
    if (i > 0) {
      var d = Math.abs(r - path[i - 1][0]) + Math.abs(c - path[i - 1][1]);
      if (d !== 1) return false;
    }
  }
  return true;
}
__check("straight corridor", validShortest([[0, 0, 0]], findPath([[0, 0, 0]]), 3), true);
var g2 = [[0, 1, 0], [0, 1, 0], [0, 0, 0]];
__check("detour maze", validShortest(g2, findPath(g2), 5), true);
__check("unreachable -> []", findPath([[0, 1], [1, 0]]), []);
__check("single cell", findPath([[0]]), [[0, 0]]);
var g3 = [
  [0, 0, 1, 0, 0],
  [1, 0, 1, 0, 1],
  [0, 0, 0, 0, 0],
  [0, 1, 1, 1, 0],
  [0, 0, 0, 0, 0]
];
__check("5x5 maze, 9 cells", validShortest(g3, findPath(g3), 9), true);
`,
    hints: [
      "Queue holds cells; a separate map (key 'r,c') stores each cell's parent. Mark visited when ENQUEUING.",
      "When you pop the goal, rebuild: start at goal, hop parent to parent until the start, then reverse the list.",
    ],
    viz: {
      kind: "grid",
      grid: [
        [0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
        [1, 1, 0, 1, 0, 1, 1, 0, 1, 0],
        [0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        [0, 1, 1, 1, 1, 0, 1, 1, 1, 0],
        [0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        [1, 1, 1, 0, 1, 1, 1, 0, 1, 0],
        [0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        [0, 1, 1, 1, 1, 0, 1, 1, 1, 0],
        [0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 1, 1, 1, 0]
      ],
    },
  },

  /* ============ ML — models from scratch ============ */
  {
    id: "lab-knn",
    track: "ml",
    difficulty: "easy",
    xp: 40,
    title: "k-Nearest Neighbors, From Scratch",
    blurb: "The simplest classifier there is — then see the decision boundary your code carves.",
    fnName: "knnPredict",
    brief: `
<p>Implement the whole algorithm: to classify a point, find the <code>k</code> training points closest to it (Euclidean distance) and return the <strong>majority label</strong> among them (labels are 0 or 1; tests always use odd k, so no ties).</p>
<p>That's it — no training step at all. k-NN "learns" by memorizing. The payoff is the visualization: your function gets called for every pixel of the plane, painting the exact decision boundary your code implies. Watch how jagged it is — that's the bias/variance lesson in living color.</p>`,
    starter: `// train: [{x, y, label}], label is 0 or 1. k is odd.
// Return the majority label among the k nearest neighbors.
function knnPredict(train, x, y, k) {
  // distance -> sort (or scan) -> take k -> majority vote
  return 0;
}`,
    tests: `
var train = [
  { x: 1,   y: 1,   label: 0 }, { x: 1.5, y: 2,   label: 0 },
  { x: 2,   y: 1.2, label: 0 }, { x: 2.2, y: 2.4, label: 0 },
  { x: 6,   y: 5,   label: 1 }, { x: 6.5, y: 6,   label: 1 },
  { x: 7,   y: 5.5, label: 1 }, { x: 7.5, y: 6.5, label: 1 }
];
__check("deep in class 0", knnPredict(train, 1.4, 1.5, 3), 0);
__check("deep in class 1", knnPredict(train, 7, 6, 3), 1);
__check("k=1: nearest wins", knnPredict(train, 2.4, 2.5, 1), 0);
__check("k=7: global majority matters", knnPredict(train, 4.5, 3.8, 7), 1);
__check("works with k = all points", typeof knnPredict(train, 4, 4, 7), "number");
`,
    hints: [
      "Map each training point to {dist: (x−px)² + (y−py)², label} — you can skip the square root, ordering is identical.",
      "Sort by distance, slice(0, k), sum the labels: sum > k/2 means class 1.",
    ],
    viz: {
      kind: "knn",
      k: 5,
      train: [
        { x: 2, y: 2.5, label: 0 }, { x: 1.2, y: 4, label: 0 }, { x: 3, y: 1.5, label: 0 },
        { x: 2.5, y: 3.8, label: 0 }, { x: 1.5, y: 2, label: 0 }, { x: 3.5, y: 3, label: 0 },
        { x: 1, y: 1.2, label: 0 }, { x: 4, y: 2, label: 0 }, { x: 2.8, y: 5.5, label: 0 },
        { x: 7, y: 6.5, label: 1 }, { x: 8, y: 5.5, label: 1 }, { x: 6.5, y: 7.5, label: 1 },
        { x: 7.8, y: 7, label: 1 }, { x: 8.5, y: 6.8, label: 1 }, { x: 6.8, y: 5.8, label: 1 },
        { x: 9, y: 7.5, label: 1 }, { x: 7.4, y: 8.4, label: 1 }, { x: 5.5, y: 5, label: 1 },
        { x: 4.6, y: 6.8, label: 0 }, { x: 5.8, y: 2.6, label: 1 }
      ],
    },
  },
  {
    id: "lab-linreg",
    track: "ml",
    difficulty: "medium",
    xp: 60,
    title: "Linear Regression by Gradient Descent",
    blurb: "Implement the predict → loss → gradient → update loop — and watch the line learn.",
    fnName: "fitLine",
    brief: `
<p>Fit <code>y = w·x + b</code> to data points by gradient descent — the exact loop from the ML track, written by you.</p>
<p>For mean squared error, the gradients are:</p>
<pre><code>dw = mean over points of  2 · (w·x + b − y) · x
db = mean over points of  2 · (w·x + b − y)</code></pre>
<p>Start at <code>w = 0, b = 0</code>, take 200 steps with learning rate 0.05, and <strong>record a snapshot</strong> <code>{w, b}</code> every 10 steps (plus the final one). Return the array of snapshots — the visualizer replays them, showing your line settling onto the data. This animation IS gradient descent.</p>`,
    starter: `// points: [[x, y], ...]. Return an array of {w, b} snapshots:
// one every 10 steps plus the final values.
function fitLine(points) {
  let w = 0, b = 0;
  const lr = 0.05, steps = 200;
  const history = [];
  for (let s = 0; s < steps; s++) {
    // 1) compute dw, db over all points (see the formulas)
    // 2) w -= lr * dw;  b -= lr * db
    // 3) if (s % 10 === 0) history.push({ w, b });
  }
  history.push({ w, b });
  return history;
}`,
    tests: `
var pts = [[0, 1.0], [0.5, 2.1], [1, 3.0], [1.5, 3.9], [2, 5.1],
           [2.5, 6.0], [3, 7.2], [3.5, 7.9], [4, 9.1]];
var hist = fitLine(pts);
var last = hist[hist.length - 1];
__check("returns a history of snapshots", Array.isArray(hist) && hist.length >= 5 && typeof last.w === "number", true);
__check("slope converged near 2", Math.abs(last.w - 2) < 0.3, true);
__check("intercept converged near 1", Math.abs(last.b - 1) < 0.4, true);
var first = hist[0];
__check("early snapshot differs from final (it LEARNED)", Math.abs(first.w - last.w) > 0.05, true);
`,
    hints: [
      "Inner loop over points: err = w * x + b − y; accumulate errSum += 2*err and errXSum += 2*err*x; divide both by points.length.",
      "Update AFTER summing over all points (batch gradient), not inside the point loop — and mind the sign: subtract the gradient.",
    ],
    viz: {
      kind: "fitline",
      points: [[0, 1.0], [0.4, 1.9], [0.8, 2.5], [1.2, 3.6], [1.6, 4.1], [2.0, 5.2],
               [2.4, 5.7], [2.8, 6.9], [3.2, 7.3], [3.6, 8.4], [4.0, 8.9], [1.0, 2.6],
               [3.0, 7.4], [2.2, 5.8], [0.2, 1.6]],
    },
  },
  {
    id: "lab-kmeans",
    track: "ml",
    difficulty: "medium",
    xp: 60,
    title: "k-Means Clustering, From Scratch",
    blurb: "Assign, average, repeat — then watch your centroids walk to the middle of their clusters.",
    fnName: "kmeans",
    brief: `
<p>Implement the two-beat dance of k-means:</p>
<pre><code>repeat iters times:
  ASSIGN  every point to its nearest centroid
  UPDATE  every centroid to the mean of its assigned points</code></pre>
<p>Spec: initialize centroids to <strong>the first k points</strong> (deterministic, so the tests can check you). Each iteration, push <code>{ centroids, labels }</code> — deep copies! — into a history array and return it. <code>labels[i]</code> is the centroid index of point i. If a centroid has no points, leave it where it is.</p>
<p>The visualizer replays your history: points recoloring, centroids marching. Convergence stops being a word and becomes a thing you watched.</p>`,
    starter: `// points: [[x, y], ...]. Return history: one { centroids, labels }
// per iteration. Init: centroids = first k points.
function kmeans(points, k, iters) {
  let centroids = points.slice(0, k).map(p => p.slice());
  const history = [];
  for (let it = 0; it < iters; it++) {
    // 1) labels[i] = index of nearest centroid to points[i]
    // 2) move each centroid to the mean of its points
    // 3) history.push({ centroids: centroids.map(c => c.slice()), labels: labels.slice() });
  }
  return history;
}`,
    tests: `
var pts = [[1, 1], [5, 5], [9, 1],
           [1.4, 0.8], [5.3, 5.4], [8.6, 1.2],
           [0.7, 1.3], [4.6, 4.8], [9.3, 0.7],
           [1.2, 1.5], [5.5, 4.6], [8.8, 1.5],
           [0.9, 0.6], [4.8, 5.3], [9.1, 1.4]];
var hist = kmeans(pts, 3, 8);
__check("one snapshot per iteration", hist.length, 8);
var fin = hist[hist.length - 1];
__check("labels for every point", fin.labels.length, 15);
var blobs = [[0, 3, 6, 9, 12], [1, 4, 7, 10, 13], [2, 5, 8, 11, 14]];
var centers = [[1, 1], [5, 5], [9, 1]];
var coherent = true, accurate = true, distinct = true;
var seen = {};
for (var bi = 0; bi < 3; bi++) {
  var lab = fin.labels[blobs[bi][0]];
  if (seen[lab]) distinct = false;
  seen[lab] = true;
  for (var j = 1; j < 5; j++) if (fin.labels[blobs[bi][j]] !== lab) coherent = false;
  var c = fin.centroids[lab];
  var dx = c[0] - centers[bi][0], dy = c[1] - centers[bi][1];
  if (Math.sqrt(dx * dx + dy * dy) > 0.8) accurate = false;
}
__check("each blob ends in ONE cluster", coherent, true);
__check("the three blobs get three different clusters", distinct, true);
__check("centroids sit on the blob centers", accurate, true);
`,
    hints: [
      "Assignment pass: for each point, loop centroids, keep the index of the smallest squared distance.",
      "Update pass: sum x and y per cluster plus a count; centroid = [sumX/count, sumY/count] when count > 0. Push COPIES into history (slice everything).",
    ],
    viz: {
      kind: "clusters",
      k: 3,
      iters: 8,
      points: [[1, 1], [5, 5], [9, 1], [1.4, 0.8], [5.3, 5.4], [8.6, 1.2],
               [0.7, 1.3], [4.6, 4.8], [9.3, 0.7], [1.2, 1.5], [5.5, 4.6], [8.8, 1.5],
               [0.9, 0.6], [4.8, 5.3], [9.1, 1.4], [1.8, 1.8], [5.9, 5.8], [8.2, 0.9],
               [0.4, 0.9], [4.2, 5.6], [9.6, 1.8], [2.1, 0.7], [6.1, 4.9], [8.4, 2.1]],
    },
  },

  /* ============ DL — build the network ============ */
  {
    id: "lab-perceptron",
    track: "dl",
    difficulty: "medium",
    xp: 60,
    title: "The Perceptron — a Neuron That Learns",
    blurb: "One neuron, the 1958 learning rule, and a decision boundary you watch move into place.",
    fnName: "trainPerceptron",
    brief: `
<p>Implement the original neuron (Rosenblatt, 1958). Prediction: <code>step(w1·x + w2·y + b)</code> where step outputs 1 if the sum ≥ 0, else 0. Learning: for every point, nudge the weights by the error:</p>
<pre><code>pred  = step(w1·x + w2·y + b)
err   = label − pred            // −1, 0, or +1
w1   += lr · err · x
w2   += lr · err · y
b    += lr · err</code></pre>
<p>Spec: init <code>w1 = w2 = b = 0</code>, <code>lr = 0.1</code>; one epoch = one pass over all points in order; after <em>each</em> epoch push <code>{w1, w2, b}</code> into a history and return it after <code>epochs</code> epochs.</p>
<p>The line <code>w1·x + w2·y + b = 0</code> is your neuron's decision boundary — the visualizer draws it after every epoch, wobbling until it separates the classes. For separable data, convergence is a <em>theorem</em>.</p>`,
    starter: `// data: [{x, y, label}], label 0 or 1.
// Return history: one {w1, w2, b} snapshot per epoch.
function trainPerceptron(data, epochs) {
  let w1 = 0, w2 = 0, b = 0;
  const lr = 0.1;
  const history = [];
  // for each epoch: for each point -> predict, compute err, update
  // then history.push({ w1, w2, b })
  return history;
}`,
    tests: `
var data = [
  { x: 1,   y: 2,   label: 0 }, { x: 2,   y: 1,   label: 0 },
  { x: 1.5, y: 1.8, label: 0 }, { x: 0.8, y: 1.2, label: 0 },
  { x: 2.2, y: 2.5, label: 0 },
  { x: 6,   y: 5,   label: 1 }, { x: 7,   y: 6,   label: 1 },
  { x: 6.5, y: 4.8, label: 1 }, { x: 7.5, y: 5.5, label: 1 },
  { x: 6.2, y: 6.3, label: 1 }
];
var hist = trainPerceptron(data, 20);
__check("one snapshot per epoch", hist.length, 20);
var f = hist[hist.length - 1];
function stepFn(z) { return z >= 0 ? 1 : 0; }
var correct = 0;
for (var i = 0; i < data.length; i++) {
  var p = data[i];
  if (stepFn(f.w1 * p.x + f.w2 * p.y + f.b) === p.label) correct++;
}
__check("final boundary classifies all 10 points", correct, 10);
__check("weights actually moved", Math.abs(f.w1) + Math.abs(f.w2) > 0, true);
`,
    hints: [
      "Two nested loops: epochs outside, data points inside. The update uses the CURRENT weights for each point (online learning).",
      "err is 0 for correct predictions — the perceptron only learns from its mistakes. Push a snapshot {w1, w2, b} once per epoch, after the inner loop.",
    ],
    viz: {
      kind: "sepline",
      epochs: 20,
      data: [
        { x: 1, y: 2, label: 0 }, { x: 2, y: 1, label: 0 }, { x: 1.5, y: 1.8, label: 0 },
        { x: 0.8, y: 1.2, label: 0 }, { x: 2.2, y: 2.5, label: 0 }, { x: 1.1, y: 3.1, label: 0 },
        { x: 2.8, y: 1.9, label: 0 }, { x: 0.5, y: 2.2, label: 0 },
        { x: 6, y: 5, label: 1 }, { x: 7, y: 6, label: 1 }, { x: 6.5, y: 4.8, label: 1 },
        { x: 7.5, y: 5.5, label: 1 }, { x: 6.2, y: 6.3, label: 1 }, { x: 5.4, y: 6.8, label: 1 },
        { x: 7.9, y: 4.5, label: 1 }, { x: 6.9, y: 7.2, label: 1 }
      ],
    },
  },
  {
    id: "lab-mlp-xor",
    track: "dl",
    difficulty: "hard",
    xp: 80,
    title: "Neural Network From Scratch: Solve XOR",
    blurb: "The problem that killed the perceptron — solved by a network you write, forward pass to backprop.",
    fnName: "trainXOR",
    brief: `
<p>XOR is not linearly separable — no single neuron can solve it (that discovery froze neural-net research for a decade). A network with one hidden layer can. You're going to build it: forward pass, backpropagation, updates. No libraries.</p>
<p><strong>Architecture:</strong> 2 inputs → 4 hidden (tanh) → 1 output (sigmoid), squared-error loss, per-sample SGD.</p>
<p><strong>Forward</strong>, for input (x1, x2):</p>
<pre><code>h[j] = tanh(W1[j][0]·x1 + W1[j][1]·x2 + b1[j])     j = 0..3
z    = Σ W2[j]·h[j] + b2
p    = 1 / (1 + e^(−z))          // the prediction</code></pre>
<p><strong>Backward</strong> (chain rule, exactly as in the backprop lesson):</p>
<pre><code>dz     = 2·(p − y) · p·(1 − p)
dW2[j] = dz · h[j]        db2 = dz
dh[j]  = dz · W2[j]
dpre[j]= dh[j] · (1 − h[j]²)      // tanh derivative
dW1[j][0] = dpre[j]·x1    dW1[j][1] = dpre[j]·x2    db1[j] = dpre[j]</code></pre>
<p>Update every parameter: <code>param −= lr · grad</code> after each sample. Record the average loss over the 4 XOR samples once per epoch. Return <code>{ predict, lossHistory }</code>, where <code>predict(x1, x2)</code> runs your forward pass.</p>
<p>The visualizer paints your network's output over the whole input square, plus your loss curve. Watching the four corners separate is watching a hidden layer <em>fold space</em>.</p>`,
    starter: `// Build and train a 2-4-1 network on XOR. Return { predict, lossHistory }.
function trainXOR() {
  const X = [[0, 0], [0, 1], [1, 0], [1, 1]];
  const Y = [0, 1, 1, 0];
  // fixed starting weights: everyone converges the same way
  const W1 = [[0.5, -0.4], [0.3, 0.8], [-0.6, 0.2], [0.7, -0.3]];
  const b1 = [0.1, -0.2, 0.05, 0.15];
  const W2 = [0.4, -0.5, 0.6, 0.3];
  let b2 = 0.05;
  const lr = 0.5, epochs = 4000;
  const lossHistory = [];

  function forward(x1, x2) {
    // return { h: [4 hidden activations], p: prediction }
  }

  for (let e = 0; e < epochs; e++) {
    let loss = 0;
    for (let s = 0; s < 4; s++) {
      // forward, accumulate (p - y)^2 into loss,
      // backward (formulas in the brief), update all params
    }
    lossHistory.push(loss / 4);
  }

  return { predict: (x1, x2) => forward(x1, x2).p, lossHistory };
}`,
    tests: `
var net = null;
for (var attempt = 0; attempt < 3 && !net; attempt++) {
  var n = trainXOR();
  if (n && typeof n.predict === "function" && Array.isArray(n.lossHistory)) {
    var ok = n.predict(0, 0) < 0.3 && n.predict(1, 1) < 0.3 &&
             n.predict(0, 1) > 0.7 && n.predict(1, 0) > 0.7;
    if (ok || attempt === 2) net = n;
  }
}
__check("returns { predict, lossHistory }", !!(net && typeof net.predict === "function" && Array.isArray(net.lossHistory)), true);
__check("(0,0) -> ~0", net.predict(0, 0) < 0.3, true);
__check("(1,1) -> ~0", net.predict(1, 1) < 0.3, true);
__check("(0,1) -> ~1", net.predict(0, 1) > 0.7, true);
__check("(1,0) -> ~1", net.predict(1, 0) > 0.7, true);
__check("loss went DOWN during training", net.lossHistory[0] > net.lossHistory[net.lossHistory.length - 1] * 3, true);
`,
    hints: [
      "Write forward() first and test it mentally: with the given starting weights, predict(0,0) should return some number near 0.5 before training.",
      "Backprop order matters: compute dz first, then dW2/db2, then dh -> dpre -> dW1/db1 — and only THEN apply all the updates for this sample.",
    ],
    viz: {
      kind: "xor",
    },
  },
];
