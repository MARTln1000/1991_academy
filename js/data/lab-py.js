/* 1991 Academy — Python variants for Lab problems.
   Augments window.MARTINIUM.lab entries with .py = { fnName, starter,
   tests, vizScript? }. Tests use the same __check(name, actual, expected)
   protocol, executed in Pyodide. vizScript(viz) returns Python code that
   sets __out to JSON-serializable data for the visualizer. */
(function () {
  const PY = {
    "lab-two-sum": {
      fnName: "two_sum",
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
    },

    "lab-valid-parens": {
      fnName: "is_valid",
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
    },

    "lab-max-subarray": {
      fnName: "max_subarray_sum",
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
    },

    "lab-sort-steps": {
      fnName: "bubble_sort_steps",
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
      vizScript: (viz) =>
        "__out = bubble_sort_steps(json.loads('" + JSON.stringify(viz.input) + "'))",
    },

    "lab-bfs-path": {
      fnName: "find_path",
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
      vizScript: (viz) =>
        "__out = [list(c) for c in find_path(json.loads('" + JSON.stringify(viz.grid) + "'))]",
    },

    "lab-knn": {
      fnName: "knn_predict",
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
      vizScript: (viz) => {
        const pts = viz.train.map((p) => [p.x, p.y]);
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const padX = (Math.max(...xs) - Math.min(...xs)) * 0.12;
        const padY = (Math.max(...ys) - Math.min(...ys)) * 0.12;
        const minX = Math.min(...xs) - padX, maxX = Math.max(...xs) + padX;
        const minY = Math.min(...ys) - padY, maxY = Math.max(...ys) + padY;
        return [
          "train = json.loads('" + JSON.stringify(viz.train) + "')",
          "cols, rows = 72, 48",
          "__out = [[knn_predict(train, " + minX + " + (c + 0.5) / cols * " + (maxX - minX) + ", " +
            maxY + " - (r + 0.5) / rows * " + (maxY - minY) + ", " + viz.k + ") for c in range(cols)] for r in range(rows)]",
        ].join("\n");
      },
    },

    "lab-linreg": {
      fnName: "fit_line",
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
      vizScript: (viz) =>
        "__out = fit_line(json.loads('" + JSON.stringify(viz.points) + "'))",
    },

    "lab-kmeans": {
      fnName: "kmeans",
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
      vizScript: (viz) =>
        "__out = kmeans(json.loads('" + JSON.stringify(viz.points) + "'), " + viz.k + ", " + viz.iters + ")",
    },

    "lab-perceptron": {
      fnName: "train_perceptron",
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
      vizScript: (viz) =>
        "__out = train_perceptron(json.loads('" + JSON.stringify(viz.data) + "'), " + viz.epochs + ")",
    },

    "lab-mlp-xor": {
      fnName: "train_xor",
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
      vizScript: () =>
        [
          "net = train_xor()",
          "cells, lo, hi = 56, -0.25, 1.25",
          "heat = [[net['predict'](lo + (c + 0.5) / cells * (hi - lo), hi - (r + 0.5) / cells * (hi - lo)) for c in range(cells)] for r in range(cells)]",
          "__out = {'heat': heat, 'loss': net['loss_history']}",
        ].join("\n"),
    },
  };

  for (const p of window.MARTINIUM.lab) {
    if (PY[p.id]) p.py = PY[p.id];
  }
})();
