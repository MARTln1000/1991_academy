/* 1991 Academy track: Algorithms & Data Structures */
window.MARTINIUM = window.MARTINIUM || { tracks: {}, order: [] };

window.MARTINIUM.tracks.dsa = {
  id: "dsa",
  title: "Algorithms & Data Structures",
  tagline: "Big-O thinking, the classic structures, and the patterns behind every interview and every fast program.",
  icon: "🧩",
  accent: "#fb7185",
  accentSoft: "rgba(251, 113, 133, 0.14)",
  modules: [
    {
      id: "dsa-m1",
      title: "The Mental Toolkit",
      lessons: [
        {
          id: "dsa-1-1",
          title: "Big-O: Thinking in Growth Rates",
          minutes: 12,
          videos: [
            { id: "RBSGKlAvoiM", title: "Data Structures Easy to Advanced — full course", channel: "freeCodeCamp", length: "8 h" },
          ],
          content: `
<p>Big-O notation answers one question: <em>when the input gets big, how fast does the work grow?</em> It ignores constants and hardware — it's about the <strong>shape</strong> of the curve.</p>
<h3>The ladder you must know cold</h3>
<pre><code>O(1)       constant   — hash lookup, array index
O(log n)   logarithmic— binary search: halve the problem each step
O(n)       linear     — one pass through the data
O(n log n) — good sorting (merge sort, quicksort avg)
O(n²)      quadratic  — nested loops over the same data
O(2ⁿ)      exponential— brute-force subsets; dead by n≈40</code></pre>
<p>Feel the difference at n = 1,000,000: <code>log n ≈ 20</code> steps, <code>n</code> = a million, <code>n²</code> = a <em>trillion</em>. Complexity classes aren't pedantry — they're the difference between milliseconds and "comes back next week".</p>
<h3>Reading code for complexity</h3>
<ul>
<li>Sequential blocks <strong>add</strong> → keep the biggest term: O(n + n²) = O(n²).</li>
<li>Nested loops <strong>multiply</strong>: outer n × inner n = O(n²).</li>
<li>"Halve every step" whispers <strong>O(log n)</strong>; "do log-work n times" is O(n log n).</li>
</ul>
<h3>Space counts too</h3>
<p>O(1) extra space (in-place) vs. O(n) (a copy) is a real trade-off — many classic algorithm choices are time-vs-space bargains.</p>
<div class="callout">💡 <span>Interview reflex worth training: after writing any solution, state its time and space complexity <em>unprompted</em> — then ask yourself which structure would shave a factor of n.</span></div>`,
          takeaways: [
            "Big-O describes growth shape, ignoring constants and hardware.",
            "Know the ladder: 1 → log n → n → n log n → n² → 2ⁿ.",
            "Sequential adds (keep max); nested multiplies; halving means log.",
            "Always state time AND space; most speedups trade one for the other.",
          ],
          quiz: [
            {
              q: "A loop over n items, and inside it a binary search over the same n items. Total complexity?",
              options: ["O(n)", "O(n log n)", "O(n²)", "O(log n)"],
              answer: 1,
              explain: "n iterations × log n work each = O(n log n). Nested work multiplies.",
            },
            {
              q: "Which growth rate makes an algorithm unusable at n ≈ 50?",
              options: ["O(n log n)", "O(n²)", "O(2ⁿ)", "O(n)"],
              answer: 2,
              explain: "2⁵⁰ ≈ 10¹⁵ operations — years of compute. Exponential algorithms die at small n; n² at 50 is a trivial 2,500.",
            },
            {
              q: "Two sequential loops: one O(n), then one O(n²). Overall?",
              options: ["O(n³)", "O(n² + n) = O(n²)", "O(n log n)", "O(2n)"],
              answer: 1,
              explain: "Sequential blocks add, and Big-O keeps the dominant term: n² swallows n.",
            },
          ],
        },
        {
          id: "dsa-1-2",
          title: "Arrays, Hash Maps & the Two-Pointer Pattern",
          minutes: 14,
          content: `
<p>Two structures cover a huge share of practical problems — and one pattern between them unlocks dozens of interview classics.</p>
<h3>Arrays: contiguous and cache-friendly</h3>
<pre><code>access by index   O(1)
search unsorted   O(n)
insert/delete mid O(n)   ← everything after must shift</code></pre>
<h3>Hash maps: the O(1) cheat code</h3>
<p>A hash function turns a key into a bucket index — lookup, insert and delete in O(1) average. The single most common interview optimization is <strong>"replace the inner loop with a hash map"</strong>:</p>
<pre><code>// Two Sum: find i, j with nums[i] + nums[j] = target
// brute force: check all pairs — O(n²)
// hash map: one pass — O(n)
seen = {}
for i, x in enumerate(nums):
    if target - x in seen:  return [seen[target - x], i]
    seen[x] = i</code></pre>
<p>You trade O(n) memory for an O(n²) → O(n) speedup. Learn to smell that trade.</p>
<h3>Two pointers: exploit order</h3>
<p>When data is <strong>sorted</strong> (or you can sort it), two indices walking toward each other replace nested loops:</p>
<pre><code>// pair with given sum, sorted array — O(n)
lo, hi = 0, n - 1
while lo &lt; hi:
    s = a[lo] + a[hi]
    if s == target: found
    elif s &lt; target: lo += 1   # need bigger sum
    else:            hi -= 1   # need smaller sum</code></pre>
<p>Cousins of the pattern: <strong>sliding window</strong> (longest substring without repeats), fast/slow pointers (cycle detection), merge step of merge sort.</p>
<div class="callout">💡 <span>Pattern recognition beats memorization. "Pairs / counting / seen-before" → hash map. "Sorted + pairs / window over subarray" → two pointers. Most medium problems are one of ~15 such patterns wearing a costume.</span></div>`,
          takeaways: [
            "Arrays: O(1) access, O(n) mid-insertion; contiguous memory is fast in practice.",
            "Hash maps buy O(1) lookups with O(n) memory — the classic n² → n move.",
            "Two pointers/sliding window exploit sortedness to kill nested loops.",
            "Learn patterns, not individual problems.",
          ],
          exercises: [
            {
              type: "order",
              title: "Assemble the two-pointer pair-sum",
              prompt: "Order the lines so the sorted-array pair search works in O(n). Indentation is your friend.",
              lines: [
                "let lo = 0, hi = n - 1;",
                "while (lo < hi) {",
                "  const s = a[lo] + a[hi];",
                "  if (s === target) return [lo, hi];",
                "  if (s < target) lo++; else hi--;",
                "}",
              ],
            },
          ],
          quiz: [
            {
              q: "Why does the hash-map version of Two Sum run in O(n)?",
              options: [
                "Hash maps sort the data automatically",
                "Each element is processed once with O(1) average lookups",
                "It skips half the array",
                "It doesn't — it's O(n log n)",
              ],
              answer: 1,
              explain: "One pass, and each 'have I seen the complement?' check is an O(1) average hash lookup: n × O(1) = O(n).",
            },
            {
              q: "The two-pointer inward walk requires the array to be…",
              options: ["Non-empty only", "Sorted", "All positive", "Of even length"],
              answer: 1,
              explain: "The moves 'need bigger → lo++' and 'need smaller → hi--' are only valid because order guarantees direction of change.",
            },
            {
              q: "Inserting an element into the middle of an array of n items costs…",
              options: ["O(1)", "O(log n)", "O(n) — later elements must shift", "O(n²)"],
              answer: 2,
              explain: "Contiguous memory means every element after the insertion point shifts one slot: linear cost.",
            },
          ],
        },
        {
          id: "dsa-1-3",
          title: "Stacks, Queues & Linked Lists",
          minutes: 12,
          content: `
<p>Three linear structures, three disciplines of access. Choosing between them is choosing <em>which operations you make cheap</em>.</p>
<h3>Stack — LIFO (last in, first out)</h3>
<pre><code>push(x), pop(), peek()   — all O(1)</code></pre>
<p>Where it appears: undo history, the call stack (recursion <em>is</em> a stack), matched-brackets validation, backtracking, depth-first search. The bracket classic:</p>
<pre><code>for ch in text:
    if ch is opener: push(ch)
    if ch is closer:
        if pop() doesn't match ch → invalid
valid if stack empty at end</code></pre>
<h3>Queue — FIFO (first in, first out)</h3>
<pre><code>enqueue(x), dequeue()    — O(1)</code></pre>
<p>Where it appears: task/print/message queues, rate limiters, and <strong>breadth-first search</strong> — processing things in the order discovered. (A <em>deque</em> serves both ends; a <em>priority queue/heap</em> always serves the smallest/largest in O(log n).)</p>
<h3>Linked list — chase the pointers</h3>
<pre><code>node: [value | next] → [value | next] → null
insert/delete at a known node  O(1)   ← the superpower
access by index                O(n)   ← the price</code></pre>
<p>Exactly inverted trade-offs vs. arrays. In practice arrays win most fights (cache locality), but linked lists power LRU caches, adjacency lists, and are an interview staple: reversal, cycle detection (fast/slow pointers), merging.</p>
<div class="callout">💡 <span>Interview tell: "process most-recent first" → stack. "Process in arrival order" / "shortest path in unweighted graph" → queue. "O(1) insert/remove at both ends given the node" → linked list / deque.</span></div>`,
          takeaways: [
            "Stack = LIFO: undo, recursion, brackets, DFS.",
            "Queue = FIFO: schedulers, buffers, BFS. Heaps serve by priority in O(log n).",
            "Linked lists: O(1) splice at a node, O(n) access — the mirror image of arrays.",
            "Pick the structure by which operation must be cheap.",
          ],
          quiz: [
            {
              q: "Which structure naturally implements 'undo'?",
              options: ["Queue", "Stack", "Hash map", "Binary tree"],
              answer: 1,
              explain: "Undo reverses the most recent action first — exactly LIFO. Push each action; pop to undo.",
            },
            {
              q: "BFS uses a queue because…",
              options: [
                "Queues are faster than stacks",
                "It must explore nodes in the order they were discovered, layer by layer",
                "Recursion is forbidden in graphs",
                "Queues prevent cycles automatically",
              ],
              answer: 1,
              explain: "FIFO ordering guarantees all depth-k nodes are processed before any depth-k+1 node — the essence of breadth-first.",
            },
            {
              q: "Compared to arrays, linked lists are better at…",
              options: [
                "Random access by index",
                "Cache-friendly iteration",
                "O(1) insertion/deletion at a node you already hold",
                "Binary search",
              ],
              answer: 2,
              explain: "Re-wiring two pointers splices a node in constant time — no shifting. The cost: reaching a position is O(n).",
            },
          ],
        },
      ],
    },
    {
      id: "dsa-m2",
      title: "Classic Algorithms",
      lessons: [
        {
          id: "dsa-2-1",
          title: "Sorting & Binary Search",
          minutes: 13,
          content: `
<p>Sorting is the gateway drug of algorithms: the first place you feel the gap between O(n²) and O(n log n) — and sorted data unlocks the fastest search there is.</p>
<h3>The sorts worth knowing</h3>
<pre><code>bubble/insertion  O(n²)      teaching tools; insertion wins on tiny/nearly-sorted data
merge sort        O(n log n) split → sort halves → merge; stable; O(n) extra space
quicksort         O(n log n) avg; in-place; the default in many stdlibs
heapsort          O(n log n) guaranteed, in-place; rarely hand-written</code></pre>
<p>The O(n log n) shape comes from divide &amp; conquer: log n levels of splitting × O(n) work per level. In practice: <strong>call your language's sort</strong> — it's a tuned hybrid (Timsort, introsort) — but know the machinery behind it.</p>
<h3>Binary search: the log n workhorse</h3>
<pre><code>lo, hi = 0, n - 1
while lo &lt;= hi:
    mid = (lo + hi) // 2
    if a[mid] == target: return mid
    if a[mid] &lt; target:  lo = mid + 1
    else:                hi = mid - 1
return not_found</code></pre>
<p>Each comparison discards half the remaining range: a billion elements fall in ~30 steps. Famously easy to get subtly wrong — off-by-ones in <code>lo/hi</code> updates — so write it slowly and test the 0-, 1-, and 2-element cases.</p>
<h3>The generalization most people miss</h3>
<p>Binary search works on any <strong>monotonic yes/no question</strong>, not just arrays: "first version where the build broke" (git bisect), "smallest capacity that ships all packages in D days". If answers look like <code>NNNNYYYY</code>, binary search the boundary.</p>
<div class="callout">💡 <span>Sorting first (O(n log n)) is often the enabling move: after it, duplicates sit adjacent, pairs yield to two pointers, and every lookup is log n.</span></div>`,
          takeaways: [
            "Good sorting is O(n log n): log n split levels × O(n) merge work.",
            "Use the stdlib sort; understand merge/quick for the reasoning.",
            "Binary search: halve the range each step; test tiny edge cases.",
            "Any monotonic predicate can be binary-searched — not just arrays.",
          ],
          exercises: [
            {
              type: "blanks",
              title: "Patch the binary search",
              prompt: "The classic off-by-one traps — fill each blank so the search never skips or loops forever.",
              code: "while (lo <= hi) {\n  const mid = Math.floor((lo + hi) / {{0}});\n  if (a[mid] === t) return mid;\n  if (a[mid] < t) lo = {{1}};\n  else hi = {{2}};\n}",
              blanks: [
                { options: ["2", "3", "n"], answer: 0 },
                { options: ["mid + 1", "mid", "lo + 1"], answer: 0 },
                { options: ["mid - 1", "mid", "hi - 1"], answer: 0 },
              ],
            },
          ],
          quiz: [
            {
              q: "Binary search on 1,000,000,000 sorted items takes about…",
              options: ["1,000 comparisons", "30 comparisons", "1,000,000 comparisons", "10 comparisons"],
              answer: 1,
              explain: "log₂(10⁹) ≈ 30. Each step halves the candidates: the magic of logarithms.",
            },
            {
              q: "Why is merge sort O(n log n)?",
              options: [
                "It uses a hash map",
                "log n levels of halving, each level doing O(n) merge work",
                "It only sorts half the array",
                "Recursion is free",
              ],
              answer: 1,
              explain: "The recursion tree is log n deep, and merging all pieces at any depth touches all n elements once.",
            },
            {
              q: "'Find the first commit where tests fail' (git bisect) is an application of…",
              options: [
                "Quicksort",
                "Binary search over a monotonic predicate",
                "Hashing",
                "Dynamic programming",
              ],
              answer: 1,
              explain: "History looks like PASS...PASSFAIL...FAIL — monotonic. Binary search finds the boundary in log n checks.",
            },
          ],
        },
        {
          id: "dsa-2-2",
          title: "Trees, Graphs, BFS & DFS",
          minutes: 15,
          content: `
<p>Linear structures model sequences. The real world — file systems, social networks, road maps, dependencies — is <strong>hierarchies and networks</strong>: trees and graphs.</p>
<h3>Binary search trees</h3>
<p>Each node: left subtree smaller, right subtree bigger. Search/insert/delete follow one root-to-leaf path — <strong>O(log n) if balanced</strong> (self-balancing variants like AVL/red-black keep it so; sorted-order insertion into a naive BST degrades to an O(n) linked list). In-order traversal yields sorted output.</p>
<h3>Graphs: vertices + edges</h3>
<pre><code>adjacency list:  {A: [B, C], B: [D], ...}
→ the default representation: O(V + E) space, cheap neighbor iteration</code></pre>
<h3>The two traversals that solve half of graph-land</h3>
<pre><code>BFS (queue):                     DFS (stack / recursion):
visit layer by layer             dive deep, backtrack
→ SHORTEST PATH (unweighted)     → cycle detection
→ "minimum moves" puzzles        → topological sort (dependencies)
                                 → connected components, flood fill
both: O(V + E), mark visited or loop forever</code></pre>
<p>Interviews love dressing graphs up: word ladders, course prerequisites, islands in a grid (every cell is a vertex, adjacent cells are edges). The costume changes; BFS/DFS underneath don't.</p>
<h3>One step further</h3>
<ul>
<li><strong>Weighted shortest path</strong> → Dijkstra (BFS upgraded with a priority queue).</li>
<li><strong>Overlapping subproblems</strong> (Fibonacci, edit distance, knapsack) → <strong>dynamic programming</strong>: solve each subproblem once, store it. DP deserves its own deep-dive — recognize it when brute force recomputes the same thing exponentially.</li>
</ul>
<div class="callout">💡 <span>The graph reflex: when a problem mentions <em>connections, dependencies, moves, or transformations between states</em> — model states as vertices, transitions as edges, then ask: BFS or DFS?</span></div>`,
          takeaways: [
            "Balanced BSTs give O(log n) ordered operations; in-order traversal = sorted.",
            "Adjacency lists are the default graph representation: O(V + E).",
            "BFS (queue) = shortest unweighted path; DFS = cycles, topo sort, components.",
            "Many puzzles are graphs in costume: states = vertices, moves = edges.",
          ],
          quiz: [
            {
              q: "Shortest path in an UNWEIGHTED maze — which traversal guarantees it?",
              options: ["DFS", "BFS", "In-order traversal", "Quickselect"],
              answer: 1,
              explain: "BFS explores by distance layers, so the first time you reach the exit is via a shortest route. DFS may find a long path first.",
            },
            {
              q: "Inserting 1,2,3,...,n in order into a naive (unbalanced) BST gives search time…",
              options: [
                "O(log n) as always",
                "O(n) — the tree degrades into a linked list",
                "O(1)",
                "O(n log n)",
              ],
              answer: 1,
              explain: "Each new key goes right of the previous: a chain of depth n. Self-balancing trees exist precisely to prevent this.",
            },
            {
              q: "Course scheduling with prerequisites ('take A before B') calls for…",
              options: [
                "Binary search",
                "Topological sort via DFS on the dependency graph",
                "A stack of hash maps",
                "Merge sort",
              ],
              answer: 1,
              explain: "Courses are vertices, prerequisites are directed edges; a topological order (and cycle check) is exactly DFS's specialty.",
            },
          ],
        },
      ],
    },
    {
      id: "dsa-m3",
      title: "The Interview Gauntlet",
      lessons: [
        {
          id: "dsa-3-1",
          title: "Dynamic Programming, Demystified",
          minutes: 15,
          videos: [
            { id: "oBt53YbR9Kk", title: "Dynamic Programming — full course", channel: "freeCodeCamp", length: "5 h" },
          ],
          content: `
<p>DP has a fearsome reputation, but it's one idea: <strong>when brute force solves the same subproblem over and over, solve each once and remember it.</strong></p>
<h3>The tell</h3>
<p>Naive recursive Fibonacci recomputes fib(3) millions of times — O(2ⁿ). The recursion <em>tree</em> is huge, but it contains only n <em>distinct</em> subproblems. That gap is DP's entire opportunity:</p>
<pre><code>// memoization: top-down DP
const memo = {};
function fib(n) {
  if (n &lt;= 1) return n;
  if (n in memo) return memo[n];
  memo[n] = fib(n - 1) + fib(n - 2);
  return memo[n];
}                       // O(2ⁿ) → O(n)</code></pre>
<h3>Two styles, one idea</h3>
<pre><code>Memoization  top-down   recursion + cache; write the brute force,
                        add three lines; easiest to derive
Tabulation   bottom-up  fill a table from base cases upward;
                        no recursion depth limits, often less memory</code></pre>
<h3>The four-step recipe</h3>
<ol>
<li><strong>Define the state</strong> — what does dp[i] (or dp[i][j]) mean? (Hardest step. Say it in words.)</li>
<li><strong>Find the recurrence</strong> — how does a state combine smaller ones? (climbing stairs: dp[i] = dp[i-1] + dp[i-2])</li>
<li><strong>Base cases</strong> — the smallest answerable states.</li>
<li><strong>Order + answer</strong> — fill so dependencies come first; read off the target.</li>
</ol>
<p>The classics to recognize on sight: climbing stairs, coin change, house robber, longest common subsequence, edit distance, knapsack. Different costumes; same recipe.</p>
<div class="callout">💡 <span>Interview move: say the brute force out loud FIRST, point at the repeated subproblems, then add the cache. Interviewers reward the derivation far more than a memorized table.</span></div>`,
          takeaways: [
            "DP = overlapping subproblems + remembering answers.",
            "Memoization: brute-force recursion + a cache. Tabulation: build the table upward.",
            "Recipe: state in words → recurrence → base cases → fill order.",
            "Derive from brute force in interviews; don't recite tables.",
          ],
          exercises: [
            {
              type: "blanks",
              title: "Memoize Fibonacci",
              prompt: "Three blanks turn O(2ⁿ) brute force into O(n).",
              code: "const memo = {};\nfunction fib(n) {\n  if (n <= 1) return {{0}};\n  if (n in memo) return {{1}};\n  memo[n] = fib(n - 1) + fib(n - {{2}});\n  return memo[n];\n}",
              blanks: [
                { options: ["n", "0", "1"], answer: 0 },
                { options: ["memo[n]", "fib(n)", "n"], answer: 0 },
                { options: ["2", "1", "n"], answer: 0 },
              ],
            },
          ],
          quiz: [
            {
              q: "What makes a problem a DP candidate rather than plain divide-and-conquer?",
              options: [
                "It involves numbers",
                "Its subproblems OVERLAP — the same ones recur, so caching pays",
                "It requires sorting first",
                "It has multiple inputs",
              ],
              answer: 1,
              explain: "Merge sort's halves are disjoint — no reuse, no DP. Fibonacci's branches collide constantly — caching collapses the tree.",
            },
            {
              q: "Memoized fib(50) computes how many distinct subproblems?",
              options: ["2⁵⁰", "About 50", "50² = 2500", "None"],
              answer: 1,
              explain: "One cached answer per value 0..50. The exponential tree collapses to a linear chain — that's the whole magic.",
            },
            {
              q: "In 'ways to climb n stairs taking 1 or 2 steps', the recurrence is…",
              options: [
                "dp[i] = dp[i-1] + dp[i-2]",
                "dp[i] = dp[i-1] * 2",
                "dp[i] = i!",
                "dp[i] = dp[i/2] + 1",
              ],
              answer: 0,
              explain: "Every way to reach step i arrives from i-1 (a 1-step) or i-2 (a 2-step) — Fibonacci wearing a costume.",
            },
          ],
        },
        {
          id: "dsa-3-2",
          title: "Heaps & the Top-K Pattern",
          minutes: 13,
          content: `
<p>"Give me the biggest/smallest/most-urgent thing, fast, while items keep arriving" — that sentence describes schedulers, leaderboards, Dijkstra and a dozen interview problems. The answer is always a <strong>heap</strong>.</p>
<h3>What a heap is</h3>
<p>A complete binary tree where every parent beats its children (min-heap: parent ≤ children). Stored flat in an array — no pointers:</p>
<pre><code>parent(i) = (i - 1) / 2      children(i) = 2i + 1, 2i + 2

peek min      O(1)     it's at index 0
push          O(log n) append, bubble up
pop min       O(log n) move last to root, sink down</code></pre>
<p>That's the <strong>priority queue</strong>: a queue that serves by importance instead of arrival order.</p>
<h3>The top-k pattern (memorize this one)</h3>
<p>Find the k largest of n items (or of an endless stream):</p>
<pre><code>keep a MIN-heap of size k
for each item:
    push it
    if heap size &gt; k: pop the minimum   ← evicts the weakest
heap now holds the k largest            O(n log k), O(k) memory</code></pre>
<p>Counter-intuitive detail worth savoring: top-k <em>largest</em> uses a <em>min</em>-heap — the root is the current "weakest member of the elite", first to be replaced.</p>
<h3>Where you've already met it</h3>
<ul>
<li><strong>Dijkstra</strong> = BFS with the queue upgraded to a priority queue.</li>
<li><strong>Merge k sorted lists</strong> — heap of k heads, pop-push until done.</li>
<li><strong>Recommender mission</strong> — your top-k by cosine similarity could use exactly this instead of a full sort.</li>
</ul>
<div class="callout">💡 <span>Sorting all n items to take k is O(n log n). The heap does it in O(n log k) — for k=10 of a million items, that's the difference between 20n and 3.3n comparisons, with O(k) memory on a stream.</span></div>`,
          takeaways: [
            "Heap = array-backed complete tree; peek O(1), push/pop O(log n).",
            "Priority queue serves by importance, not arrival.",
            "Top-k largest: min-heap of size k, evict the root.",
            "Dijkstra is BFS with a priority queue.",
          ],
          exercises: [
            {
              type: "match",
              title: "Heap operations & patterns",
              prompt: "Match each need to what the heap gives you.",
              pairs: [
                ["See the most urgent item", "O(1) peek at the root"],
                ["Insert a new task", "O(log n) bubble-up"],
                ["Top-k largest of a stream", "Min-heap capped at size k"],
                ["Shortest weighted path", "Dijkstra: BFS + priority queue"],
              ],
            },
          ],
          quiz: [
            {
              q: "Why does finding the k LARGEST items use a MIN-heap?",
              options: [
                "It's a typo — you use a max-heap",
                "The min-heap's root is the weakest of your current elite k — exactly the one to evict when something better arrives",
                "Min-heaps are faster than max-heaps",
                "To sort the output",
              ],
              answer: 1,
              explain: "You only ever need to ask: 'is the newcomer better than my current worst?' The min-heap answers that in O(1).",
            },
            {
              q: "Top-k via full sort vs via heap, on n = 1,000,000 and k = 10:",
              options: [
                "Sort wins: O(n log n) beats O(n log k)",
                "Heap wins: O(n log k) with O(k) memory — and it works on streams",
                "They're identical",
                "Neither can handle a million items",
              ],
              answer: 1,
              explain: "log(10) ≈ 3.3 vs log(1,000,000) ≈ 20 per item — plus the heap never needs all data in memory at once.",
            },
            {
              q: "A hospital ER admits patients by severity, not arrival time. The matching structure is…",
              options: ["A stack", "A FIFO queue", "A priority queue (heap)", "A linked list"],
              answer: 2,
              explain: "Serve-by-importance is the priority queue's definition — heaps are how it's efficiently implemented.",
            },
          ],
        },
        {
          id: "dsa-3-3",
          title: "Sliding Windows & Prefix Sums",
          minutes: 13,
          content: `
<p>Two more patterns complete your kit for the vast family of <em>"…subarray/substring that…"</em> problems — the most common interview genre there is.</p>
<h3>Sliding window: a caterpillar, not a scanner</h3>
<p>For "longest/shortest window satisfying a condition", don't test all O(n²) windows. Keep one window and let it crawl — grow the right edge; when the condition breaks, shrink the left:</p>
<pre><code>// longest substring without repeating characters — O(n)
let left = 0, best = 0;
const seen = new Set();
for (let right = 0; right &lt; s.length; right++) {
  while (seen.has(s[right])) {     // condition broken:
    seen.delete(s[left]); left++;  // shrink from the left
  }
  seen.add(s[right]);
  best = Math.max(best, right - left + 1);
}</code></pre>
<p>Each index enters and leaves the window at most once → linear. The window "slides" like a caterpillar: stretch, scrunch, repeat.</p>
<h3>Prefix sums: pay once, query forever</h3>
<p>Many range questions collapse after one O(n) preprocessing pass:</p>
<pre><code>prefix[i] = a[0] + a[1] + … + a[i-1]     (prefix[0] = 0)
sum of a[i..j] = prefix[j+1] - prefix[i]  ← O(1) per query!</code></pre>
<p>The killer combo — <strong>prefix sums + hash map</strong> — solves "count subarrays summing to k" in one pass: for each prefix p, the number of earlier prefixes equal to p − k is the number of subarrays ending here with sum k. (Recognize the move? It's Two Sum again.)</p>
<h3>Choosing the pattern</h3>
<pre><code>"longest/shortest window where …"        → sliding window
"sum/count over a range, many queries"   → prefix sums
"subarrays summing to exactly k"         → prefix sums + hash map
(negative numbers? windows break; prefixes don't)</code></pre>
<div class="callout">💡 <span>With windows, two pointers, hash maps, prefix sums, BFS/DFS, heaps and DP, you now hold the seven patterns behind the majority of interview questions. The rest is reps — which is what your Practice deck is for.</span></div>`,
          takeaways: [
            "Sliding window: grow right, shrink left; each element enters/leaves once → O(n).",
            "Prefix sums make any range-sum query O(1) after O(n) setup.",
            "Prefix + hash map counts subarrays with exact sum — Two Sum in disguise.",
            "Negative numbers break window logic but not prefix sums.",
          ],
          quiz: [
            {
              q: "Why is the sliding-window substring scan O(n), not O(n²)?",
              options: [
                "It skips characters",
                "Each index enters the window once and leaves at most once — two passes of work total",
                "Sets make everything constant",
                "It isn't; it's O(n²)",
              ],
              answer: 1,
              explain: "left and right each move only forward, at most n steps apiece. Amortized, the nested-looking while is linear.",
            },
            {
              q: "After building prefix sums, the sum of elements 3..8 costs…",
              options: ["O(n)", "O(log n)", "O(1) — prefix[9] minus prefix[3]", "O(k)"],
              answer: 2,
              explain: "One subtraction per query, forever. That's the trade: O(n) once, O(1) always after.",
            },
            {
              q: "'Count subarrays with sum exactly k' (negatives allowed) is best solved with…",
              options: [
                "Sliding window",
                "Prefix sums + a hash map of prefix counts",
                "Sorting first",
                "BFS",
              ],
              answer: 1,
              explain: "Negatives break the window's grow/shrink logic. Prefix counts don't care: look up prefix − k occurrences at each step.",
            },
          ],
        },
      ],
    },
  ],
};

window.MARTINIUM.order.push("dsa");
