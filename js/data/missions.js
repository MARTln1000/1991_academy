/* 1991 Academy — Cross-track missions.
   Real coding challenges that combine ideas from several tracks.
   Locked until their prerequisite lessons are completed. */
window.MARTINIUM = window.MARTINIUM || { tracks: {}, order: [] };

window.MARTINIUM.missions = [
  {
    id: "mission-autocomplete",
    title: "Instant Search Box",
    icon: "🔎",
    tracks: ["web", "dsa"],
    prereqs: ["web-2-1", "dsa-2-1"],
    xp: 60,
    blurb: "A search box that filters 200,000 entries as you type — sorted data plus binary search makes it instant.",
    brief: `
<p>Your product has a search box over a <strong>sorted</strong> dictionary of 200,000 entries. A naive scan on every keystroke burns CPU; because the list is sorted, all matches for a prefix sit in one <em>contiguous block</em>.</p>
<p>Write <code>autocomplete(sortedWords, prefix)</code>: return every word starting with <code>prefix</code>, in order. Use binary search to locate the first match, then collect until words stop matching — O(log n + k) instead of O(n).</p>`,
    starter: `// sortedWords: alphabetically sorted array of strings
// Return ALL words that start with prefix, in order.
// Fast plan: binary-search the first word >= prefix,
// then walk forward while words start with prefix.
function autocomplete(sortedWords, prefix) {
  // your code here
  return [];
}`,
    tests: `
var words = ["apple", "apricot", "banana", "band", "bandana", "canary", "cat"];
__check("finds all 'ap' words", autocomplete(words, "ap"), ["apple", "apricot"]);
__check("finds all 'ban' words", autocomplete(words, "ban"), ["banana", "band", "bandana"]);
__check("single match", autocomplete(words, "cat"), ["cat"]);
__check("no match returns []", autocomplete(words, "zebra"), []);
__check("empty prefix returns everything", autocomplete(words, ""), words);
var big = [];
for (var i = 0; i < 200000; i++) big.push("w" + ("000000" + i).slice(-6));
__check("200k words: exact hit", autocomplete(big, "w000123"), ["w000123"]);
__check("200k words: prefix block", autocomplete(big, "w19999").length, 10);
`,
    hints: [
      "Binary search for the boundary: find the first index where the word is >= prefix (the lesson on monotonic predicates applies directly).",
      "After landing on the first candidate, a simple while-loop with startsWith(prefix) collects the whole block.",
    ],
  },
  {
    id: "mission-undo",
    title: "Undo/Redo Engine",
    icon: "↩️",
    tracks: ["web", "dsa"],
    prereqs: ["web-2-1", "dsa-1-3"],
    xp: 60,
    blurb: "Every editor's Ctrl+Z is two stacks talking to each other. Build the brain behind it.",
    brief: `
<p>Undo/redo is the textbook stacks problem hiding inside every real app. Build the state engine of a tiny text editor.</p>
<p><code>createEditor()</code> returns an object with <code>type(str)</code> (append text), <code>undo()</code>, <code>redo()</code>, and <code>getText()</code>. Classic rules: undo reverts the latest <code>type</code>, redo re-applies the latest undo, and typing something new <strong>clears the redo history</strong> — just like your editor does.</p>`,
    starter: `// Two stacks: one of past states (for undo),
// one of undone states (for redo).
function createEditor() {
  return {
    type(str) { /* append str to the text */ },
    undo() { /* revert the last type() */ },
    redo() { /* re-apply the last undone type() */ },
    getText() { return ""; },
  };
}`,
    tests: `
var ed = createEditor();
ed.type("Hello");
ed.type(" world");
__check("typing appends", ed.getText(), "Hello world");
ed.undo();
__check("undo reverts last type", ed.getText(), "Hello");
ed.redo();
__check("redo restores it", ed.getText(), "Hello world");
ed.undo(); ed.undo();
__check("undo twice reaches empty", ed.getText(), "");
ed.undo();
__check("undo on empty is safe", ed.getText(), "");
ed.redo(); ed.redo();
__check("redo twice restores both", ed.getText(), "Hello world");
var ed2 = createEditor();
ed2.type("a"); ed2.type("b"); ed2.undo(); ed2.type("c"); ed2.redo();
__check("new typing clears redo", ed2.getText(), "ac");
`,
    hints: [
      "Keep a history stack of full text snapshots. type() pushes the current text before changing it; undo() pushes current text onto a redo stack and pops history.",
      "type() must empty the redo stack — that's the 'branching history' rule editors follow.",
    ],
  },
  {
    id: "mission-maze",
    title: "Shortest Path Through the Grid",
    icon: "🗺️",
    tracks: ["dsa"],
    prereqs: ["dsa-1-3", "dsa-2-2"],
    xp: 60,
    blurb: "Game pathfinding, network routing, puzzle solvers — all the same BFS you're about to write.",
    brief: `
<p>A robot starts at the top-left of a grid and must reach the bottom-right. <code>0</code> is open floor, <code>1</code> is a wall; moves are up/down/left/right.</p>
<p>Write <code>shortestPath(grid)</code> returning the <strong>minimum</strong> number of moves, or <code>-1</code> if the goal is unreachable. Depth-first exploration finds <em>a</em> path — only breadth-first guarantees the <em>shortest</em> one. The queue from the data-structures lesson is your engine.</p>`,
    starter: `// grid: 2D array of 0 (open) / 1 (wall)
// Start [0,0], goal [rows-1][cols-1].
// Return minimum moves, or -1 if unreachable.
function shortestPath(grid) {
  // queue of [row, col, distance]; mark visited or loop forever
  return -1;
}`,
    tests: `
__check("straight line", shortestPath([[0, 0, 0]]), 2);
__check("simple detour", shortestPath([
  [0, 1, 0],
  [0, 1, 0],
  [0, 0, 0]
]), 4);
__check("unreachable", shortestPath([
  [0, 1],
  [1, 0]
]), -1);
__check("single cell", shortestPath([[0]]), 0);
__check("blocked start", shortestPath([[1, 0], [0, 0]]), -1);
__check("bigger maze", shortestPath([
  [0, 0, 1, 0, 0],
  [1, 0, 1, 0, 1],
  [0, 0, 0, 0, 0],
  [0, 1, 1, 1, 0],
  [0, 0, 0, 0, 0]
]), 8);
`,
    hints: [
      "BFS skeleton: push [0,0,0] into a queue; repeatedly shift, try the 4 neighbors, skip walls/visited/out-of-bounds, push [r,c,dist+1].",
      "Mark cells visited when you ENQUEUE them (not when you pop) — and check the start cell isn't a wall before you begin.",
    ],
  },
  {
    id: "mission-recommender",
    title: "Mini Recommender",
    icon: "🎬",
    tracks: ["ml", "dsa"],
    prereqs: ["ml-1-2", "dsa-1-2"],
    xp: 60,
    blurb: "\"Because you watched…\" is a dot product. Rank items by taste-vector similarity.",
    brief: `
<p>Every recommender's core move: represent tastes as vectors, measure similarity, sort. A user's taste vector and each item's feature vector live in the same space; <strong>cosine similarity</strong> — the dot product scaled by lengths — scores the match.</p>
<p>Write <code>recommend(userVec, items, k)</code> returning the <strong>names</strong> of the top-<code>k</code> items by cosine similarity, highest first. <code>cosine(a, b) = dot(a, b) / (|a| · |b|)</code>.</p>`,
    starter: `// userVec: number[]
// items: [{ name: string, vec: number[] }]
// Return names of the k most similar items, best first.
function recommend(userVec, items, k) {
  // dot(a,b) = sum of a[i]*b[i];  |a| = sqrt(dot(a,a))
  return [];
}`,
    tests: `
var items = [
  { name: "action-movie", vec: [9, 1, 0] },
  { name: "romcom", vec: [1, 9, 0] },
  { name: "documentary", vec: [0, 2, 9] },
  { name: "thriller", vec: [7, 2, 1] }
];
__check("action fan: action first, thriller second", recommend([10, 1, 0], items, 2), ["action-movie", "thriller"]);
__check("documentary lover", recommend([0, 1, 8], items, 1), ["documentary"]);
__check("k larger than catalog returns all", recommend([1, 1, 1], items, 10).length, 4);
__check("returns names, not objects", typeof recommend([1, 0, 0], items, 1)[0], "string");
`,
    hints: [
      "Write a small dot(a, b) helper first; magnitude is Math.sqrt(dot(a, a)). Score every item, keep {name, score} pairs.",
      "Sort pairs by score descending, slice(0, k), then map to names.",
    ],
  },
  {
    id: "mission-ratelimiter",
    title: "API Rate Limiter",
    icon: "🚦",
    tracks: ["web", "dsa"],
    prereqs: ["web-2-2", "dsa-1-3"],
    xp: 60,
    blurb: "Every real API says 429 Too Many Requests sometimes. The sliding window behind it is a queue.",
    brief: `
<p>Your API allows <code>maxCalls</code> requests per <code>windowMs</code> milliseconds per client — the guard that turns abuse into a polite <code>429</code>.</p>
<p>Write <code>createLimiter(maxCalls, windowMs)</code> returning a function <code>allow(t)</code> (t = timestamp in ms). It returns <code>true</code> if fewer than <code>maxCalls</code> <em>allowed</em> calls happened in <code>(t - windowMs, t]</code>, else <code>false</code>. Denied calls don't count against the window. A queue of timestamps — evict the expired ones from the front — is the classic sliding-window implementation.</p>`,
    starter: `// Sliding window rate limiter.
// allow(t): true if fewer than maxCalls ALLOWED calls
// happened in the window (t - windowMs, t].
function createLimiter(maxCalls, windowMs) {
  // keep allowed timestamps in an array-as-queue
  return function allow(t) {
    return true;
  };
}`,
    tests: `
var allow = createLimiter(3, 1000);
__check("first three pass", [allow(0), allow(100), allow(200)], [true, true, true]);
__check("fourth inside window blocked", allow(300), false);
__check("still blocked at window edge", allow(999), false);
__check("oldest expires, allowed again", allow(1001), true);
var a2 = createLimiter(1, 100);
__check("independent limiter state", a2(0), true);
__check("blocked inside its window", a2(50), false);
__check("free after the window passes", a2(151), true);
`,
    hints: [
      "Keep an array of allowed timestamps. On each allow(t): first shift() off timestamps <= t - windowMs, then compare length with maxCalls.",
      "Only push t when the call is allowed — denied requests never join the queue.",
    ],
  },
  {
    id: "mission-retriever",
    title: "Tiny RAG Retriever",
    icon: "📚",
    tracks: ["agents", "ml"],
    prereqs: ["agents-2-1", "ml-2-1"],
    xp: 60,
    blurb: "The retrieval half of RAG in 20 lines: score documents against a query, return the best.",
    brief: `
<p>Before an AI agent can answer from your docs, something must pick <em>which</em> docs it sees — that retriever decides whether the whole system works.</p>
<p>Write <code>retrieve(query, docs, k)</code>: score each doc by how many <strong>unique query words</strong> appear in its text (case-insensitive), return the top-<code>k</code> doc <code>id</code>s, best first. Ties keep original document order — a stable ranking, exactly like real search engines default to.</p>`,
    starter: `// query: string, docs: [{ id, text }]
// Score = number of UNIQUE query words present in the doc
// (case-insensitive). Ties keep original doc order.
// Return the top-k ids, best first.
function retrieve(query, docs, k) {
  return [];
}`,
    tests: `
var docs = [
  { id: "auth", text: "Reset your password from the account security page" },
  { id: "billing", text: "Update your credit card and billing address" },
  { id: "intro", text: "Welcome to the product this page explains the basics" },
  { id: "sso", text: "Configure single sign on with your identity provider password policy" }
];
__check("password query ranks auth first", retrieve("reset password", docs, 2), ["auth", "sso"]);
__check("billing query", retrieve("credit card billing", docs, 1), ["billing"]);
__check("case insensitive", retrieve("PASSWORD Reset", docs, 1), ["auth"]);
__check("k caps the results", retrieve("page", docs, 10).length, 2);
__check("ties keep original order", retrieve("your", docs, 2), ["auth", "billing"]);
`,
    hints: [
      "Lowercase both sides. Split the query into a Set of words; split each doc's text into a Set too; count query words the doc's set contains.",
      "Score every doc as {id, score}, drop the zero-score ones, sort by score descending (Array.prototype.sort is stable, so ties keep document order), then slice(0, k) and map to ids.",
    ],
  },
];
