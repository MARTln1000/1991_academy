/* 1991 Academy — The Lab.
   Implement-it-yourself problems: LeetCode-style DSA, classical ML
   models from scratch, and neural networks you build and SEE work.
   Each problem is solved in Python, in Google Colab: fnName/starter/tests
   are its Python code (tests call __check(name, actual, expected)), and
   tools/build_notebooks.py turns it into a notebook with those tests and,
   from `viz`, a plot of the learner's own code. Run `make notebooks` after
   changing one. */
window.ACADEMY_1991 = window.ACADEMY_1991 || { tracks: {}, order: [] };

window.ACADEMY_1991.lab = [
  /* ============ DSA — the arena ============ */
  {
    id: "lab-two-sum",
    track: "dsa",
    difficulty: "easy",
    xp: 30,
    title: "Two Sum",
    blurb: "The interview classic: find the pair that hits the target — in one pass.",
    fnName: "two_sum",
    brief: `
<p>Given a list of numbers and a target, return the indices <code>[i, j]</code> (i &lt; j) of the two numbers that add up to the target, or <code>[]</code> if no pair exists. Exactly one valid pair exists when there is one.</p>
<p>The O(n²) double loop works. The interview answer is O(n): one pass with a hash map of numbers already seen — you met this exact move in the Arrays &amp; Hash Maps lesson.</p>`,
    starter: `# Return [i, j] with i < j such that nums[i] + nums[j] == target.
# Return [] if no pair exists.
def two_sum(nums, target):
    # hint: dict from value -> index, filled as you walk
    return []`,
    tests: `
__check("basic pair", two_sum([2, 7, 11, 15], 9), [0, 1])
__check("pair is later", two_sum([3, 2, 4], 6), [1, 2])
__check("duplicates", two_sum([3, 3], 6), [0, 1])
__check("no answer -> []", two_sum([1, 2, 3], 100), [])
__check("negatives", two_sum([-3, 4, 3, 90], 0), [0, 2])
`,
    hints: [
      "Walk the list once. For each x, ask: 'have I already seen target − x?' A dict answers in O(1).",
      "Store seen[value] = index as you go. When the complement is in the dict, you have both indices — the stored one first.",
    ],
  },
  {
    id: "lab-valid-parens",
    track: "dsa",
    difficulty: "easy",
    xp: 30,
    title: "Valid Parentheses",
    blurb: "(), [], {} — nested and interleaved. The textbook stack problem.",
    fnName: "is_valid",
    brief: `
<p>Given a string of only <code>()[]{}</code>, return <code>True</code> if brackets close in the correct order: every opener is closed by the matching closer, most-recent first.</p>
<p><code>"({[]})"</code> is valid; <code>"([)]"</code> is not. "Most recent open must close first" is the definition of LIFO — this is the stack lesson made executable.</p>`,
    starter: `# True if every bracket closes correctly, False otherwise.
def is_valid(s):
    # push openers; on a closer, the stack top must match
    return True`,
    tests: `
__check("simple", is_valid("()"), True)
__check("sequence", is_valid("()[]{}"), True)
__check("nested", is_valid("({[]})"), True)
__check("wrong pair", is_valid("(]"), False)
__check("interleaved", is_valid("([)]"), False)
__check("unclosed opener", is_valid("(("), False)
__check("closer first", is_valid(")("), False)
__check("empty string", is_valid(""), True)
`,
    hints: [
      "Push every opener onto a stack (a list: append to push, pop to pop). On a closer, pop and compare — mismatch or empty stack means invalid.",
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
    fnName: "max_subarray_sum",
    brief: `
<p>Return the largest possible sum of a <strong>contiguous</strong> subarray (at least one element).</p>
<p>Kadane's insight: walking left to right, the best subarray <em>ending here</em> is either "just this element" or "this element + the best ending at the previous position" — whichever is larger. Track the best-ending-here and the best-overall; one pass, O(1) space. It's dynamic programming compressed to two variables.</p>`,
    starter: `# Largest sum of a contiguous, non-empty subarray.
def max_subarray_sum(nums):
    # best ending at this index vs best seen anywhere
    return 0`,
    tests: `
__check("classic", max_subarray_sum([-2, 1, -3, 4, -1, 2, 1, -5, 4]), 6)
__check("all negative", max_subarray_sum([-3, -1, -2]), -1)
__check("single element", max_subarray_sum([5]), 5)
__check("all positive", max_subarray_sum([1, 2, 3]), 6)
__check("recovery after dip", max_subarray_sum([5, -9, 6, -2, 3]), 7)
`,
    hints: [
      "Two variables: ending_here = max(x, ending_here + x); best = max(best, ending_here). Initialize both to nums[0].",
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
    fnName: "bubble_sort_steps",
    brief: `
<p>Implement bubble sort, but make it <strong>narrate</strong>: return a list of snapshots — the initial list, then a copy after <em>every adjacent swap</em>. The notebook then draws your snapshots as bars.</p>
<p>Bubble sort: repeatedly sweep the list; whenever two neighbors are out of order, swap them. After each full sweep the largest remaining value has "bubbled" to its place. If a sweep makes no swaps, you're done.</p>
<p>Contract: <code>snapshots[0]</code> = the input; each next snapshot differs from the previous by exactly one adjacent swap; the last is sorted. An already-sorted input returns just <code>[input]</code>.</p>`,
    starter: `# Return snapshots: [initial, after-each-adjacent-swap...].
# Last snapshot must be sorted ascending.
def bubble_sort_steps(arr):
    a = list(arr)
    steps = [list(a)]
    # sweep, swap neighbors, append list(a) after every swap
    return steps`,
    tests: `
s = bubble_sort_steps([5, 3, 8, 1])
__check("first snapshot is the input", s[0], [5, 3, 8, 1])
__check("last snapshot is sorted", s[-1], [1, 3, 5, 8])

def one_adjacent_swap(a, b):
    d = [i for i in range(len(a)) if a[i] != b[i]]
    return (len(d) == 2 and d[1] == d[0] + 1
            and a[d[0]] == b[d[1]] and a[d[1]] == b[d[0]])

steps_ok = all(one_adjacent_swap(s[i - 1], s[i]) for i in range(1, len(s)))
__check("every step is exactly one adjacent swap", steps_ok, True)
__check("already sorted -> just the input", len(bubble_sort_steps([1, 2, 3])), 1)
t = bubble_sort_steps([2, 1])
__check("two elements need one swap", len(t) == 2 and t[1] == [1, 2], True)
`,
    hints: [
      "Nested loops: outer repeats while swaps happen, inner walks j from 0 to len(a)−2 comparing a[j] and a[j+1].",
      "Append list(a) (a COPY) right after each swap — appending a itself gives you a list of identical references.",
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
    fnName: "find_path",
    brief: `
<p>A grid of <code>0</code> (open) and <code>1</code> (wall). Return <strong>the cells of a shortest path</strong> from the top-left to the bottom-right as <code>[[r, c], ...]</code> including both endpoints — or <code>[]</code> if unreachable. Moves: up/down/left/right.</p>
<p>You solved the <em>distance</em> version in the missions. Recovering the <em>route</em> needs one more idea: when you enqueue a cell, remember its <strong>parent</strong> (the cell you came from). Reach the goal, then walk parents backwards and reverse.</p>
<p>Any shortest path is accepted — the tests verify validity and optimal length, and the notebook draws yours.</p>`,
    starter: `# Return the cells of one shortest path, start to goal inclusive,
# as [[r, c], ...] — or [] if the goal is unreachable.
def find_path(grid):
    # BFS with a parent map; walk parents back from the goal
    return []`,
    tests: `
def valid_shortest(grid, path, cell_count):
    if cell_count == 0:
        return isinstance(path, list) and len(path) == 0
    if not isinstance(path, list) or len(path) != cell_count:
        return False
    R, C = len(grid), len(grid[0])
    if list(path[0]) != [0, 0] or list(path[-1]) != [R - 1, C - 1]:
        return False
    for i, cell in enumerate(path):
        r, c = cell
        if r < 0 or c < 0 or r >= R or c >= C or grid[r][c] == 1:
            return False
        if i > 0 and abs(r - path[i-1][0]) + abs(c - path[i-1][1]) != 1:
            return False
    return True

__check("straight corridor", valid_shortest([[0, 0, 0]], find_path([[0, 0, 0]]), 3), True)
g2 = [[0, 1, 0], [0, 1, 0], [0, 0, 0]]
__check("detour maze", valid_shortest(g2, find_path(g2), 5), True)
__check("unreachable -> []", find_path([[0, 1], [1, 0]]), [])
__check("single cell", [list(c) for c in find_path([[0]])], [[0, 0]])
g3 = [
    [0, 0, 1, 0, 0],
    [1, 0, 1, 0, 1],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 0],
]
__check("5x5 maze, 9 cells", valid_shortest(g3, find_path(g3), 9), True)
`,
    hints: [
      "A queue (collections.deque) holds cells; a dict keyed by (r, c) stores each cell's parent. Mark visited when ENQUEUING.",
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
    fnName: "knn_predict",
    brief: `
<p>Implement the whole algorithm: to classify a point, find the <code>k</code> training points closest to it (Euclidean distance) and return the <strong>majority label</strong> among them (labels are 0 or 1; tests always use odd k, so no ties).</p>
<p>That's it — no training step at all. k-NN "learns" by memorizing. The payoff is the visualization: your function gets called for every pixel of the plane, painting the exact decision boundary your code implies. Watch how jagged it is — that's the bias/variance lesson in living color.</p>`,
    starter: `# train: list of {"x":…, "y":…, "label":…} dicts, label is 0 or 1. k is odd.
# Return the majority label among the k nearest neighbors.
def knn_predict(train, x, y, k):
    # distance -> sort -> take k -> majority vote
    return 0`,
    tests: `
train = [
    {"x": 1,   "y": 1,   "label": 0}, {"x": 1.5, "y": 2,   "label": 0},
    {"x": 2,   "y": 1.2, "label": 0}, {"x": 2.2, "y": 2.4, "label": 0},
    {"x": 6,   "y": 5,   "label": 1}, {"x": 6.5, "y": 6,   "label": 1},
    {"x": 7,   "y": 5.5, "label": 1}, {"x": 7.5, "y": 6.5, "label": 1},
]
__check("deep in class 0", knn_predict(train, 1.4, 1.5, 3), 0)
__check("deep in class 1", knn_predict(train, 7, 6, 3), 1)
__check("k=1: nearest wins", knn_predict(train, 2.4, 2.5, 1), 0)
__check("k=7: global majority matters", knn_predict(train, 4.5, 3.8, 7), 1)
__check("returns a number", isinstance(knn_predict(train, 4, 4, 7), int), True)
`,
    hints: [
      "Turn each training point into a (distance², label) pair, with distance² = (x−px)² + (y−py)² — you can skip the square root, ordering is identical.",
      "Sort by distance, keep the first k ([:k]), sum the labels: sum > k/2 means class 1.",
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
    fnName: "fit_line",
    brief: `
<p>Fit <code>y = w·x + b</code> to data points by gradient descent — the exact loop from the ML track, written by you.</p>
<p>For mean squared error, the gradients are:</p>
<pre><code>dw = mean over points of  2 · (w·x + b − y) · x
db = mean over points of  2 · (w·x + b − y)</code></pre>
<p>Start at <code>w = 0, b = 0</code>, take 200 steps with learning rate 0.05, and <strong>record a snapshot</strong> <code>{"w": w, "b": b}</code> every 10 steps (plus the final one). Return the list of snapshots — the notebook draws them all, showing your line settling onto the data. That picture IS gradient descent.</p>`,
    starter: `# points: [[x, y], ...]. Return a list of {"w":…, "b":…} snapshots:
# one every 10 steps plus the final values.
def fit_line(points):
    w, b = 0.0, 0.0
    lr, steps = 0.05, 200
    history = []
    for s in range(steps):
        # 1) dw = mean of 2*(w*x + b - y)*x ;  db = mean of 2*(w*x + b - y)
        # 2) w -= lr * dw ;  b -= lr * db
        # 3) if s % 10 == 0: history.append({"w": w, "b": b})
        pass
    history.append({"w": w, "b": b})
    return history`,
    tests: `
pts = [[0, 1.0], [0.5, 2.1], [1, 3.0], [1.5, 3.9], [2, 5.1],
       [2.5, 6.0], [3, 7.2], [3.5, 7.9], [4, 9.1]]
hist = fit_line(pts)
last = hist[-1]
__check("returns a history of snapshots", isinstance(hist, list) and len(hist) >= 5 and isinstance(last.get("w"), float), True)
__check("slope converged near 2", abs(last["w"] - 2) < 0.3, True)
__check("intercept converged near 1", abs(last["b"] - 1) < 0.4, True)
__check("early snapshot differs from final (it LEARNED)", abs(hist[0]["w"] - last["w"]) > 0.05, True)
`,
    hints: [
      "Inner loop over points: err = w * x + b − y; accumulate err_sum += 2*err and err_x_sum += 2*err*x; divide both by len(points).",
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
<p>Spec: initialize centroids to <strong>the first k points</strong> (deterministic, so the tests can check you). Each iteration, append <code>{"centroids": …, "labels": …}</code> — copies! — to a history list and return it. <code>labels[i]</code> is the centroid index of point i. If a centroid has no points, leave it where it is.</p>
<p>The notebook colors the points by your final labels and draws each centroid's path. Convergence stops being a word and becomes a thing you see.</p>`,
    starter: `# points: [[x, y], ...]. Return history: one {"centroids":…, "labels":…}
# dict per iteration. Init: centroids = first k points (copies!).
def kmeans(points, k, iters):
    centroids = [list(p) for p in points[:k]]
    history = []
    for it in range(iters):
        # 1) labels[i] = index of the nearest centroid to points[i]
        # 2) move each centroid to the mean of its points
        # 3) history.append({"centroids": [list(c) for c in centroids],
        #                    "labels": list(labels)})
        pass
    return history`,
    tests: `
pts = [[1, 1], [5, 5], [9, 1],
       [1.4, 0.8], [5.3, 5.4], [8.6, 1.2],
       [0.7, 1.3], [4.6, 4.8], [9.3, 0.7],
       [1.2, 1.5], [5.5, 4.6], [8.8, 1.5],
       [0.9, 0.6], [4.8, 5.3], [9.1, 1.4]]
hist = kmeans(pts, 3, 8)
__check("one snapshot per iteration", len(hist), 8)
fin = hist[-1]
__check("labels for every point", len(fin["labels"]), 15)
blobs = [[0, 3, 6, 9, 12], [1, 4, 7, 10, 13], [2, 5, 8, 11, 14]]
centers = [[1, 1], [5, 5], [9, 1]]
coherent, accurate, distinct = True, True, True
seen = set()
for bi in range(3):
    lab = fin["labels"][blobs[bi][0]]
    if lab in seen:
        distinct = False
    seen.add(lab)
    for j in range(1, 5):
        if fin["labels"][blobs[bi][j]] != lab:
            coherent = False
    c = fin["centroids"][lab]
    if math.sqrt((c[0] - centers[bi][0]) ** 2 + (c[1] - centers[bi][1]) ** 2) > 0.8:
        accurate = False
__check("each blob ends in ONE cluster", coherent, True)
__check("the three blobs get three different clusters", distinct, True)
__check("centroids sit on the blob centers", accurate, True)
`,
    hints: [
      "Assignment pass: for each point, loop centroids, keep the index of the smallest squared distance.",
      "Update pass: sum x and y per cluster plus a count; centroid = [sum_x/count, sum_y/count] when count > 0. Append COPIES to history ([list(c) for c in centroids], list(labels)).",
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
    fnName: "train_perceptron",
    brief: `
<p>Implement the original neuron (Rosenblatt, 1958). Prediction: <code>step(w1·x + w2·y + b)</code> where step outputs 1 if the sum ≥ 0, else 0. Learning: for every point, nudge the weights by the error:</p>
<pre><code>pred  = step(w1·x + w2·y + b)
err   = label − pred            # −1, 0, or +1
w1   += lr · err · x
w2   += lr · err · y
b    += lr · err</code></pre>
<p>Spec: init <code>w1 = w2 = b = 0</code>, <code>lr = 0.1</code>; one epoch = one pass over all points in order; after <em>each</em> epoch append <code>{"w1": w1, "w2": w2, "b": b}</code> to a history list and return it after <code>epochs</code> epochs.</p>
<p>The line <code>w1·x + w2·y + b = 0</code> is your neuron's decision boundary — the notebook draws it for every epoch, wobbling until it separates the classes. For separable data, convergence is a <em>theorem</em>.</p>`,
    starter: `# data: list of {"x":…, "y":…, "label":…}. Return history:
# one {"w1":…, "w2":…, "b":…} dict per epoch.
def train_perceptron(data, epochs):
    w1, w2, b = 0.0, 0.0, 0.0
    lr = 0.1
    history = []
    # for each epoch: for each point -> predict with step(), err, update
    # then history.append({"w1": w1, "w2": w2, "b": b})
    return history`,
    tests: `
data = [
    {"x": 1,   "y": 2,   "label": 0}, {"x": 2,   "y": 1,   "label": 0},
    {"x": 1.5, "y": 1.8, "label": 0}, {"x": 0.8, "y": 1.2, "label": 0},
    {"x": 2.2, "y": 2.5, "label": 0},
    {"x": 6,   "y": 5,   "label": 1}, {"x": 7,   "y": 6,   "label": 1},
    {"x": 6.5, "y": 4.8, "label": 1}, {"x": 7.5, "y": 5.5, "label": 1},
    {"x": 6.2, "y": 6.3, "label": 1},
]
hist = train_perceptron(data, 20)
__check("one snapshot per epoch", len(hist), 20)
f = hist[-1]
correct = sum(1 for p in data
              if (1 if f["w1"] * p["x"] + f["w2"] * p["y"] + f["b"] >= 0 else 0) == p["label"])
__check("final boundary classifies all 10 points", correct, 10)
__check("weights actually moved", abs(f["w1"]) + abs(f["w2"]) > 0, True)
`,
    hints: [
      "Two nested loops: epochs outside, data points inside. The update uses the CURRENT weights for each point (online learning).",
      "err is 0 for correct predictions — the perceptron only learns from its mistakes. Append a snapshot {\"w1\": w1, \"w2\": w2, \"b\": b} once per epoch, after the inner loop.",
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
    fnName: "train_xor",
    brief: `
<p>XOR is not linearly separable — no single neuron can solve it (that discovery froze neural-net research for a decade). A network with one hidden layer can. You're going to build it: forward pass, backpropagation, updates. No libraries.</p>
<p><strong>Architecture:</strong> 2 inputs → 4 hidden (tanh) → 1 output (sigmoid), squared-error loss, per-sample SGD.</p>
<p><strong>Forward</strong>, for input (x1, x2):</p>
<pre><code>h[j] = tanh(W1[j][0]·x1 + W1[j][1]·x2 + b1[j])     j = 0..3
z    = Σ W2[j]·h[j] + b2
p    = 1 / (1 + e^(−z))          # the prediction</code></pre>
<p><strong>Backward</strong> (chain rule, exactly as in the backprop lesson):</p>
<pre><code>dz     = 2·(p − y) · p·(1 − p)
dW2[j] = dz · h[j]        db2 = dz
dh[j]  = dz · W2[j]
dpre[j]= dh[j] · (1 − h[j]²)      # tanh derivative
dW1[j][0] = dpre[j]·x1    dW1[j][1] = dpre[j]·x2    db1[j] = dpre[j]</code></pre>
<p>Update every parameter: <code>param −= lr · grad</code> after each sample. Record the average loss over the 4 XOR samples once per epoch. Return <code>{"predict": predict, "loss_history": loss_history}</code>, where <code>predict(x1, x2)</code> runs your forward pass.</p>
<p>The notebook paints your network's output over the whole input square, plus your loss curve. Watching the four corners separate is watching a hidden layer <em>fold space</em>.</p>`,
    starter: `# Build and train a 2-4-1 network on XOR.
# Return {"predict": predict, "loss_history": loss_history}.
def train_xor():
    X = [[0, 0], [0, 1], [1, 0], [1, 1]]
    Y = [0, 1, 1, 0]
    # fixed starting weights: everyone converges the same way
    W1 = [[0.5, -0.4], [0.3, 0.8], [-0.6, 0.2], [0.7, -0.3]]
    b1 = [0.1, -0.2, 0.05, 0.15]
    W2 = [0.4, -0.5, 0.6, 0.3]
    b2 = 0.05
    lr, epochs = 0.5, 4000
    loss_history = []

    def forward(x1, x2):
        # return (h, p): 4 hidden tanh activations and the sigmoid output
        pass

    for e in range(epochs):
        loss = 0.0
        for s in range(4):
            # forward, accumulate (p - y)**2 into loss,
            # backward (formulas in the brief), update all params
            pass
        loss_history.append(loss / 4)

    def predict(x1, x2):
        return forward(x1, x2)[1]

    return {"predict": predict, "loss_history": loss_history}`,
    tests: `
net = None
for attempt in range(3):
    n = train_xor()
    if n and callable(n.get("predict")):
        ok = (n["predict"](0, 0) < 0.3 and n["predict"](1, 1) < 0.3 and
              n["predict"](0, 1) > 0.7 and n["predict"](1, 0) > 0.7)
        if ok or attempt == 2:
            net = n
            break
__check("returns predict + loss_history", bool(net and callable(net.get("predict")) and isinstance(net.get("loss_history"), list)), True)
__check("(0,0) -> ~0", net["predict"](0, 0) < 0.3, True)
__check("(1,1) -> ~0", net["predict"](1, 1) < 0.3, True)
__check("(0,1) -> ~1", net["predict"](0, 1) > 0.7, True)
__check("(1,0) -> ~1", net["predict"](1, 0) > 0.7, True)
__check("loss went DOWN during training", net["loss_history"][0] > net["loss_history"][-1] * 3, True)
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
