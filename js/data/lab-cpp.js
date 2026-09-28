/* 1991 Academy — C++ variants for every Lab problem.
   Attaches .cpp = { fnName, starter, tests, prelude?, hint?, hint_hy? }.
   Compiled and run on the server, in the sandboxed runner container;
   __check(name, actual, expected) reports each test (app.py has the
   harness). `prelude` holds the types a problem gives the learner (its
   structs), compiled ahead of their code; `hint` is one extra hint shown
   only in C++. The visualizations stay JavaScript/Python: they run in
   the browser, next to the canvas. */
(function () {
  const CPP = {
    "lab-two-sum": {
      fnName: "twoSum",
      starter: `// Return the indices [i, j] (i < j) with nums[i] + nums[j] == target.
// Return an empty vector if no pair exists.
vector<int> twoSum(vector<int> nums, int target) {
    // hint: unordered_map<int,int> from value -> index, filled as you walk
    return {};
}`,
      tests: `int main() {
    __check("basic pair", twoSum({2, 7, 11, 15}, 9), vector<int>{0, 1});
    __check("pair is later", twoSum({3, 2, 4}, 6), vector<int>{1, 2});
    __check("duplicates", twoSum({3, 3}, 6), vector<int>{0, 1});
    __check("no answer -> empty", twoSum({1, 2, 3}, 100), vector<int>{});
    __check("negatives", twoSum({-3, 4, 3, 90}, 0), vector<int>{0, 2});
    return 0;
}`,
    },

    "lab-valid-parens": {
      fnName: "isValid",
      starter: `// true if every bracket closes in the correct order, false otherwise.
bool isValid(string s) {
    // push openers on a stack; on a closer, the top must match
    return true;
}`,
      tests: `int main() {
    __check("simple", isValid("()"), true);
    __check("sequence", isValid("()[]{}"), true);
    __check("nested", isValid("({[]})"), true);
    __check("wrong pair", isValid("(]"), false);
    __check("interleaved", isValid("([)]"), false);
    __check("unclosed opener", isValid("(("), false);
    __check("closer first", isValid(")("), false);
    __check("empty string", isValid(""), true);
    return 0;
}`,
    },

    "lab-max-subarray": {
      fnName: "maxSubarraySum",
      starter: `// Largest sum of a contiguous, non-empty subarray (Kadane's algorithm).
int maxSubarraySum(vector<int> nums) {
    // best ending at this index vs best seen anywhere
    return 0;
}`,
      tests: `int main() {
    __check("classic", maxSubarraySum({-2, 1, -3, 4, -1, 2, 1, -5, 4}), 6);
    __check("all negative", maxSubarraySum({-3, -1, -2}), -1);
    __check("single element", maxSubarraySum({5}), 5);
    __check("all positive", maxSubarraySum({1, 2, 3}), 6);
    __check("recovery after dip", maxSubarraySum({5, -9, 6, -2, 3}), 7);
    return 0;
}`,
    },

    "lab-sort-steps": {
      fnName: "bubbleSortSteps",
      starter: `// Return snapshots: {initial, after each adjacent swap...}.
// The last snapshot must be sorted ascending.
vector<vector<int>> bubbleSortSteps(vector<int> a) {
    vector<vector<int>> steps = {a};
    // sweep, swap neighbors, steps.push_back(a) after every swap
    return steps;
}`,
      tests: `bool oneAdjacentSwap(const vector<int>& a, const vector<int>& b) {
    if (a.size() != b.size()) return false;
    vector<size_t> d;
    for (size_t i = 0; i < a.size(); i++) if (a[i] != b[i]) d.push_back(i);
    return d.size() == 2 && d[1] == d[0] + 1 && a[d[0]] == b[d[1]] && a[d[1]] == b[d[0]];
}
int main() {
    vector<vector<int>> s = bubbleSortSteps({5, 3, 8, 1});
    __check("first snapshot is the input", s.empty() ? vector<int>{} : s.front(), vector<int>{5, 3, 8, 1});
    __check("last snapshot is sorted", s.empty() ? vector<int>{} : s.back(), vector<int>{1, 3, 5, 8});
    bool stepsOk = true;
    for (size_t i = 1; i < s.size(); i++) if (!oneAdjacentSwap(s[i - 1], s[i])) stepsOk = false;
    __check("every step is exactly one adjacent swap", stepsOk, true);
    __check("already sorted -> just the input", bubbleSortSteps({1, 2, 3}).size(), 1);
    vector<vector<int>> t = bubbleSortSteps({2, 1});
    __check("two elements need one swap", t.size() == 2 && t[1] == vector<int>{1, 2}, true);
    return 0;
}`,
      hint: "steps.push_back(a) stores a copy of a, so later swaps don't change the snapshots already taken.",
      hint_hy: "steps.push_back(a)-ն պահում է a-ի պատճենը, այնպես որ հետագա փոխատեղումները չեն փոխում արդեն արված snapshot-ները։",
    },

    "lab-bfs-path": {
      fnName: "findPath",
      starter: `// grid: 0 = open, 1 = wall. Return the cells of one shortest path
// from {0, 0} to the bottom-right corner, both ends included, as
// {row, col} pairs, or an empty vector if the goal is unreachable.
vector<vector<int>> findPath(vector<vector<int>> grid) {
    // BFS with a parent map; walk parents back from the goal
    return {};
}`,
      tests: `bool validShortest(const vector<vector<int>>& grid, const vector<vector<int>>& path, size_t cellCount) {
    if (cellCount == 0) return path.empty();
    if (path.size() != cellCount) return false;
    int R = grid.size(), C = grid[0].size();
    for (size_t i = 0; i < path.size(); i++) {
        if (path[i].size() != 2) return false;
        int r = path[i][0], c = path[i][1];
        if (r < 0 || c < 0 || r >= R || c >= C || grid[r][c] == 1) return false;
        if (i > 0 && abs(r - path[i - 1][0]) + abs(c - path[i - 1][1]) != 1) return false;
    }
    return path.front() == vector<int>{0, 0} && path.back() == vector<int>{R - 1, C - 1};
}
int main() {
    __check("straight corridor", validShortest({{0, 0, 0}}, findPath({{0, 0, 0}}), 3), true);
    vector<vector<int>> g2 = {{0, 1, 0}, {0, 1, 0}, {0, 0, 0}};
    __check("detour maze", validShortest(g2, findPath(g2), 5), true);
    __check("unreachable -> {}", findPath({{0, 1}, {1, 0}}), vector<vector<int>>{});
    __check("single cell", findPath({{0}}), vector<vector<int>>{{0, 0}});
    vector<vector<int>> g3 = {
        {0, 0, 1, 0, 0},
        {1, 0, 1, 0, 1},
        {0, 0, 0, 0, 0},
        {0, 1, 1, 1, 0},
        {0, 0, 0, 0, 0},
    };
    __check("5x5 maze, 9 cells", validShortest(g3, findPath(g3), 9), true);
    return 0;
}`,
      hint: "A queue<pair<int,int>> for the frontier and a parent grid (vector<vector<pair<int,int>>>, {-1,-1} = not visited yet) are all you need. reverse() the path at the end.",
      hint_hy: "Առաջնագծի համար queue<pair<int,int>> և ծնողների ցանց (vector<vector<pair<int,int>>>, {-1,-1} = դեռ չայցելված)՝ ահա և ամբողջը։ Վերջում ճանապարհը reverse() արա։",
    },

    "lab-knn": {
      fnName: "knnPredict",
      prelude: `struct Point { double x, y; int label; };`,
      starter: `// Given: struct Point { double x, y; int label; };  (label is 0 or 1)
// Return the majority label among the k nearest neighbors (k is odd).
int knnPredict(vector<Point> train, double x, double y, int k) {
    // distance -> sort -> take k -> majority vote
    return 0;
}`,
      tests: `int main() {
    vector<Point> train = {
        {1, 1, 0},   {1.5, 2, 0},   {2, 1.2, 0}, {2.2, 2.4, 0},
        {6, 5, 1},   {6.5, 6, 1},   {7, 5.5, 1}, {7.5, 6.5, 1},
    };
    __check("deep in class 0", knnPredict(train, 1.4, 1.5, 3), 0);
    __check("deep in class 1", knnPredict(train, 7, 6, 3), 1);
    __check("k=1: nearest wins", knnPredict(train, 2.4, 2.5, 1), 0);
    __check("k=7: global majority matters", knnPredict(train, 4.5, 3.8, 7), 1);
    __check("k=1 on the other side", knnPredict(train, 6.1, 5.2, 1), 1);
    return 0;
}`,
      hint: "Build a vector<pair<double,int>> of {squared distance, label}, sort it (pairs sort by their first element), then add up the labels of the first k.",
      hint_hy: "Կառուցի՛ր {քառակուսի հեռավորություն, պիտակ} vector<pair<double,int>>, դասավորի՛ր այն (զույգերը դասավորվում են ըստ առաջին տարրի), հետո գումարի՛ր առաջին k-ի պիտակները։",
    },

    "lab-linreg": {
      fnName: "fitLine",
      prelude: `struct Snapshot { double w, b; };`,
      starter: `// Given: struct Snapshot { double w, b; };
// points: {x, y} pairs. Return a Snapshot every 10 steps,
// plus the final values.
vector<Snapshot> fitLine(vector<vector<double>> points) {
    double w = 0, b = 0;
    const double lr = 0.05;
    const int steps = 200;
    vector<Snapshot> history;
    for (int s = 0; s < steps; s++) {
        // 1) compute dw, db over all points (see the formulas)
        // 2) w -= lr * dw;  b -= lr * db;
        // 3) if (s % 10 == 0) history.push_back({w, b});
    }
    history.push_back({w, b});
    return history;
}`,
      tests: `int main() {
    vector<vector<double>> pts = {{0, 1.0}, {0.5, 2.1}, {1, 3.0}, {1.5, 3.9}, {2, 5.1},
                                  {2.5, 6.0}, {3, 7.2}, {3.5, 7.9}, {4, 9.1}};
    vector<Snapshot> hist = fitLine(pts);
    __check("returns a history of snapshots", hist.size() >= 5, true);
    if (hist.empty()) return 0;
    Snapshot last = hist.back();
    __check("slope converged near 2", fabs(last.w - 2) < 0.3, true);
    __check("intercept converged near 1", fabs(last.b - 1) < 0.4, true);
    __check("early snapshot differs from final (it LEARNED)", fabs(hist.front().w - last.w) > 0.05, true);
    return 0;
}`,
    },

    "lab-kmeans": {
      fnName: "kmeans",
      prelude: `struct Step { vector<vector<double>> centroids; vector<int> labels; };`,
      starter: `// Given: struct Step { vector<vector<double>> centroids; vector<int> labels; };
// points: {x, y} pairs. Return one Step per iteration.
// Init: centroids = the first k points.
vector<Step> kmeans(vector<vector<double>> points, int k, int iters) {
    vector<vector<double>> centroids(points.begin(), points.begin() + k);
    vector<Step> history;
    for (int it = 0; it < iters; it++) {
        // 1) labels[i] = index of the nearest centroid to points[i]
        // 2) move each centroid to the mean of its points
        // 3) history.push_back({centroids, labels});
    }
    return history;
}`,
      tests: `int main() {
    vector<vector<double>> pts = {{1, 1}, {5, 5}, {9, 1},
                                  {1.4, 0.8}, {5.3, 5.4}, {8.6, 1.2},
                                  {0.7, 1.3}, {4.6, 4.8}, {9.3, 0.7},
                                  {1.2, 1.5}, {5.5, 4.6}, {8.8, 1.5},
                                  {0.9, 0.6}, {4.8, 5.3}, {9.1, 1.4}};
    vector<Step> hist = kmeans(pts, 3, 8);
    __check("one snapshot per iteration", hist.size(), 8);
    if (hist.empty()) return 0;
    const Step& fin = hist.back();
    __check("labels for every point", fin.labels.size(), 15);
    if (fin.labels.size() != 15) return 0;
    int blobs[3][5] = {{0, 3, 6, 9, 12}, {1, 4, 7, 10, 13}, {2, 5, 8, 11, 14}};
    double centers[3][2] = {{1, 1}, {5, 5}, {9, 1}};
    bool coherent = true, accurate = true, distinct = true;
    set<int> seen;
    for (int bi = 0; bi < 3; bi++) {
        int lab = fin.labels[blobs[bi][0]];
        if (seen.count(lab)) distinct = false;
        seen.insert(lab);
        for (int j = 1; j < 5; j++) if (fin.labels[blobs[bi][j]] != lab) coherent = false;
        if (lab < 0 || lab >= (int)fin.centroids.size() || fin.centroids[lab].size() != 2) { accurate = false; continue; }
        const vector<double>& c = fin.centroids[lab];
        if (hypot(c[0] - centers[bi][0], c[1] - centers[bi][1]) > 0.8) accurate = false;
    }
    __check("each blob ends in ONE cluster", coherent, true);
    __check("the three blobs get three different clusters", distinct, true);
    __check("centroids sit on the blob centers", accurate, true);
    return 0;
}`,
      hint: "history.push_back({centroids, labels}) copies both vectors, so there's no aliasing to worry about. Keep per-cluster sums and counts in vectors sized k.",
      hint_hy: "history.push_back({centroids, labels})-ը պատճենում է երկու վեկտորն էլ, այնպես որ միևնույն օբյեկտին հղումների մասին անհանգստանալու կարիք չկա։ Յուրաքանչյուր կլաստերի գումարներն ու քանակները պահի՛ր k չափի վեկտորներում։",
    },

    "lab-perceptron": {
      fnName: "trainPerceptron",
      prelude: `struct Point { double x, y; int label; };
struct Weights { double w1, w2, b; };`,
      starter: `// Given: struct Point { double x, y; int label; };  (label 0 or 1)
//        struct Weights { double w1, w2, b; };
// Return one Weights snapshot per epoch.
vector<Weights> trainPerceptron(vector<Point> data, int epochs) {
    double w1 = 0, w2 = 0, b = 0;
    const double lr = 0.1;
    vector<Weights> history;
    // for each epoch: for each point -> predict, compute err, update
    // then history.push_back({w1, w2, b});
    return history;
}`,
      tests: `int main() {
    vector<Point> data = {
        {1, 2, 0}, {2, 1, 0}, {1.5, 1.8, 0}, {0.8, 1.2, 0}, {2.2, 2.5, 0},
        {6, 5, 1}, {7, 6, 1}, {6.5, 4.8, 1}, {7.5, 5.5, 1}, {6.2, 6.3, 1},
    };
    vector<Weights> hist = trainPerceptron(data, 20);
    __check("one snapshot per epoch", hist.size(), 20);
    if (hist.empty()) return 0;
    Weights f = hist.back();
    int correct = 0;
    for (const Point& p : data) {
        int pred = f.w1 * p.x + f.w2 * p.y + f.b >= 0 ? 1 : 0;
        if (pred == p.label) correct++;
    }
    __check("final boundary classifies all 10 points", correct, 10);
    __check("weights actually moved", fabs(f.w1) + fabs(f.w2) > 0, true);
    return 0;
}`,
    },

    "lab-mlp-xor": {
      fnName: "trainXOR",
      prelude: `struct Network {
    vector<vector<double>> W1;   // 4 x 2
    vector<double> b1;           // 4
    vector<double> W2;           // 4
    double b2 = 0;
    vector<double> lossHistory;  // average loss, once per epoch
};`,
      starter: `// Given: struct Network { W1 (4x2), b1 (4), W2 (4), b2, lossHistory };
// In C++ the network is its weights: trainXOR() returns them trained,
// and forward() runs them (the tests call it as your predict).

// Forward pass: fill h with the 4 hidden (tanh) activations and
// return the prediction p (the sigmoid output).
double forward(const Network& net, double x1, double x2, vector<double>& h) {
    h.assign(4, 0.0);
    return 0.5;
}

// Build and train a 2-4-1 network on XOR; return it trained.
Network trainXOR() {
    const double X[4][2] = {{0, 0}, {0, 1}, {1, 0}, {1, 1}};
    const double Y[4] = {0, 1, 1, 0};
    Network net;
    // fixed starting weights: everyone converges the same way
    net.W1 = {{0.5, -0.4}, {0.3, 0.8}, {-0.6, 0.2}, {0.7, -0.3}};
    net.b1 = {0.1, -0.2, 0.05, 0.15};
    net.W2 = {0.4, -0.5, 0.6, 0.3};
    net.b2 = 0.05;
    const double lr = 0.5;
    const int epochs = 4000;
    vector<double> h;
    for (int e = 0; e < epochs; e++) {
        double loss = 0;
        for (int s = 0; s < 4; s++) {
            // p = forward(net, X[s][0], X[s][1], h); add (p - Y[s])^2 to loss,
            // backward (formulas in the brief), update all of net's weights
        }
        net.lossHistory.push_back(loss / 4);
    }
    return net;
}`,
      tests: `int main() {
    Network net = trainXOR();
    __check("returns the trained weights", net.W1.size() == 4 && net.b1.size() == 4 && net.W2.size() == 4, true);
    vector<double> h;
    auto predict = [&](double a, double b) { return forward(net, a, b, h); };
    __check("(0,0) -> ~0", predict(0, 0) < 0.3, true);
    __check("(1,1) -> ~0", predict(1, 1) < 0.3, true);
    __check("(0,1) -> ~1", predict(0, 1) > 0.7, true);
    __check("(1,0) -> ~1", predict(1, 0) > 0.7, true);
    const vector<double>& L = net.lossHistory;
    __check("loss went DOWN during training", L.size() >= 2 && L.front() > L.back() * 3, true);
    return 0;
}`,
      hint: "tanh() and exp() come from <cmath>. Compute every gradient for the sample first, then update the weights, so the update uses the same weights the forward pass did.",
      hint_hy: "tanh()-ն ու exp()-ը <cmath>-ից են։ Նախ հաշվի՛ր նմուշի բոլոր գրադիենտները, հետո թարմացրո՛ւ կշիռները, որպեսզի թարմացումն օգտագործի նույն կշիռները, ինչ ուղիղ անցումը։",
    },
  };

  for (const p of window.ACADEMY_1991.lab) {
    if (CPP[p.id]) p.cpp = CPP[p.id];
  }
})();
