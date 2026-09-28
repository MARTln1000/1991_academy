/* ============================================
   1991 Academy — Code runners
   Every place the learner's code executes, in
   one module: JavaScript and Python in Web
   Workers in the learner's own browser, C++ on
   the server (in the sandboxed runner
   container). All of them speak the same
   __check(name, actual, expected) protocol and
   return the same shape:

     { results: [{name, pass, expected, actual}],
       output: "what the code printed",
       error?: {...} }                  (tests)
     { data?: any, output, error? }     (visualization compute)

   Every run starts from a clean slate: nothing
   defined by an earlier run can make a test
   pass. Nothing here ever runs learner code on
   the main thread when a Worker is available,
   so a stray `while (true)` can't freeze the
   page.
   ============================================ */

const Runner = (() => {
  const JS_TEST_TIMEOUT = 3000;
  const JS_COMPUTE_TIMEOUT = 15000;   // training loops are slower than tests
  const PY_RUN_TIMEOUT = 20000;
  const PY_HEAVY_TIMEOUT = 90000;     // numpy/pandas download on first import
  const PY_BOOT_TIMEOUT = 120000;     // Pyodide itself, first time only

  const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
  /* What `import` can load in the browser's Python (Pyodide), besides the
     standard library. Shown when an import fails. */
  const PY_LIBRARIES = "numpy, pandas, scipy, scikit-learn, sympy, networkx";

  function T(key, ...args) {
    return typeof t === "function" ? t(key, ...args) : key;
  }

  /* Blob-backed worker. The URL must be revoked or it leaks for the life of
     the document, but revoking in the same tick has raced worker startup in
     some browsers — so hand it back on the next turn instead. */
  function spawnWorker(source) {
    const url = URL.createObjectURL(new Blob([source], { type: "application/javascript" }));
    try {
      const worker = new Worker(url);
      setTimeout(() => URL.revokeObjectURL(url), 0);
      return worker;
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
  }

  /* ============================================================
     JavaScript — one worker per run, torn down after
     ============================================================ */

  /* Runs the learner's code, then the tests (or the visualizer's compute
     function). The worker gets this function's source text, and where workers
     are blocked it runs inline — so it must stay self-contained: no closures
     over anything outside it. console.log & co. are captured for the output
     panel; errors carry the learner's own line number when the engine reports
     one (new Function puts two header lines above the body). */
  function academyRunJS(msg) {
    var OUTPUT_MAX = 20000;
    var lines = [], size = 0, cut = false;
    function show(v) {
      if (typeof v === "string") return v;
      if (typeof v === "function") return "[Function " + (v.name || "anonymous") + "]";
      if (v === undefined) return "undefined";
      if (typeof v === "number" && !isFinite(v)) return String(v);
      try { var s = JSON.stringify(v); return s === undefined ? String(v) : s; } catch (e) { return String(v); }
    }
    function write(args) {
      if (cut) return;
      var line = Array.prototype.map.call(args, show).join(" ");
      if (size + line.length > OUTPUT_MAX) { line = line.slice(0, OUTPUT_MAX - size); cut = true; }
      lines.push(line);
      size += line.length + 1;
    }
    function log() { write(arguments); }
    var learnerConsole = { log: log, info: log, warn: log, error: log, debug: log, table: log, dir: log };

    function pretty(v) {
      try { var s = JSON.stringify(v); return s === undefined ? String(v) : s; } catch (e) { return String(v); }
    }
    var results = [];
    function __check(name, actual, expected) {
      var pass;
      try { pass = JSON.stringify(actual) === JSON.stringify(expected); } catch (e) { pass = false; }
      results.push({ name: String(name), pass: pass, actual: pretty(actual), expected: pretty(expected) });
    }

    var codeLines = String(msg.code).split("\n").length;
    function describe(err) {
      var e = { type: (err && err.name) || "Error", message: String((err && err.message) || err), line: null, where: "tests" };
      var m = /(?:<anonymous>|Function):(\d+):\d+/.exec(String((err && err.stack) || ""));
      if (m) {
        var n = parseInt(m[1], 10) - 2;
        if (n >= 1 && n <= codeLines) { e.line = n; e.where = "solution"; }
      }
      if (e.type === "SyntaxError") {
        try { new Function(msg.code); } catch (again) { e.where = "solution"; }
      }
      var ref = /^(\S+) is not defined/.exec(e.message);
      if (e.type === "ReferenceError" && ref) e.name = ref[1];
      return e;
    }

    var reply = { results: results };
    try {
      if (msg.mode === "tests") {
        new Function("__check", "console", msg.code + "\n;\n" + msg.tests)(__check, learnerConsole);
      } else {
        var fn = new Function(
          "console",
          msg.code + "\n;return typeof " + msg.fnName + " === 'function' ? " + msg.fnName + " : null;"
        )(learnerConsole);
        if (!fn) {
          var missing = new ReferenceError(msg.fnName + " is not defined");
          missing.stack = "";
          throw missing;
        }
        var compute = new Function("return (" + msg.computeSrc + ");")();
        reply.data = compute(fn, msg.viz);
      }
    } catch (err) {
      reply.error = describe(err);
    }
    reply.output = lines.join("\n") + (cut ? "\n…" : "");
    return reply;
  }

  const JS_WORKER_SRC =
    academyRunJS.toString() +
    "\nself.onmessage = function (e) { self.postMessage(academyRunJS(e.data)); };\n";

  function runJS(message, timeoutMs) {
    return new Promise((resolve) => {
      let worker;
      try {
        worker = spawnWorker(JS_WORKER_SRC);
      } catch {
        /* file:// (and any context that blocks blob: workers) has no Worker, so
           the code runs inline. No timeout protection there — it is a fallback,
           not a supported mode; the account page tells people to run the server. */
        resolve(academyRunJS(message));
        return;
      }

      let settled = false;
      const finish = (out) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.terminate();
        resolve(out);
      };

      const timer = setTimeout(() => finish({ results: [], output: "", error: { kind: "timeout" } }), timeoutMs);
      worker.onmessage = (e) => finish(e.data);
      worker.onerror = (e) => finish({ results: [], output: "", error: { type: "Error", message: e.message || "Worker error" } });
      worker.postMessage(message);
    });
  }

  /* ============================================================
     Python — one long-lived Pyodide worker, runs serialized
     ============================================================ */

  /* Loaded into Pyodide once. __academy_run runs the learner's code and then
     the tests in a FRESH namespace every time, so a function deleted from the
     editor is really gone. print() goes to the output panel, input() explains
     itself, and an error names the learner's own line (their code is compiled
     as solution.py, the tests as tests.py). */
  const PY_DRIVER = String.raw`
import builtins, io, json, math, sys, traceback

_OUTPUT_MAX = 20000


class _Output(io.TextIOBase):
    def __init__(self):
        self.parts, self.size, self.cut = [], 0, False

    def writable(self):
        return True

    def write(self, s):
        s = str(s)
        room = _OUTPUT_MAX - self.size
        if len(s) > room:
            self.cut = True
        if room > 0:
            self.parts.append(s[:room])
            self.size += min(len(s), room)
        return len(s)

    def text(self):
        return "".join(self.parts) + ("\n…" if self.cut else "")


class _NoInput(Exception):
    pass


def _no_input(prompt=""):
    raise _NoInput()


def _pretty(v):
    try:
        return json.dumps(v)
    except Exception:
        return repr(v)


def _describe(exc, code):
    err = {"type": type(exc).__name__, "message": str(exc), "line": None, "where": "tests"}
    if isinstance(exc, _NoInput):
        err["type"] = "input"
    if isinstance(exc, SyntaxError) and exc.filename in ("solution.py", "tests.py"):
        err["where"] = "solution" if exc.filename == "solution.py" else "tests"
        err["line"], err["message"] = exc.lineno, exc.msg
    else:
        for frame in traceback.extract_tb(exc.__traceback__):
            if frame.filename == "solution.py":
                err["where"], err["line"] = "solution", frame.lineno
    if err["where"] == "solution" and err["line"]:
        lines = code.splitlines()
        if 1 <= err["line"] <= len(lines):
            err["source"] = lines[err["line"] - 1].strip()
    if isinstance(exc, ModuleNotFoundError):
        err["module"] = exc.name
    if isinstance(exc, NameError) and getattr(exc, "name", None):
        err["name"] = exc.name
    return err


def __academy_run(code, script, mode):
    out = _Output()
    results = []

    def check(name, actual, expected):
        try:
            ok = bool(actual == expected)
        except Exception:
            ok = False
        results.append({"name": str(name), "pass": ok, "actual": _pretty(actual), "expected": _pretty(expected)})

    ns = {"__name__": "__main__", "__builtins__": builtins, "json": json, "math": math,
          "__check": check, "input": _no_input}
    reply = {"results": results}
    saved = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = out
    try:
        exec(compile(code, "solution.py", "exec"), ns)
        exec(compile(script, "tests.py", "exec"), ns)
        if mode == "viz":
            reply["data"] = ns.get("__out")
    except BaseException as exc:
        reply["error"] = _describe(exc, code)
    finally:
        sys.stdout, sys.stderr = saved
    reply["output"] = out.text()
    try:
        return json.dumps(reply)
    except (TypeError, ValueError) as exc:
        reply.pop("data", None)
        reply["error"] = {"type": type(exc).__name__, "message": str(exc), "line": None, "where": "tests"}
        return json.dumps(reply)
`;

  const PY_WORKER_SRC =
    "importScripts(" + JSON.stringify(PYODIDE_URL + "pyodide.js") + ");\n" +
    "const DRIVER = " + JSON.stringify(PY_DRIVER) + ";\n" +
    "const pyReady = loadPyodide({ indexURL: " + JSON.stringify(PYODIDE_URL) + " }).then((py) => {\n" +
    "  py.runPython(DRIVER);\n" +
    '  self.postMessage({ type: "ready" });\n' +
    "  return py;\n" +
    "});\n" +
    "self.onmessage = async (e) => {\n" +
    "  const { code, script, mode, runId } = e.data;\n" +
    "  let out, downloadFailed = false;\n" +
    "  try {\n" +
    "    const py = await pyReady;\n" +
    // numpy/pandas are fetched on demand; if that fails, the import reports it
    '    try { await py.loadPackagesFromImports(code + "\\n" + script); } catch (err) { downloadFailed = true; }\n' +
    '    const run = py.globals.get("__academy_run");\n' +
    "    try { out = run(code, script, mode); } finally { run.destroy(); }\n" +
    "  } catch (err) {\n" +
    '    const msg = String((err && err.message) || err).split("\\n").filter(Boolean).slice(-3).join(" — ");\n' +
    '    out = JSON.stringify({ results: [], output: "", error: { type: "Error", message: msg, where: "tests" } });\n' +
    "  }\n" +
    '  self.postMessage({ type: "done", runId, out, downloadFailed });\n' +
    "};\n";

  let pyWorker = null;
  let pyReady = false;
  let pyRunSeq = 0;
  let pyQueue = Promise.resolve(); // runs are serialized: one Pyodide, one thread

  function pySpawn() {
    pyWorker = spawnWorker(PY_WORKER_SRC);
    pyReady = false;
    pyWorker.addEventListener("message", (e) => {
      if (e.data && e.data.type === "ready") pyReady = true;
    });
  }

  function pyExecute(code, script, mode, onStatus) {
    const status = onStatus || (() => {});
    if (!pyWorker) {
      pySpawn();
      status(T("Downloading the Python runtime (~10 MB, first time only)…"));
    } else if (!pyReady) {
      status(T("Python runtime is still loading…"));
    }

    const runId = ++pyRunSeq;
    // The first run must cover the CDN download; scientific packages
    // (numpy ~8 MB, pandas ~14 MB) also download on their first import.
    const heavy = /(^|\n)\s*(import|from)\s+(numpy|pandas|matplotlib|scipy|sklearn)/.test(code + "\n" + script);
    const budget = !pyReady ? PY_BOOT_TIMEOUT : heavy ? PY_HEAVY_TIMEOUT : PY_RUN_TIMEOUT;

    const worker = pyWorker;

    return new Promise((resolve) => {
      let settled = false;
      const finish = (out) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.removeEventListener("message", handler);
        resolve(out);
      };

      const timer = setTimeout(() => {
        const bootFailed = !pyReady;
        worker.terminate();
        if (pyWorker === worker) pyWorker = null; // next run boots a fresh one
        finish({ results: [], output: "", error: { kind: bootFailed ? "boot" : "timeout" } });
      }, budget);

      const handler = (e) => {
        const d = e.data;
        if (!d || d.type !== "done" || d.runId !== runId) return;
        const out = JSON.parse(d.out);
        if (out.error && d.downloadFailed && out.error.type === "ModuleNotFoundError") out.error.downloadFailed = true;
        finish(out);
      };

      worker.addEventListener("message", handler);
      worker.postMessage({ code, script, mode, runId });
    });
  }

  /* Queue so a second click can never land mid-run on the shared interpreter. */
  function pyRun(code, script, mode, onStatus) {
    const next = pyQueue.then(() => pyExecute(code, script, mode, onStatus));
    pyQueue = next.catch(() => {});
    return next;
  }

  /* ============================================================
     Errors — one wording for every language, in English or Armenian
     ============================================================ */

  const SIGNALS = {
    SIGSEGV: "it read or wrote memory it doesn't own, e.g. an index past the end of a vector",
    SIGBUS: "it read or wrote memory it doesn't own, e.g. an index past the end of a vector",
    SIGABRT: "an exception nobody caught, or a failed assert",
    SIGFPE: "an arithmetic error, e.g. an integer division by zero",
    SIGKILL: "it used too much memory or time",
    SIGILL: "it reached code that should be unreachable, e.g. a function that doesn't return a value",
  };

  function formatError(err) {
    if (!err) return "";
    if (typeof err === "string") return err;
    switch (err.kind) {
      case "timeout": return T("Timed out — an infinite loop somewhere?");
      case "boot": return T("Could not load the Python runtime (offline?). JavaScript still works!");
      case "compile": return T("Your code doesn't compile:") + "\n\n" + (err.detail || "");
      case "compile_timeout": return T("Compiling took too long.");
      case "crash": return T("Your program crashed: {0}.", T(SIGNALS[err.signal] || "it was stopped by the system") ) + " (" + err.signal + ")";
      case "exit": return T("Your program exited with code {0} before the tests finished.", err.code);
      case "output_limit": return T("Your program printed too much (or wrote too big a file), so it was stopped.");
      case "busy": return T("The C++ runner is busy right now. Try again in a few seconds.");
      case "unavailable": return T("The C++ runner isn't reachable right now. JavaScript and Python still work.");
      case "disabled": return T("C++ isn't available on this server. JavaScript and Python still work.");
      case "too_large": return T("Your code is too long.");
    }

    let text = err.type + ": " + err.message;
    if (err.type === "input") {
      text = T("input() doesn't work here: your code gets its values from the tests, as function arguments. Use print() to see them in the output.");
    } else if (err.type === "ModuleNotFoundError" && err.module) {
      text = err.downloadFailed
        ? T("Couldn't download “{0}” (offline?).", err.module)
        : T("“{0}” isn't available in the browser's Python. You can import: {1} and the standard library.", err.module, PY_LIBRARIES);
    } else if ((err.type === "NameError" || err.type === "ReferenceError") && err.where === "tests" && err.name) {
      text += "\n" + T("The tests call {0}, but your code doesn't define it. Check the name.", err.name);
    }
    const where = err.where === "solution"
      ? (err.line ? T("Line {0}", err.line) + " · " : T("In your code") + " · ")
      : "";
    return where + text + (err.source ? "\n    " + err.source : "");
  }

  /* ============================================================
     Results rendering — shared by the Lab, missions and lessons
     ============================================================ */

  function renderResults(el, out) {
    const results = (out && out.results) || [];
    let html = "";
    if (out && out.error) {
      html += '<div class="test-row fail run-error"><span>💥</span><pre>' + esc(formatError(out.error)) + "</pre></div>";
    }
    for (const r of results) {
      html +=
        '<div class="test-row ' + (r.pass ? "pass" : "fail") + '">' +
        (r.pass ? "✓ " : "✗ ") + esc(r.name) +
        (r.pass ? "" : '<span class="t-detail">' + esc(T("expected {0} · got {1}", r.expected, r.actual)) + "</span>") +
        "</div>";
    }
    if (out && out.output) {
      html += '<div class="run-output"><div class="run-output-label">' + esc(T("Output")) + "</div><pre>" + esc(out.output) + "</pre></div>";
    }
    if (el) el.innerHTML = html;

    const passed = results.filter((r) => r.pass).length;
    const allPass = !(out && out.error) && results.length > 0 && passed === results.length;
    return { results, passed, allPass };
  }

  /* Status line text for a finished run. */
  function statusText(out, summary) {
    if (out && out.error) return T("Error — see below.");
    // No error and no results: the code ran but never reached a __check —
    // usually an early return or a renamed function. "0/0 passing" read as
    // though the tests had silently vanished.
    if (!summary.results.length) return T("No tests ran — is your function named correctly?");
    if (summary.allPass) return T("✓ All {0} tests pass!", summary.results.length);
    return T("{0}/{1} passing.", summary.passed, summary.results.length);
  }

  return {
    /* --- tests --- */
    javascript(code, tests) {
      return runJS({ mode: "tests", code, tests }, JS_TEST_TIMEOUT);
    },

    python(code, tests, onStatus) {
      return pyRun(code, tests, "tests", onStatus);
    },

    /* `prelude`: types the problem gives the learner (structs), compiled
       ahead of their code. */
    cpp(source, harness, prelude) {
      return fetch("/api/run-cpp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ source, harness, prelude: prelude || "" }),
      })
        .then((r) => r.json())
        .then((out) => ({ results: out.results || [], output: out.output || "", error: out.error }))
        .catch(() => ({ results: [], output: "", error: { kind: "unavailable" } }));
    },

    /* --- visualization compute --- */

    /* `computeSrc` is the source of a self-contained (fn, viz) => data
       function; it is re-created inside the worker alongside the learner's
       code so nothing about the visualization touches the main thread. */
    computeJavascript(code, fnName, computeSrc, viz) {
      return runJS({ mode: "compute", code, fnName, computeSrc, viz }, JS_COMPUTE_TIMEOUT);
    },

    computePython(code, script, onStatus) {
      return pyRun(code, script, "viz", onStatus);
    },

    /* --- Python runtime lifecycle --- */
    warmPython() {
      if (!pyWorker) pySpawn();
    },

    renderResults,
    statusText,
    formatError,
    /* for the content tests (tests/test_content.py): the exact code that runs */
    _academyRunJS: academyRunJS,
    _pyDriver: PY_DRIVER,
  };
})();
