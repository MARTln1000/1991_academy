/* ============================================
   1991 Academy — Code runners
   Every place the learner's code executes, in
   one module: JavaScript and Python in Web
   Workers, C++ on the server. All four speak
   the same __check(name, actual, expected)
   protocol and return the same shape:

     { error?: string, results: [{name, pass, expected, actual}] }
     { error?: string, data?: any }          (visualization compute)

   Nothing here ever runs learner code on the
   main thread when a Worker is available, so a
   stray `while (true)` can't freeze the page.
   ============================================ */

const Runner = (() => {
  const JS_TEST_TIMEOUT = 3000;
  const JS_COMPUTE_TIMEOUT = 15000;   // training loops are slower than tests
  const PY_RUN_TIMEOUT = 20000;
  const PY_HEAVY_TIMEOUT = 90000;     // numpy/pandas download on first import
  const PY_BOOT_TIMEOUT = 120000;     // Pyodide itself, first time only

  const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

  function T(key, ...args) {
    return typeof t === "function" ? t(key, ...args) : key;
  }

  function errorText(err) {
    return String((err && err.message) || err);
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

  const JS_WORKER_SRC = `
    function pretty(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }

    self.onmessage = function (e) {
      var msg = e.data;

      if (msg.mode === "tests") {
        var results = [];
        function __check(name, actual, expected) {
          var pass;
          try { pass = JSON.stringify(actual) === JSON.stringify(expected); }
          catch (err) { pass = false; }
          results.push({ name: name, pass: pass, actual: pretty(actual), expected: pretty(expected) });
        }
        try {
          new Function("__check", msg.code + "\\n;\\n" + msg.tests)(__check);
          self.postMessage({ results: results });
        } catch (err) {
          self.postMessage({ error: String((err && err.message) || err), results: results });
        }
        return;
      }

      try {
        var fn = new Function(
          msg.code + "\\n;return typeof " + msg.fnName + " === 'function' ? " + msg.fnName + " : null;"
        )();
        if (!fn) throw new Error(msg.fnName + " is not defined");
        var compute = new Function("return (" + msg.computeSrc + ");")();
        self.postMessage({ data: compute(fn, msg.viz) });
      } catch (err) {
        self.postMessage({ error: String((err && err.message) || err) });
      }
    };
  `;

  /* file:// (and any context that blocks blob: workers) has no Worker, so the
     code runs inline. No timeout protection there — it is a fallback, not a
     supported mode; the account page already tells people to run the server. */
  function runJSInline(message) {
    if (message.mode === "tests") {
      const results = [];
      const pretty = (v) => { try { return JSON.stringify(v); } catch { return String(v); } };
      const check = (name, actual, expected) => {
        let pass;
        try { pass = JSON.stringify(actual) === JSON.stringify(expected); } catch { pass = false; }
        results.push({ name, pass, actual: pretty(actual), expected: pretty(expected) });
      };
      try {
        new Function("__check", message.code + "\n;\n" + message.tests)(check);
        return { results };
      } catch (err) {
        return { error: errorText(err), results };
      }
    }
    try {
      const fn = new Function(
        message.code + "\n;return typeof " + message.fnName + " === 'function' ? " + message.fnName + " : null;"
      )();
      if (!fn) throw new Error(message.fnName + " is not defined");
      const compute = new Function("return (" + message.computeSrc + ");")();
      return { data: compute(fn, message.viz) };
    } catch (err) {
      return { error: errorText(err) };
    }
  }

  function runJS(message, timeoutMs, timeoutMessage) {
    return new Promise((resolve) => {
      let worker;
      try {
        worker = spawnWorker(JS_WORKER_SRC);
      } catch {
        resolve(runJSInline(message));
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

      const timer = setTimeout(
        () => finish({ error: timeoutMessage, results: [] }),
        timeoutMs
      );
      worker.onmessage = (e) => finish(e.data);
      worker.onerror = (e) => finish({ error: e.message || "Worker error", results: [] });
      worker.postMessage(message);
    });
  }

  /* ============================================================
     Python — one long-lived Pyodide worker, runs serialized
     ============================================================ */

  const PY_PREAMBLE = [
    "import json, math",
    "__results = []",
    "def __check(name, actual, expected):",
    "    try:",
    "        ok = (actual == expected)",
    "    except Exception:",
    "        ok = False",
    "    def _p(v):",
    "        try:",
    "            return json.dumps(v)",
    "        except Exception:",
    "            return repr(v)",
    "    __results.append({'name': name, 'pass': bool(ok), 'actual': _p(actual), 'expected': _p(expected)})",
    "",
  ].join("\n");

  const PY_WORKER_SRC =
    'importScripts("' + PYODIDE_URL + 'pyodide.js");\n' +
    'const pyReady = loadPyodide({ indexURL: "' + PYODIDE_URL + '" }).then((py) => {\n' +
    '  self.postMessage({ type: "ready" });\n' +
    "  return py;\n" +
    "});\n" +
    "self.onmessage = async (e) => {\n" +
    "  const { program, tail, runId } = e.data;\n" +
    "  try {\n" +
    "    const py = await pyReady;\n" +
    "    await py.loadPackagesFromImports(program);\n" + // numpy/pandas fetched on demand
    "    py.runPython(program);\n" +
    "    const out = py.runPython(tail);\n" +
    '    self.postMessage({ type: "done", runId, out });\n' +
    "  } catch (err) {\n" +
    "    const msg = String((err && err.message) || err);\n" +
    "    const lines = msg.split(\"\\n\").filter(Boolean);\n" +
    '    self.postMessage({ type: "done", runId, error: lines.slice(-3).join(" — ") });\n' +
    "  }\n" +
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
    const program = PY_PREAMBLE + "\n" + code + "\n\n" + script + "\n";
    const tail = mode === "tests" ? "json.dumps(__results)" : "json.dumps(__out)";

    // The first run must cover the CDN download; scientific packages
    // (numpy ~8 MB, pandas ~14 MB) also download on their first import.
    const heavy = /(^|\n)\s*(import|from)\s+(numpy|pandas|matplotlib|scipy|sklearn)/.test(program);
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
        finish({
          error: bootFailed
            ? T("Could not load the Python runtime (offline?). JavaScript still works!")
            : T("Timed out — an infinite loop somewhere?"),
          results: [],
        });
      }, budget);

      const handler = (e) => {
        const d = e.data;
        if (!d || d.type !== "done" || d.runId !== runId) return;
        if (d.error) {
          finish({ error: d.error, results: [] });
        } else if (mode === "tests") {
          finish({ results: JSON.parse(d.out) });
        } else {
          finish({ data: JSON.parse(d.out) });
        }
      };

      worker.addEventListener("message", handler);
      worker.postMessage({ program, tail, runId });
    });
  }

  /* Queue so a second click can never land mid-run on the shared interpreter. */
  function pyRun(code, script, mode, onStatus) {
    const next = pyQueue.then(() => pyExecute(code, script, mode, onStatus));
    pyQueue = next.catch(() => {});
    return next;
  }

  /* ============================================================
     Results rendering — shared by the Lab, missions and lessons
     ============================================================ */

  function renderResults(el, out) {
    const results = (out && out.results) || [];
    let html = "";
    if (out && out.error) {
      html += '<div class="test-row fail">💥 ' + esc(out.error) + "</div>";
    }
    for (const r of results) {
      html +=
        '<div class="test-row ' + (r.pass ? "pass" : "fail") + '">' +
        (r.pass ? "✓ " : "✗ ") + esc(r.name) +
        (r.pass ? "" : '<span class="t-detail">expected ' + esc(r.expected) + " · got " + esc(r.actual) + "</span>") +
        "</div>";
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
      return runJS(
        { mode: "tests", code, tests },
        JS_TEST_TIMEOUT,
        "Timed out after 3s — infinite loop somewhere?"
      );
    },

    python(code, tests, onStatus) {
      return pyRun(code, tests, "tests", onStatus);
    },

    cpp(source, harness) {
      return fetch("/api/run-cpp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ source, harness }),
      })
        .then((r) => r.json())
        .catch(() => ({
          error: "Couldn't reach the C++ compiler. Run the site with `.venv/bin/python app.py` (not file://) to enable C++.",
          results: [],
        }));
    },

    /* --- visualization compute --- */

    /* `computeSrc` is the source of a self-contained (fn, viz) => data
       function; it is re-created inside the worker alongside the learner's
       code so nothing about the visualization touches the main thread. */
    computeJavascript(code, fnName, computeSrc, viz) {
      return runJS(
        { mode: "compute", code, fnName, computeSrc, viz },
        JS_COMPUTE_TIMEOUT,
        T("Timed out — an infinite loop somewhere?")
      );
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
  };
})();
