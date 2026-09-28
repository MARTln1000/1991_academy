/* 1991 Academy — Python variants for every mission.
   Attaches .py = { fnName, starter, tests, hint?, hint_hy? } to the missions
   in js/data/missions.js. Tests use the same __check(name, actual, expected)
   protocol, executed in Pyodide (js/runner.js). `hint` is one extra hint
   shown only in Python. Load AFTER js/data/missions.js. */
(function () {
  const PY = {
    "mission-autocomplete": {
      fnName: "autocomplete",
      starter: `# sorted_words: alphabetically sorted list of strings
# Return ALL words that start with prefix, in order.
# Fast plan: binary-search the first word >= prefix,
# then walk forward while words start with prefix.
def autocomplete(sorted_words, prefix):
    # your code here
    return []`,
      tests: `
words = ["apple", "apricot", "banana", "band", "bandana", "canary", "cat"]
__check("finds all 'ap' words", autocomplete(words, "ap"), ["apple", "apricot"])
__check("finds all 'ban' words", autocomplete(words, "ban"), ["banana", "band", "bandana"])
__check("single match", autocomplete(words, "cat"), ["cat"])
__check("no match returns []", autocomplete(words, "zebra"), [])
__check("empty prefix returns everything", autocomplete(words, ""), words)
big = ["w%06d" % i for i in range(200000)]
__check("200k words: exact hit", autocomplete(big, "w000123"), ["w000123"])
__check("200k words: prefix block", len(autocomplete(big, "w19999")), 10)
`,
      hint: "bisect.bisect_left(sorted_words, prefix) from the standard library is exactly the binary search for the first word >= prefix; word.startswith(prefix) does the rest.",
      hint_hy: "Ստանդարտ գրադարանի bisect.bisect_left(sorted_words, prefix)-ը հենց prefix-ից մեծ կամ հավասար առաջին բառի երկուական որոնումն է. մնացածն անում է word.startswith(prefix)-ը։",
    },

    "mission-undo": {
      fnName: "create_editor",
      starter: `# Two stacks: one of past states (for undo),
# one of undone states (for redo).
class Editor:
    def __init__(self):
        pass

    def type(self, text):
        pass  # append text

    def undo(self):
        pass  # revert the last type()

    def redo(self):
        pass  # re-apply the last undone type()

    def get_text(self):
        return ""


def create_editor():
    return Editor()`,
      tests: `
ed = create_editor()
ed.type("Hello")
ed.type(" world")
__check("typing appends", ed.get_text(), "Hello world")
ed.undo()
__check("undo reverts last type", ed.get_text(), "Hello")
ed.redo()
__check("redo restores it", ed.get_text(), "Hello world")
ed.undo(); ed.undo()
__check("undo twice reaches empty", ed.get_text(), "")
ed.undo()
__check("undo on empty is safe", ed.get_text(), "")
ed.redo(); ed.redo()
__check("redo twice restores both", ed.get_text(), "Hello world")
ed2 = create_editor()
ed2.type("a"); ed2.type("b"); ed2.undo(); ed2.type("c"); ed2.redo()
__check("new typing clears redo", ed2.get_text(), "ac")
ed3 = create_editor()
ed3.type("x"); ed3.undo()
ed4 = create_editor()
ed4.redo()
__check("each editor has its own history", ed4.get_text(), "")
`,
      hint: "Keep the stacks on self (self.history = [] in __init__), not in class-level variables: those would be shared by every editor.",
      hint_hy: "Ստեկերը պահի՛ր self-ի վրա (self.history = [] __init__-ում), ոչ թե դասի մակարդակի փոփոխականներում. դրանք կկիսվեին բոլոր խմբագրիչների միջև։",
    },

    "mission-maze": {
      fnName: "shortest_path",
      starter: `# grid: list of rows, 0 (open) / 1 (wall)
# Start [0][0], goal [rows-1][cols-1].
# Return minimum moves, or -1 if unreachable.
def shortest_path(grid):
    # queue of (row, col, distance); mark visited or loop forever
    return -1`,
      tests: `
__check("straight line", shortest_path([[0, 0, 0]]), 2)
__check("simple detour", shortest_path([
    [0, 1, 0],
    [0, 1, 0],
    [0, 0, 0],
]), 4)
__check("unreachable", shortest_path([
    [0, 1],
    [1, 0],
]), -1)
__check("single cell", shortest_path([[0]]), 0)
__check("blocked start", shortest_path([[1, 0], [0, 0]]), -1)
__check("bigger maze", shortest_path([
    [0, 0, 1, 0, 0],
    [1, 0, 1, 0, 1],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 0],
]), 8)
`,
      hint: "collections.deque is the queue: append() to add, popleft() to take the oldest in O(1). list.pop(0) works too, but costs O(n) each time.",
      hint_hy: "collections.deque-ն է հերթը. append()՝ ավելացնելու, popleft()՝ ամենահինը O(1)-ով վերցնելու համար։ list.pop(0)-ն էլ է աշխատում, բայց ամեն անգամ O(n) արժե։",
    },

    "mission-recommender": {
      fnName: "recommend",
      starter: `# user_vec: list of numbers
# items: list of {"name": str, "vec": [numbers]}
# Return names of the k most similar items, best first.
def recommend(user_vec, items, k):
    # dot(a, b) = sum of a[i]*b[i];  |a| = sqrt(dot(a, a))
    return []`,
      tests: `
items = [
    {"name": "action-movie", "vec": [9, 1, 0]},
    {"name": "romcom", "vec": [1, 9, 0]},
    {"name": "documentary", "vec": [0, 2, 9]},
    {"name": "thriller", "vec": [7, 2, 1]},
]
__check("action fan: action first, thriller second", recommend([10, 1, 0], items, 2), ["action-movie", "thriller"])
__check("documentary lover", recommend([0, 1, 8], items, 1), ["documentary"])
__check("k larger than catalog returns all", len(recommend([1, 1, 1], items, 10)), 4)
top = recommend([1, 0, 0], items, 1)
__check("returns names, not dicts", isinstance(top[0], str) if top else False, True)
`,
      hint: "sorted(scored, key=lambda s: s[1], reverse=True)[:k] ranks (name, score) pairs; math.sqrt gives the lengths.",
      hint_hy: "sorted(scored, key=lambda s: s[1], reverse=True)[:k]-ը դասակարգում է (name, score) զույգերը, իսկ երկարությունները տալիս է math.sqrt-ը։",
    },

    "mission-ratelimiter": {
      fnName: "create_limiter",
      starter: `# Sliding window rate limiter.
# allow(t): True if fewer than max_calls ALLOWED calls
# happened in the window (t - window_ms, t].
def create_limiter(max_calls, window_ms):
    # keep allowed timestamps in a queue
    def allow(t):
        return True
    return allow`,
      tests: `
allow = create_limiter(3, 1000)
__check("first three pass", [allow(0), allow(100), allow(200)], [True, True, True])
__check("fourth inside window blocked", allow(300), False)
__check("still blocked at window edge", allow(999), False)
__check("oldest expires, allowed again", allow(1001), True)
a2 = create_limiter(1, 100)
__check("independent limiter state", a2(0), True)
__check("blocked inside its window", a2(50), False)
__check("free after the window passes", a2(151), True)
`,
      hint: "A collections.deque created in create_limiter, which allow() reads and changes: popleft() the expired timestamps, append(t) when you allow. Each limiter gets its own deque.",
      hint_hy: "create_limiter-ում ստեղծված collections.deque, որը allow()-ը կարդում ու փոխում է. popleft() արա ժամկետանց ժամանակադրոշմները, append(t)՝ թույլ տալիս։ Յուրաքանչյուր սահմանափակիչ ստանում է իր սեփական deque-ն։",
    },

    "mission-retriever": {
      fnName: "retrieve",
      starter: `# query: str, docs: list of {"id": str, "text": str}
# Score = number of UNIQUE query words present in the doc
# (case-insensitive). Ties keep original doc order.
# Return the top-k ids, best first.
def retrieve(query, docs, k):
    return []`,
      tests: `
docs = [
    {"id": "auth", "text": "Reset your password from the account security page"},
    {"id": "billing", "text": "Update your credit card and billing address"},
    {"id": "intro", "text": "Welcome to the product this page explains the basics"},
    {"id": "sso", "text": "Configure single sign on with your identity provider password policy"},
]
__check("password query ranks auth first", retrieve("reset password", docs, 2), ["auth", "sso"])
__check("billing query", retrieve("credit card billing", docs, 1), ["billing"])
__check("case insensitive", retrieve("PASSWORD Reset", docs, 1), ["auth"])
__check("k caps the results", len(retrieve("page", docs, 10)), 2)
__check("ties keep original order", retrieve("your", docs, 2), ["auth", "billing"])
`,
      hint: "set(query.lower().split()) gives the unique words, and & intersects two sets. Python's sorted() is stable, so equal scores keep the documents' order.",
      hint_hy: "set(query.lower().split())-ը տալիս է եզակի բառերը, իսկ &-ը հատում է երկու բազմություն։ Python-ի sorted()-ը կայուն է, այնպես որ հավասար միավորները պահում են փաստաթղթերի կարգը։",
    },
  };

  for (const m of window.ACADEMY_1991.missions) {
    if (PY[m.id]) m.py = PY[m.id];
  }
})();
