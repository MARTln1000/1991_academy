/* 1991 Academy track: Programming for ML.
   Built from the FAST "Programming for ML" course: lecture notebooks in
   assets/courses/prog/Slides, homework exercises adapted from the course's
   own HW notebooks (with their original assert tests where provided).
   Code exercises run in the in-browser Python runtime and are auto-graded.
   Every published test was verified against a reference solution. */
window.MARTINIUM = window.MARTINIUM || { tracks: {}, order: [] };

var PROG_A = "../assets/courses/prog/";

window.MARTINIUM.tracks.prog = {
  id: "prog",
  title: "Programming for ML",
  tagline: "Python from zero to the data stack — auto-graded homework from a real university course, solved right in the browser.",
  icon: "🐍",
  accent: "#3b82f6",
  accentSoft: "rgba(59, 130, 246, 0.14)",
  modules: [
    {
      id: "prog-m1",
      title: "Python Foundations",
      lessons: [
        {
          id: "prog-1-1",
          title: "Conditionals & Loops",
          minutes: 14,
          materials: [
            { label: "Slides: Conditionals", href: PROG_A + "Slides/2.Conditionals.ipynb" },
            { label: "Slides: Loops", href: PROG_A + "Slides/3.Loops.ipynb" },
            { label: "Full HW1 notebook", href: PROG_A + "Homeworks/HW1_Loops.ipynb" },
          ],
          content: `
<p>Programs make decisions and repeat work — that's most of programming. Python's tools: <code>if / elif / else</code> for branching, <code>while</code> for "repeat until", <code>for</code> for "repeat over each item".</p>
<pre><code>if age &lt;= 14:        # branches are checked top to bottom;
    group = "child"   # the FIRST true one wins
elif age &lt;= 24:
    group = "young"
else:
    group = "adult or senior"

for i in range(1, 51):     # 1, 2, ..., 50 (range excludes the stop)
    total += i

while money &gt; 0:           # runs as long as the condition holds
    money -= bet</code></pre>
<p>Three habits that prevent most beginner bugs:</p>
<ul>
<li><strong>Order your elif branches</strong> — conditions are checked top-down, so ranges like 0–14 / 15–24 can be written with single comparisons.</li>
<li><strong>Know your range()</strong> — <code>range(1, 51)</code> stops at 50; <code>range(100, 0, -2)</code> counts down by 2.</li>
<li><strong>Every while needs an exit</strong> — something inside the loop must move it toward stopping.</li>
</ul>
<div class="callout">💡 <span>The exercises below are the actual FAST homework (HW1), adapted so the grader can check them: instead of <code>input()</code>/<code>print()</code>, you write functions that <em>return</em> the answer.</span></div>`,
          takeaways: [
            "if/elif/else checks top-down; the first true branch runs.",
            "range(a, b) excludes b; a negative step counts down.",
            "Every while loop needs something driving it toward its exit.",
          ],
          exercises: [
            {
              type: "code",
              title: "Age groups",
              source: "HW 1 · Problem 1",
              prompt: "Classify a person by age: child (0–14), young (15–24), adult (25–64), senior (65+).",
              fnName: "age_group",
              starter: `# Return "child" (0-14), "young" (15-24), "adult" (25-64) or "senior" (65+)
def age_group(age):
    return "child"`,
              tests: `
__check("child at 10", age_group(10), "child")
__check("boundary 14 is child", age_group(14), "child")
__check("boundary 15 is young", age_group(15), "young")
__check("boundary 24 is young", age_group(24), "young")
__check("adult at 40", age_group(40), "adult")
__check("boundary 64 is adult", age_group(64), "adult")
__check("senior at 65", age_group(65), "senior")
__check("newborn", age_group(0), "child")
`,
            },
            {
              type: "code",
              title: "Leap year",
              source: "HW 1 · Problem 2",
              prompt: "Divisible by 4 — except centuries, unless divisible by 400. Return True/False.",
              fnName: "is_leap",
              starter: `# A year is a leap year if it is divisible by 4,
# except years divisible by 100 are NOT leap years,
# unless they are also divisible by 400.
def is_leap(year):
    return False`,
              tests: `
__check("2020 is leap", is_leap(2020), True)
__check("1900 is NOT (century)", is_leap(1900), False)
__check("2000 IS (divisible by 400)", is_leap(2000), True)
__check("2023 is not", is_leap(2023), False)
__check("1996 is leap", is_leap(1996), True)
__check("2100 is not", is_leap(2100), False)
`,
            },
            {
              type: "code",
              title: "Fibonacci list",
              source: "HW 1 · Problem 11",
              prompt: "Return the first n Fibonacci numbers (1, 1, 2, 3, 5, …) as a list.",
              fnName: "fib_list",
              starter: `# First n Fibonacci numbers, starting 1, 1, 2, 3, 5, ...
def fib_list(n):
    return []`,
              tests: `
__check("n=1", fib_list(1), [1])
__check("n=2", fib_list(2), [1, 1])
__check("n=7", fib_list(7), [1, 1, 2, 3, 5, 8, 13])
__check("11th number is 89", fib_list(11)[-1], 89)
__check("n=0 gives empty list", fib_list(0), [])
`,
            },
            {
              type: "code",
              title: "Alternating sum",
              source: "HW 1 · Problem 13",
              prompt: "Compute 1 − 2 + 3 − 4 + … ± n with a for loop.",
              fnName: "alternating_sum",
              starter: `# 1 - 2 + 3 - 4 + ... up to n (odd terms +, even terms -)
def alternating_sum(n):
    return 0`,
              tests: `
__check("classic n=2000", alternating_sum(2000), -1000)
__check("n=3: 1-2+3", alternating_sum(3), 2)
__check("n=1", alternating_sum(1), 1)
__check("n=4: 1-2+3-4", alternating_sum(4), -2)
`,
            },
          ],
          quiz: [
            {
              q: "range(1, 51) produces…",
              options: ["1 through 51", "1 through 50 — the stop value is excluded", "0 through 50", "50 numbers starting at 0"],
              answer: 1,
              explain: "range excludes its stop: range(1, 51) is 1…50. Off-by-one bugs live exactly here.",
            },
            {
              q: "In an if/elif chain, which branch runs?",
              options: ["All true branches", "The last true one", "The FIRST condition that is true, top-down", "A random true one"],
              answer: 2,
              explain: "Python checks top-down and commits to the first true branch — later conditions aren't even evaluated.",
            },
          ],
        },
        {
          id: "prog-1-2",
          title: "Strings & Lists",
          minutes: 14,
          materials: [
            { label: "Slides: Strings & Lists", href: PROG_A + "Slides/4.Strings_Lists.ipynb" },
            { label: "Full HW2 notebook", href: PROG_A + "Homeworks/HW2_Data_Structures.ipynb" },
          ],
          content: `
<p>Strings and lists are both <strong>sequences</strong> — one API to learn, used everywhere:</p>
<pre><code>s = "Hello"
s[0]      # 'H'      indexing
s[-3:]    # 'llo'    slicing: last three
s[::-1]   # 'olleH'  reversed
len(s), s.lower(), s.replace(",", "")

nums = [3, 1, 4]
nums.append(1)         # lists are mutable — strings are NOT
sorted(nums), sum(nums), max(nums)
[x*x for x in range(50) if x % 3 == 0]   # list comprehension</code></pre>
<p>The big difference: <strong>lists are mutable, strings are immutable</strong> — every string "modification" builds a new string. And the pattern that solves half of all beginner exercises: <em>walk the sequence, accumulate an answer</em> (a count, a new list, a best-so-far).</p>
<div class="callout">💡 <span>Slicing <code>s[a:b:step]</code> is the Swiss-army knife: <code>s[:3]</code> first three, <code>s[-3:]</code> last three, <code>s[::-1]</code> reversed. Learn it cold.</span></div>`,
          takeaways: [
            "Strings and lists share the sequence API: len, indexing, slicing, for-loops.",
            "Lists mutate in place; strings never do.",
            "Most exercises are walk-and-accumulate: loop + build the answer.",
          ],
          exercises: [
            {
              type: "code",
              title: "Double every character",
              source: "HW 2 · Problem 3",
              prompt: "'Hello' → 'HHeelllloo'.",
              fnName: "double_chars",
              starter: `# Return the string with every character doubled
def double_chars(s):
    return s`,
              tests: `
__check("Hello", double_chars("Hello"), "HHeelllloo")
__check("empty string", double_chars(""), "")
__check("ab", double_chars("ab"), "aabb")
__check("single char", double_chars("x"), "xx")
`,
            },
            {
              type: "code",
              title: "Palindrome check",
              source: "HW 2 · Problem 9",
              prompt: "A palindrome reads the same backwards. Ignore letter case: 'Anna' counts.",
              fnName: "is_palindrome",
              starter: `# True if the word reads the same backwards (case-insensitive)
def is_palindrome(word):
    return False`,
              tests: `
__check("Anna (case-insensitive)", is_palindrome("Anna"), True)
__check("dog is not", is_palindrome("dog"), False)
__check("abba", is_palindrome("abba"), True)
__check("single letter", is_palindrome("x"), True)
__check("ahha", is_palindrome("ahha"), True)
`,
            },
            {
              type: "code",
              title: "Unique values, original order",
              source: "HW 2 · Problem 11",
              prompt: "Remove duplicates but keep the first-seen order (so a plain set() won't do).",
              fnName: "unique_keep_order",
              starter: `# [1, 2, 1, 3, 2] -> [1, 2, 3]  (keep first occurrences, in order)
def unique_keep_order(lst):
    return lst`,
              tests: `
__check("numbers", unique_keep_order([1, 2, 1, 3, 2]), [1, 2, 3])
__check("strings keep order", unique_keep_order(["b", "a", "b"]), ["b", "a"])
__check("empty", unique_keep_order([]), [])
__check("no duplicates", unique_keep_order([1, 2, 3]), [1, 2, 3])
`,
            },
            {
              type: "code",
              title: "Longest run of zeros",
              source: "HW 2 · Problem 18",
              prompt: "In [1,0,1,1,0,0,0,0,1,0,0] the longest run of consecutive zeros is 4.",
              fnName: "longest_zero_run",
              starter: `# Length of the longest streak of consecutive 0s
def longest_zero_run(lst):
    return 0`,
              tests: `
__check("course example", longest_zero_run([1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0]), 4)
__check("no zeros", longest_zero_run([1, 1]), 0)
__check("all zeros", longest_zero_run([0, 0, 0]), 3)
__check("empty list", longest_zero_run([]), 0)
__check("single zero at end", longest_zero_run([1, 0]), 1)
`,
            },
          ],
          quiz: [
            {
              q: "s[::-1] returns…",
              options: ["The first character", "The string reversed", "An error", "The string without its last character"],
              answer: 1,
              explain: "A slice with step −1 walks the sequence backwards — the idiomatic reverse.",
            },
            {
              q: "Why does s.upper() not change s?",
              options: [
                "It's a bug",
                "Strings are immutable — methods return NEW strings",
                "upper() only works on lists",
                "It does change s",
              ],
              answer: 1,
              explain: "String methods never modify in place; you must reassign: s = s.upper().",
            },
          ],
        },
        {
          id: "prog-1-3",
          title: "Dictionaries, Tuples & Sets",
          minutes: 13,
          materials: [
            { label: "Slides: Dictionaries", href: PROG_A + "Slides/5. Dictionaries.ipynb" },
            { label: "Slides: Tuples, Sets, Files", href: PROG_A + "Slides/6.Tuples,Sets,Files.ipynb" },
            { label: "Full HW2 notebook", href: PROG_A + "Homeworks/HW2_Data_Structures.ipynb" },
          ],
          content: `
<p>Past lists, Python gives you three more shapes of collection — choosing the right one is half the solution:</p>
<ul>
<li><strong>dict</strong> — key → value lookup in O(1). The workhorse: counters, indexes, configs, JSON.</li>
<li><strong>tuple</strong> — immutable sequence; perfect for fixed-shape records like <code>(wins, losses)</code> and for dict keys.</li>
<li><strong>set</strong> — unique items, O(1) membership, and algebra: union, intersection, difference.</li>
</ul>
<pre><code>counts = {}
for word in words:
    counts[word] = counts.get(word, 0) + 1   # THE counting idiom

record = ("Pyunik", 3, 1)      # tuples unpack:
name, wins, losses = record

evens = {x for x in nums if x % 2 == 0}      # set comprehension</code></pre>
<div class="callout">💡 <span><code>d.get(key, default)</code> is the polite lookup — no KeyError, perfect for counters. The exercises below include the course's game-scores parser, a classic dict-of-tuples task.</span></div>`,
          takeaways: [
            "dict = O(1) key→value; the counting idiom is d[k] = d.get(k, 0) + 1.",
            "Tuples are immutable records; they unpack cleanly and can be dict keys.",
            "Sets give uniqueness and O(1) membership tests.",
          ],
          exercises: [
            {
              type: "code",
              title: "Frequency counter",
              source: "HW 2 · Problem 12",
              prompt: "Count how many times each item occurs; return a dict.",
              fnName: "count_freq",
              starter: `# ["a", "b", "a"] -> {"a": 2, "b": 1}
def count_freq(lst):
    return {}`,
              tests: `
__check("letters", count_freq(["a", "b", "a"]), {"a": 2, "b": 1})
__check("empty", count_freq([]), {})
__check("numbers", count_freq([1, 1, 1]), {1: 3})
__check("mixed counts", count_freq(["x", "y", "x", "z", "x"]), {"x": 3, "y": 1, "z": 1})
`,
            },
            {
              type: "code",
              title: "Game scores → standings",
              source: "HW 2 · Problem 22",
              prompt: "Parse lines like 'Pyunik 3 - Mika 2' into {team: (wins, losses)}. Draws count for neither.",
              fnName: "parse_scores",
              starter: `# lines: list of strings like "Pyunik 3 - Mika 2"
# Return {team_name: (wins, losses)}
def parse_scores(lines):
    teams = {}
    for match in lines:
        # hint: team1, score1, dash, team2, score2 = match.split()
        pass
    return teams`,
              tests: `
r = parse_scores(["Pyunik 3 - Mika 2", "Pyunik 1 - Ararat 2"])
__check("winner counted", r["Pyunik"], (1, 1))
__check("loser counted", r["Mika"], (0, 1))
__check("third team", r["Ararat"], (1, 0))
r2 = parse_scores(["A 1 - B 1"])
__check("draw counts for neither", r2["A"], (0, 0))
__check("empty input", parse_scores([]), {})
`,
            },
            {
              type: "code",
              title: "Users without an email",
              source: "HW 2 · Problem 24",
              prompt: "Given a list of user dicts, return the names of those with an empty email.",
              fnName: "users_without_email",
              starter: `# users: [{"name": ..., "email": ...}, ...]
# Return the list of names whose email is empty ("")
def users_without_email(users):
    return []`,
              tests: `
d = [{"name": "Todd", "email": "todd@mail.net"},
     {"name": "Princess", "email": ""},
     {"name": "LJ", "email": "lj@mail.net"}]
__check("finds the one without email", users_without_email(d), ["Princess"])
__check("none missing", users_without_email([{"name": "A", "email": "a@b.c"}]), [])
__check("all missing", users_without_email([{"name": "X", "email": ""}, {"name": "Y", "email": ""}]), ["X", "Y"])
`,
            },
          ],
          quiz: [
            {
              q: "The idiomatic way to count occurrences into a dict d is…",
              options: [
                "d[k] += 1",
                "d[k] = d.get(k, 0) + 1",
                "d.append(k)",
                "d.add(k)",
              ],
              answer: 1,
              explain: "get(k, 0) supplies a default of 0 for unseen keys — no KeyError on the first occurrence.",
            },
            {
              q: "Which can be a dictionary key: a list or a tuple?",
              options: ["Both", "A list", "A tuple — because it's immutable and hashable", "Neither"],
              answer: 2,
              explain: "Dict keys must be hashable (immutable). Tuples qualify; lists don't.",
            },
          ],
        },
      ],
    },
    {
      id: "prog-m2",
      title: "Functions & the Data Stack",
      lessons: [
        {
          id: "prog-2-1",
          title: "Functions & Error Handling",
          minutes: 15,
          materials: [
            { label: "Slides: Intro to Functions", href: PROG_A + "Slides/7.Intro_to_Functions.ipynb" },
            { label: "Slides: Functions & Errors", href: PROG_A + "Slides/8.Functions_and_ErrorHandling.ipynb" },
            { label: "Full HW3 notebook", href: PROG_A + "Homeworks/HW3_Functions.ipynb" },
          ],
          content: `
<p>Functions turn scripts into software: named, reusable, testable pieces with clear inputs and outputs.</p>
<pre><code>def root(x, n=2):          # default argument
    return x ** (1 / n)

def calc(*args):           # *args: any number of inputs
    ...

try:
    value = numbers[i]
except IndexError:
    value = None           # handle the failure you EXPECT</code></pre>
<ul>
<li><strong>Return, don't print</strong> — a function that returns a value can be tested, composed and reused; one that prints can only be watched.</li>
<li><strong>Defaults</strong> make good APIs: <code>root(16)</code> and <code>root(81, 4)</code> both read naturally.</li>
<li><strong>Watch out for mutation</strong> — if a function modifies the list you passed it, the caller sees the change (HW3's add_excitement problem exists exactly to teach this).</li>
</ul>
<div class="callout">💡 <span>These exercises come with the course's <em>original</em> assert tests from HW3 — the same checks your homework would have been graded with at FAST.</span></div>`,
          takeaways: [
            "Return values, don't print — returned values are testable and composable.",
            "Default arguments make clean APIs; *args accepts variable inputs.",
            "Functions that mutate their arguments affect the caller — be deliberate about it.",
          ],
          exercises: [
            {
              type: "code",
              title: "First difference",
              source: "HW 3 · Problem 4",
              prompt: "Return the first index where two strings differ, or −1 if identical.",
              fnName: "first_diff",
              starter: `# First index where a and b differ; -1 if the strings are identical.
# If one is a prefix of the other, the first difference is at len(shorter).
def first_diff(a, b):
    return -1`,
              tests: `
__check("differ at 0", first_diff("dog", "cat"), 0)
__check("identical -> -1", first_diff("dog", "dog"), -1)
__check("differ at 2", first_diff("dog", "don"), 2)
__check("prefix case", first_diff("path", "pathway"), 4)
`,
            },
            {
              type: "code",
              title: "Closest not larger",
              source: "HW 3 · Problem 6",
              prompt: "Largest element of L that is ≤ n — or the string 'Enter another list' if none qualifies.",
              fnName: "closest",
              starter: `# Largest element of L that is not larger than n.
# If every element is larger than n, return "Enter another list".
def closest(L, n):
    return 0`,
              tests: `
__check("course case", closest([1, 6, 3, 9, 11], 8), 6)
__check("all larger", closest([51, 61, 31, 91, 111], 18), "Enter another list")
__check("floats", closest([1.03, 3.2, 3, 3.9, 7.67], 3.99), 3.9)
__check("exact match allowed", closest([2, 4, 8], 4), 4)
`,
            },
            {
              type: "code",
              title: "Character matches",
              source: "HW 3 · Problem 7",
              prompt: "How many positions have the same character in both strings? 'python'/'path' → 3.",
              fnName: "matches",
              starter: `# Count positions where the two strings have the same character
def matches(a, b):
    return 0`,
              tests: `
__check("python/path", matches("python", "path"), 3)
__check("path/pathway", matches("path", "pathway"), 4)
__check("no matches", matches("abcd", "dcba"), 0)
__check("identical", matches("aa", "aa"), 2)
`,
            },
            {
              type: "code",
              title: "Swap the case",
              source: "HW 3 · Problem 9",
              prompt: "Uppercase → lowercase and vice versa. (There's a one-liner… but write the loop if you're learning.)",
              fnName: "change_case",
              starter: `# 'Hello' -> 'hELLO'
def change_case(s):
    return s`,
              tests: `
__check("Hello", change_case("Hello"), "hELLO")
__check("HELLO", change_case("HELLO"), "hello")
__check("hello", change_case("hello"), "HELLO")
__check("with digits", change_case("Unit1991"), "uNIT1991")
`,
            },
            {
              type: "code",
              title: "Merge two sorted lists",
              source: "HW 3 · Problem 16",
              prompt: "Merge without sort()/sorted() — the two-pointer walk from the DSA track, in Python.",
              fnName: "merge",
              starter: `# Merge two already-sorted lists into one sorted list.
# Do NOT use sort() or sorted() — walk both lists with two indices.
def merge(a, b):
    return []`,
              tests: `
__check("interleaved", merge([1, 2, 5], [2, 3, 4]), [1, 2, 2, 3, 4, 5])
__check("course case", merge([11, 25, 105], [2, 4, 38]), [2, 4, 11, 25, 38, 105])
__check("different lengths", merge([11, 25, 105], [1, 2, 3, 4, 5, 6, 7]), [1, 2, 3, 4, 5, 6, 7, 11, 25, 105])
__check("one empty", merge([], [1, 2]), [1, 2])
`,
            },
          ],
          quiz: [
            {
              q: "Why is 'return the answer' better than 'print the answer' inside a function?",
              options: [
                "print is slower",
                "Returned values can be tested, stored and passed onward; printed text is gone",
                "return uses less memory",
                "No difference",
              ],
              answer: 1,
              explain: "Returning makes the function composable — other code (and graders!) can use the result. Printing is a dead end.",
            },
            {
              q: "def root(x, n=2) means…",
              options: [
                "n must always be 2",
                "n is optional and defaults to 2 when omitted",
                "x defaults to 2",
                "The function returns 2",
              ],
              answer: 1,
              explain: "Default arguments: root(16) uses n=2, root(81, 4) overrides it.",
            },
          ],
        },
        {
          id: "prog-2-2",
          title: "NumPy: Arrays & Vectorization",
          minutes: 15,
          materials: [
            { label: "Slides: Intro to NumPy", href: PROG_A + "Slides/10.Intro_to_Numpy.ipynb" },
            { label: "Slides: NumPy 2", href: PROG_A + "Slides/11.Numpy2.ipynb" },
            { label: "Full HW4 notebook", href: PROG_A + "Homeworks/HW4_Numpy.ipynb" },
          ],
          content: `
<p>NumPy is why Python rules ML. Its array does math on <strong>whole blocks of numbers at once</strong> — vectorization — at C speed:</p>
<pre><code>import numpy as np
a = np.array([1.0, 2.0, 3.0])
a * 2 + 1              # [3, 5, 7]     — no loop!
np.sqrt(np.sum((a - b) ** 2))          # Euclidean distance
(a - a.min()) / (a.max() - a.min())    # min-max rescaling

M[1:-1, 1:-1] = 0      # 2D slicing assigns whole regions
W @ x + b              # matrix-vector product: a neural layer!</code></pre>
<ul>
<li><strong>Think in arrays, not loops</strong> — if you wrote <code>for</code> over a NumPy array, there's usually a faster one-liner.</li>
<li><strong>Broadcasting</strong> stretches shapes automatically: subtracting a scalar from an array just works.</li>
<li><strong>Boolean masks</strong>: <code>a[a &gt; 50]</code> filters; <code>np.where(np.isnan(a))</code> locates.</li>
</ul>
<div class="callout">💡 <span>First run of a NumPy exercise downloads the NumPy package into your browser's Python (~8 MB, once). The dense-layer exercise below is literally the forward pass from the DL track — in three characters: <code>W @ a</code>.</span></div>`,
          takeaways: [
            "Vectorization: operate on whole arrays, not element loops.",
            "Slicing/masking select and assign entire regions at once.",
            "W @ x + b is a neural network layer — NumPy is ML's native tongue.",
          ],
          exercises: [
            {
              type: "code",
              title: "Euclidean distance",
              source: "HW 4 · Problem 1",
              prompt: "Distance between two vectors — the course's own asserts grade you.",
              fnName: "dist",
              starter: `import numpy as np

# Euclidean distance between arrays a and b (no loops!)
def dist(a, b):
    return 0.0`,
              tests: `
import numpy as np
a, b = np.array([1, 1]), np.array([1, 3])
__check("simple case", float(dist(a, b)), 2.0)
a, b = np.array([-10, 1.5]), np.array([0.9, 3.6])
__check("course case", round(float(dist(a, b)), 2), 11.1)
a, b = np.array([0, 0, 0]), np.array([2, 3, 6])
__check("3-4-5 style", float(dist(a, b)), 7.0)
`,
            },
            {
              type: "code",
              title: "Min-max rescale",
              source: "HW 4 · Problem 2",
              prompt: "Normalize an array so its values span exactly [0, 1] — a real preprocessing step.",
              fnName: "rescale",
              starter: `import numpy as np

# Rescale values linearly so min -> 0 and max -> 1
def rescale(a):
    return a`,
              tests: `
import numpy as np
__check("1..4", bool(np.all(rescale(np.array([1, 2, 3, 4])) == np.array([0, 1/3, 2/3, 1]))), True)
__check("already 0/1", bool(np.all(rescale(np.array([0, 1])) == np.array([0, 1]))), True)
__check("negative range", bool(np.allclose(rescale(np.array([-2.0, 0.0, 2.0])), np.array([0, 0.5, 1]))), True)
`,
            },
            {
              type: "code",
              title: "Find the missing values",
              source: "HW 4 · Problem 3",
              prompt: "Return the indices of NaN entries in a 1-D array.",
              fnName: "find",
              starter: `import numpy as np

# Positions (indices) of NaN values in a 1D array
def find(a):
    return np.array([])`,
              tests: `
import numpy as np
__check("two NaNs", [int(i) for i in find(np.array([np.nan, 1, 2, np.nan]))], [0, 3])
__check("all NaN", [int(i) for i in find(np.array([np.nan, np.nan]))], [0, 1])
__check("no NaN", [int(i) for i in find(np.array([1.0, 2.0]))], [])
`,
            },
            {
              type: "code",
              title: "Border of ones",
              source: "HW 4 · Problem 17",
              prompt: "An n×n array with 1s on the border, 0s inside — one slicing assignment does it.",
              fnName: "zero_one",
              starter: `import numpy as np

# n x n array: ones on the border, zeros inside
def zero_one(n):
    return np.ones((n, n))`,
              tests: `
import numpy as np
__check("3x3", zero_one(3).tolist(), [[1., 1., 1.], [1., 0., 1.], [1., 1., 1.]])
__check("4x4 inner zeros", zero_one(4)[1:3, 1:3].tolist(), [[0., 0.], [0., 0.]])
__check("2x2 is all ones", zero_one(2).tolist(), [[1., 1.], [1., 1.]])
`,
            },
            {
              type: "code",
              title: "A dense layer",
              source: "HW 4 · Problem 14",
              prompt: "Compute f(W·a + b) — the forward pass of one neural-network layer.",
              fnName: "dense_layer",
              starter: `import numpy as np

# f(W @ a + b): matrix W, vectors a and b, activation function f
def dense_layer(W, a, b, f):
    return a`,
              tests: `
import numpy as np
w = np.array([[1, 1, -2], [0, -1, 3]])
a = np.array([3, 10, 1])
b = np.array([0, -2])
f = lambda x: x ** 2
__check("course case", dense_layer(w, a, b, f).tolist(), [121, 81])
__check("identity activation", dense_layer(w, a, b, lambda x: x).tolist(), [11, -9])
`,
            },
          ],
          quiz: [
            {
              q: "Why is a * 2 + 1 on a NumPy array faster than a Python loop?",
              options: [
                "It isn't",
                "The whole operation runs in optimized C over contiguous memory, not interpreted per element",
                "NumPy uses the GPU automatically",
                "Python caches the loop",
              ],
              answer: 1,
              explain: "Vectorized ops move the loop from the Python interpreter into compiled C — often 10–100× faster.",
            },
            {
              q: "In ML terms, W @ x + b is…",
              options: ["A determinant", "A linear/dense layer's forward computation", "Gradient descent", "One-hot encoding"],
              answer: 1,
              explain: "Weights matrix times input plus bias — exactly what every dense layer computes before its activation.",
            },
          ],
        },
        {
          id: "prog-2-3",
          title: "Pandas: DataFrames",
          minutes: 14,
          materials: [
            { label: "Slides: Intro to Pandas", href: PROG_A + "Slides/12.Intro_to_Pandas.ipynb" },
            { label: "Slides: Pandas 2", href: PROG_A + "Slides/13.Pandas2.ipynb" },
            { label: "Slides: Pandas 3", href: PROG_A + "Slides/14.Pandas3.ipynb" },
            { label: "Full HW5 notebook", href: PROG_A + "Homeworks/HW5_Pandas.ipynb" },
            { label: "Dataset: Military Expenditure.csv", href: PROG_A + "Homeworks/HW_files/Military Expenditure.csv" },
          ],
          content: `
<p>Pandas is the spreadsheet you drive with code. Its <strong>DataFrame</strong> — labeled rows and columns — is where every real dataset lives before modeling.</p>
<pre><code>import pandas as pd
df = pd.read_csv("expenditure.csv")
df.head(10)                     # first look
df[df.CRIM &gt; 0.5]               # boolean filtering
df.sort_values("MEDV").head(3)  # cheapest three
df.groupby("CHAS").mean()       # split-apply-combine
df.drop(columns=["Code", "Type"])
df.isna().sum()                 # where is data missing?</code></pre>
<p>The FAST homework (HW5, linked above) walks the classic Iris, Boston-housing and SIPRI military-expenditure datasets through exactly these moves: build a frame, filter, sort, group, handle NaNs, save. Work through it in Colab or Jupyter — the notebook grades itself with asserts after every problem.</p>
<div class="callout">💡 <span>The groupby → aggregate pattern ("split-apply-combine") is the single most-used data move in industry. If you master one thing in pandas, master that.</span></div>`,
          takeaways: [
            "DataFrame = labeled table; boolean masks filter rows declaratively.",
            "groupby → aggregate (split-apply-combine) is the core analytics pattern.",
            "Real datasets arrive dirty: isna(), fillna(), drop() are daily tools.",
          ],
          quiz: [
            {
              q: "df[df.price > 100] returns…",
              options: [
                "The first 100 rows",
                "The rows where the price column exceeds 100",
                "The price column only",
                "An error",
              ],
              answer: 1,
              explain: "The inner expression builds a boolean mask; indexing with it keeps the rows where the mask is True.",
            },
            {
              q: "df.groupby('city').mean() computes…",
              options: [
                "The mean of the whole table",
                "Per-city averages of every numeric column — split-apply-combine",
                "The most common city",
                "A random sample",
              ],
              answer: 1,
              explain: "Rows are split into groups by city, the mean is applied per group, and results combine into a new frame.",
            },
          ],
        },
        {
          id: "prog-2-4",
          title: "Visualization & EDA",
          minutes: 13,
          materials: [
            { label: "Slides: Intro to Matplotlib", href: PROG_A + "Slides/15.Intro_to_Matplotlib.ipynb" },
            { label: "Slides: Data Visualization 2", href: PROG_A + "Slides/16.Data_Visualization2.ipynb" },
            { label: "Slides: EDA", href: PROG_A + "Slides/19.EDA.ipynb" },
            { label: "Full HW6 notebook", href: PROG_A + "Homeworks/HW6_Data_Visualization.ipynb" },
            { label: "Dataset: company_sales_data.csv", href: PROG_A + "Homeworks/HW_files/company_sales_data.csv" },
          ],
          content: `
<p>Before any model: <strong>look at the data</strong>. Exploratory Data Analysis (EDA) catches what statistics summaries hide — outliers, clusters, drift, nonsense values.</p>
<pre><code>import matplotlib.pyplot as plt
plt.scatter(df["sepal length"], df["sepal width"], c=df["target"])
plt.hist(df["MEDV"], bins=30)
fig, axes = plt.subplots(4, 4, figsize=(20, 15))   # small multiples
df.plot(x="month", y="total_profit")                # pandas shortcut</code></pre>
<ul>
<li><strong>Scatter</strong> for relationships between two variables (and class separability — HW6 plots Iris species in color).</li>
<li><strong>Histogram</strong> for distributions; <strong>line</strong> for trends over time; <strong>bar</strong> for comparisons.</li>
<li><strong>Small multiples</strong> (grids of subplots) beat one overloaded chart every time.</li>
</ul>
<p>Anscombe's famous quartet: four datasets with identical means, variances and correlation — and wildly different shapes. Only a plot tells them apart. That's the whole argument for EDA in one image.</p>
<div class="callout">💡 <span>Run HW6 in Colab/Jupyter (linked above) — plotting needs a real notebook display. Your goal: reproduce the Iris scatter matrix, then say which species is easiest to separate and why.</span></div>`,
          takeaways: [
            "Always plot before modeling — summaries hide shape.",
            "Chart choice: scatter = relationship, histogram = distribution, line = trend.",
            "Small multiples reveal structure one big chart can't.",
          ],
          quiz: [
            {
              q: "Anscombe's quartet demonstrates that…",
              options: [
                "Four charts are better than one",
                "Datasets with identical summary statistics can have completely different shapes — so plot",
                "Correlation implies causation",
                "Histograms are outdated",
              ],
              answer: 1,
              explain: "Same means, variances and correlation; totally different structure. Only visualization exposes it.",
            },
            {
              q: "To inspect how one numeric variable is distributed, reach first for a…",
              options: ["Pie chart", "Histogram", "Scatter plot", "Stacked area chart"],
              answer: 1,
              explain: "Histograms show the distribution's shape — skew, modes, outliers — at a glance.",
            },
          ],
        },
      ],
    },
  ],
};

(function () {
  const o = window.MARTINIUM.order;
  const at = o.indexOf("math");
  o.splice(at >= 0 ? at + 1 : 0, 0, "prog");
})();
