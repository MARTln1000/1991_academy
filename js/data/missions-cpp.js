/* 1991 Academy — C++ variants for every mission.
   Attaches .cpp = { fnName, starter, tests, prelude?, hint?, hint_hy? } to the
   missions in js/data/missions.js. Compiled and run on the server, in the
   sandboxed runner container; __check(name, actual, expected) reports each
   test (app.py has the harness). `prelude` holds the types a mission gives
   the learner (its structs), compiled ahead of their code; `hint` is one
   extra hint shown only in C++. Load AFTER js/data/missions.js. */
(function () {
  const CPP = {
    "mission-autocomplete": {
      fnName: "autocomplete",
      starter: `// sortedWords: alphabetically sorted words.
// Return ALL words that start with prefix, in order.
// Fast plan: binary-search the first word >= prefix,
// then walk forward while words start with prefix.
vector<string> autocomplete(const vector<string>& sortedWords, const string& prefix) {
    // your code here
    return {};
}`,
      tests: `int main() {
    vector<string> words = {"apple", "apricot", "banana", "band", "bandana", "canary", "cat"};
    __check("finds all 'ap' words", autocomplete(words, "ap"), vector<string>{"apple", "apricot"});
    __check("finds all 'ban' words", autocomplete(words, "ban"), vector<string>{"banana", "band", "bandana"});
    __check("single match", autocomplete(words, "cat"), vector<string>{"cat"});
    __check("no match returns {}", autocomplete(words, "zebra"), vector<string>{});
    __check("empty prefix returns everything", autocomplete(words, ""), words);
    vector<string> big;
    char buf[16];
    for (int i = 0; i < 200000; i++) { snprintf(buf, sizeof buf, "w%06d", i); big.push_back(buf); }
    __check("200k words: exact hit", autocomplete(big, "w000123"), vector<string>{"w000123"});
    __check("200k words: prefix block", autocomplete(big, "w19999").size(), 10);
    return 0;
}`,
      hint: "std::lower_bound(sortedWords.begin(), sortedWords.end(), prefix) is exactly the binary search for the first word >= prefix. word.compare(0, prefix.size(), prefix) == 0 checks that word starts with prefix.",
      hint_hy: "std::lower_bound(sortedWords.begin(), sortedWords.end(), prefix)-ը հենց prefix-ից մեծ կամ հավասար առաջին բառի երկուական որոնումն է։ word.compare(0, prefix.size(), prefix) == 0-ն ստուգում է, որ word-ը սկսվում է prefix-ով։",
    },

    "mission-undo": {
      fnName: "Editor",
      starter: `// Two stacks: one of past states (for undo),
// one of undone states (for redo).
class Editor {
public:
    void type(const string& text) { /* append text */ }
    void undo() { /* revert the last type() */ }
    void redo() { /* re-apply the last undone type() */ }
    string getText() { return ""; }
};`,
      tests: `int main() {
    Editor ed;
    ed.type("Hello");
    ed.type(" world");
    __check("typing appends", ed.getText(), string("Hello world"));
    ed.undo();
    __check("undo reverts last type", ed.getText(), string("Hello"));
    ed.redo();
    __check("redo restores it", ed.getText(), string("Hello world"));
    ed.undo(); ed.undo();
    __check("undo twice reaches empty", ed.getText(), string(""));
    ed.undo();
    __check("undo on empty is safe", ed.getText(), string(""));
    ed.redo(); ed.redo();
    __check("redo twice restores both", ed.getText(), string("Hello world"));
    Editor ed2;
    ed2.type("a"); ed2.type("b"); ed2.undo(); ed2.type("c"); ed2.redo();
    __check("new typing clears redo", ed2.getText(), string("ac"));
    return 0;
}`,
      hint: "Two stack<string> members plus the current text. Check empty() before top() and pop(): popping an empty stack is undefined behavior, not an error message.",
      hint_hy: "Երկու stack<string> անդամ գումարած ընթացիկ տեքստը։ top()-ից և pop()-ից առաջ ստուգի՛ր empty()-ն. դատարկ ստեկից pop անելը չսահմանված վարք է, ոչ թե սխալի հաղորդագրություն։",
    },

    "mission-maze": {
      fnName: "shortestPath",
      starter: `// grid: rows of 0 (open) / 1 (wall)
// Start {0,0}, goal {rows-1, cols-1}.
// Return minimum moves, or -1 if unreachable.
int shortestPath(const vector<vector<int>>& grid) {
    // queue of {row, col, distance}; mark visited or loop forever
    return -1;
}`,
      tests: `int main() {
    __check("straight line", shortestPath({{0, 0, 0}}), 2);
    __check("simple detour", shortestPath({
        {0, 1, 0},
        {0, 1, 0},
        {0, 0, 0},
    }), 4);
    __check("unreachable", shortestPath({
        {0, 1},
        {1, 0},
    }), -1);
    __check("single cell", shortestPath({{0}}), 0);
    __check("blocked start", shortestPath({{1, 0}, {0, 0}}), -1);
    __check("bigger maze", shortestPath({
        {0, 0, 1, 0, 0},
        {1, 0, 1, 0, 1},
        {0, 0, 0, 0, 0},
        {0, 1, 1, 1, 0},
        {0, 0, 0, 0, 0},
    }), 8);
    return 0;
}`,
      hint: "queue<array<int, 3>> holds {row, col, distance}; a vector<vector<bool>> visited grid the same size as the maze stops you from walking in circles.",
      hint_hy: "queue<array<int, 3>>-ը պահում է {row, col, distance}. լաբիրինթոսի չափի vector<vector<bool>> visited ցանցը թույլ չի տալիս պտույտներ գործել։",
    },

    "mission-recommender": {
      fnName: "recommend",
      prelude: `struct Item { string name; vector<double> vec; };`,
      starter: `// Given: struct Item { string name; vector<double> vec; };
// Return names of the k most similar items, best first.
vector<string> recommend(const vector<double>& userVec, const vector<Item>& items, int k) {
    // dot(a,b) = sum of a[i]*b[i];  |a| = sqrt(dot(a,a))
    return {};
}`,
      tests: `int main() {
    vector<Item> items = {
        {"action-movie", {9, 1, 0}},
        {"romcom", {1, 9, 0}},
        {"documentary", {0, 2, 9}},
        {"thriller", {7, 2, 1}},
    };
    __check("action fan: action first, thriller second", recommend({10, 1, 0}, items, 2), vector<string>{"action-movie", "thriller"});
    __check("documentary lover", recommend({0, 1, 8}, items, 1), vector<string>{"documentary"});
    __check("k larger than catalog returns all", recommend({1, 1, 1}, items, 10).size(), 4);
    __check("pure action taste", recommend({1, 0, 0}, items, 1), vector<string>{"action-movie"});
    return 0;
}`,
      hint: "Score into a vector<pair<double, string>>, sort it with a comparator that puts higher scores first, and take min(k, size) names. Mind k larger than the catalog.",
      hint_hy: "Միավորները լցրո՛ւ vector<pair<double, string>>-ի մեջ, դասավորի՛ր այն համեմատիչով, որ ավելի բարձր միավորները դնում է առաջ, և վերցրո՛ւ min(k, size) անուն։ Հաշվի՛ առ, որ k-ն կարող է կատալոգից մեծ լինել։",
    },

    "mission-ratelimiter": {
      fnName: "RateLimiter",
      starter: `// Sliding window rate limiter.
// allow(t): true if fewer than maxCalls ALLOWED calls
// happened in the window (t - windowMs, t].
class RateLimiter {
public:
    RateLimiter(int maxCalls, int windowMs) {
        // remember the settings; keep allowed timestamps in a queue
    }
    bool allow(long long t) {
        return true;
    }
};`,
      tests: `int main() {
    RateLimiter limiter(3, 1000);
    bool a = limiter.allow(0), b = limiter.allow(100), c = limiter.allow(200);
    __check("first three pass", vector<bool>{a, b, c}, vector<bool>{true, true, true});
    __check("fourth inside window blocked", limiter.allow(300), false);
    __check("still blocked at window edge", limiter.allow(999), false);
    __check("oldest expires, allowed again", limiter.allow(1001), true);
    RateLimiter l2(1, 100);
    __check("independent limiter state", l2.allow(0), true);
    __check("blocked inside its window", l2.allow(50), false);
    __check("free after the window passes", l2.allow(151), true);
    return 0;
}`,
      hint: "A deque<long long> member: pop_front() the timestamps <= t - windowMs, then compare size() with maxCalls, and push_back(t) only when you allow.",
      hint_hy: "deque<long long> անդամ. pop_front() արա t - windowMs-ից փոքր կամ հավասար ժամանակադրոշմները, հետո size()-ը համեմատի՛ր maxCalls-ի հետ, իսկ push_back(t)՝ միայն թույլ տալիս։",
    },

    "mission-retriever": {
      fnName: "retrieve",
      prelude: `struct Doc { string id; string text; };`,
      starter: `// Given: struct Doc { string id; string text; };
// Score = number of UNIQUE query words present in the doc
// (case-insensitive). Ties keep original doc order.
// Return the top-k ids, best first.
vector<string> retrieve(const string& query, const vector<Doc>& docs, int k) {
    return {};
}`,
      tests: `int main() {
    vector<Doc> docs = {
        {"auth", "Reset your password from the account security page"},
        {"billing", "Update your credit card and billing address"},
        {"intro", "Welcome to the product this page explains the basics"},
        {"sso", "Configure single sign on with your identity provider password policy"},
    };
    __check("password query ranks auth first", retrieve("reset password", docs, 2), vector<string>{"auth", "sso"});
    __check("billing query", retrieve("credit card billing", docs, 1), vector<string>{"billing"});
    __check("case insensitive", retrieve("PASSWORD Reset", docs, 1), vector<string>{"auth"});
    __check("k caps the results", retrieve("page", docs, 10).size(), 2);
    __check("ties keep original order", retrieve("your", docs, 2), vector<string>{"auth", "billing"});
    return 0;
}`,
      hint: "std::sort does NOT keep equal elements in order; std::stable_sort does. Split words with an istringstream (>> reads one word at a time), lowercase each char with tolower, and collect them in a set<string>.",
      hint_hy: "std::sort-ը ՉԻ պահում հավասար տարրերի կարգը, std::stable_sort-ը պահում է։ Բառերը բաժանի՛ր istringstream-ով (>>-ը կարդում է մեկ բառ), յուրաքանչյուր նիշ փոքրատառի՛ր tolower-ով և հավաքի՛ր set<string>-ում։",
    },
  };

  for (const m of window.ACADEMY_1991.missions) {
    if (CPP[m.id]) m.cpp = CPP[m.id];
  }
})();
