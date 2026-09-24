/* ============================================
   1991 Academy — The Lab
   LeetCode-style problems + from-scratch ML/DL
   builds. JavaScript or Python, real editor,
   sandboxed tests, code-driven visuals.
   ============================================ */

(function () {
  const root = document.getElementById("lab-root");
  const problems = M.lab;
  const DRAFT_PREFIX = "martinium:draft:lab:";
  const LANG_PREFIX = "martinium:lablang:";

  const DIFF = {
    easy: { label: "Easy", cls: "d-easy" },
    medium: { label: "Medium", cls: "d-medium" },
    hard: { label: "Hard", cls: "d-hard" },
  };

  const TRACK_LABEL = { dsa: "Algorithms", ml: "Machine Learning", dl: "Deep Learning" };
  const TRACK_COLORS = {
    dsa: ["rgba(251,113,133,0.14)", "#fb7185"],
    ml: ["rgba(168,85,247,0.14)", "#a855f7"],
    dl: ["rgba(34,211,238,0.14)", "#22d3ee"],
  };
  const FALLBACK_COLORS = ["var(--accent-soft)", "var(--accent)"];

  let filter = "all";

  const solved = (p) => XP.has("lab:" + p.id);

  function chips(p) {
    const [bg, fg] = TRACK_COLORS[p.track] || FALLBACK_COLORS;
    const d = DIFF[p.difficulty] || { label: p.difficulty || "", cls: "" };
    return (
      '<span class="track-chip" style="--chip-bg:' + bg + ";--chip-fg:" + fg + '">' +
      esc(t(TRACK_LABEL[p.track] || p.track)) + "</span>" +
      (d.label ? '<span class="diff-chip ' + d.cls + '">' + esc(t(d.label)) + "</span>" : "") +
      (p.py ? '<span class="diff-chip d-py">JS · PY</span>' : "") +
      (p.viz ? '<span class="diff-chip d-viz">' + t("📊 visual") + "</span>" : "")
    );
  }

  /* ---------- List ---------- */

  function renderList() {
    LabViz.stop();
    const shown = problems.filter((p) => filter === "all" || p.track === filter);
    const done = problems.filter(solved).length;

    root.innerHTML =
      '<div class="section">' +
      '<h1 class="section-title" style="font-size:2rem">' + t("🧪 The Lab") + "</h1>" +
      '<p class="section-sub">' + t("Don't just read about algorithms and models — write them in <strong>JavaScript or Python</strong>, test them, and <strong>watch your own code run</strong>. ") +
      t("{0} of {1} solved.", done, problems.length) + "</p>" +
      '<div class="lab-filters">' +
      ["all", "dsa", "ml", "dl"]
        .map(
          (f) =>
            '<button class="lab-filter' + (filter === f ? " active" : "") + '" data-filter="' + f + '">' +
            (f === "all" ? t("All") : t(TRACK_LABEL[f])) + "</button>"
        )
        .join("") +
      "</div>" +
      '<div class="missions-grid">' +
      shown
        .map(
          (p) =>
            '<a class="mission-card unlocked" href="lab.html#' + p.id + '">' +
            '<div class="mission-top"><div class="mission-tracks">' + chips(p) + "</div>" +
            (solved(p) ? '<span class="ex-status ok">✓</span>' : "") + "</div>" +
            "<h3>" + esc(L(p, "title")) + "</h3>" +
            '<p class="m-blurb">' + esc(L(p, "blurb")) + "</p>" +
            '<div class="mission-state' + (solved(p) ? " done" : "") + '">' +
            (solved(p) ? t("✓ Solved · {0} XP earned", p.xp) : t("▶ Reward {0} XP", p.xp)) +
            "</div></a>"
        )
        .join("") +
      "</div></div>";

    root.querySelectorAll("[data-filter]").forEach((btn) =>
      btn.addEventListener("click", () => {
        filter = btn.dataset.filter;
        renderList();
      })
    );
  }

  /* ---------- Detail ---------- */

  const SUFFIX = { python: ":py", cpp: ":cpp", javascript: "" };

  function draftKey(p, lang) {
    return DRAFT_PREFIX + p.id + (SUFFIX[lang] || "");
  }

  function starterFor(p, lang) {
    if (lang === "python") return p.py.starter;
    if (lang === "cpp") return p.cpp.starter;
    return p.starter;
  }

  function renderDetail(p) {
    LabViz.stop();
    const wasSolved = solved(p);
    let lang = localStorage.getItem(LANG_PREFIX + p.id) || "javascript";
    if (lang === "python" && !p.py) lang = "javascript";
    if (lang === "cpp" && !p.cpp) lang = "javascript";

    root.innerHTML =
      '<div class="mission-detail">' +
      '<a class="back-link" href="lab.html" style="margin-bottom:20px; display:inline-flex">' + t("← All problems") + "</a>" +
      '<div class="mission-top" style="margin:14px 0 6px"><div class="mission-tracks">' + chips(p) + "</div></div>" +
      "<h1 style=\"margin-bottom:14px\">" + esc(L(p, "title")) +
      (wasSolved ? ' <span class="ex-status ok" style="font-size:1rem">' + t("✓ solved") + "</span>" : "") + "</h1>" +
      '<div class="lesson-body">' + L(p, "brief") + "</div>" +
      '<div class="editor-host"></div>' +
      '<div class="ex-actions" style="margin-top:14px">' +
      '<button class="btn btn-primary" data-run>' + t("▶ Run tests") + "</button>" +
      (p.viz ? '<button class="btn" data-viz' + (wasSolved ? "" : " disabled") + ">" + t("📊 Visualize my code") + "</button>" : "") +
      '<button class="btn" data-reset-code>' + t("Reset code") + "</button>" +
      '<span class="ex-status"></span></div>' +
      '<div class="test-results"></div>' +
      (p.viz ? '<div class="viz-panel" hidden><canvas class="viz-canvas"></canvas><p class="viz-note"></p></div>' : "") +
      '<div class="hint-box">' +
      L(p, "hints").map((h, i) => "<details><summary>" + t("Hint {0}", i + 1) + "</summary><p>" + esc(h) + "</p></details>").join("") +
      "</div></div>";

    const resultsEl = root.querySelector(".test-results");
    const status = root.querySelector(".ex-status");
    const vizBtn = root.querySelector("[data-viz]");
    const vizPanel = root.querySelector(".viz-panel");
    const runBtn = root.querySelector("[data-run]");

    const languages = [{ id: "javascript", label: "JavaScript" }];
    if (p.py) languages.push({ id: "python", label: "Python" });
    if (p.cpp) languages.push({ id: "cpp", label: "C++" });
    else languages.push({ id: "cpp", label: "C++ · n/a here", disabled: true });

    const fnNameFor = (l) => (l === "python" ? p.py.fnName : l === "cpp" ? p.cpp.fnName : p.fnName);

    const editor = CodeEditor.create(root.querySelector(".editor-host"), {
      value: localStorage.getItem(draftKey(p, lang)) ?? starterFor(p, lang),
      language: lang,
      languages,
      filename: fnNameFor(lang),
      onChange(v) {
        localStorage.setItem(draftKey(p, lang), v);
        if (window.Sync) Sync.schedule();
      },
      onLanguageChange(next) {
        if (next === lang || (next === "python" && !p.py) || (next === "cpp" && !p.cpp)) return;
        localStorage.setItem(draftKey(p, lang), editor.getValue());
        lang = next;
        localStorage.setItem(LANG_PREFIX + p.id, lang);
        editor.setLanguage(lang);
        editor.setFilename(fnNameFor(lang)); /* the tab shows two_sum.py, not twoSum.py */
        editor.setValue(localStorage.getItem(draftKey(p, lang)) ?? starterFor(p, lang));
        resultsEl.innerHTML = "";
        status.textContent = "";
        if (vizBtn) vizBtn.hidden = lang === "cpp"; /* C++ runs on the server, no canvas hook */
        if (lang === "python") Runner.warmPython(); /* start the download early */
      },
    });
    if (lang === "python") Runner.warmPython();
    if (vizBtn && lang === "cpp") vizBtn.hidden = true;

    root.querySelector("[data-reset-code]").addEventListener("click", () => {
      editor.setValue(starterFor(p, lang));
      localStorage.removeItem(draftKey(p, lang));
      resultsEl.innerHTML = "";
      status.textContent = "";
    });

    function showResults(out) {
      const summary = Runner.renderResults(resultsEl, out);
      status.textContent = Runner.statusText(out, summary);
      status.className = "ex-status " + (summary.allPass ? "ok" : "bad");
      if (!summary.allPass) return;

      if (vizBtn) {
        vizBtn.disabled = false;
        status.textContent += t(" Now hit Visualize →");
      }
      if (XP.add(p.xp, "lab:" + p.id)) {
        XP.bump("labs");
        toast(t("🧪 Solved! +{0} XP", p.xp));
        XP.checkAchievements();
        XP.renderPill();
      }
    }

    function runTests() {
      const code = editor.getValue();
      if (lang === "python") return Runner.python(code, p.py.tests, (msg) => { status.textContent = msg; });
      if (lang === "cpp") return Runner.cpp(code, p.cpp.tests);
      return Runner.javascript(code, p.tests);
    }

    runBtn.addEventListener("click", async () => {
      runBtn.disabled = true;
      status.textContent = t("Running…");
      status.className = "ex-status";
      try {
        showResults(await runTests());
      } catch (err) {
        // A runner should always resolve, but never leave the learner staring
        // at "Running…" if one ever throws.
        showResults({ error: (err && err.message) || String(err), results: [] });
      } finally {
        runBtn.disabled = false;
      }
    });

    if (vizBtn) {
      vizBtn.addEventListener("click", async () => {
        vizPanel.hidden = false;
        const note = vizPanel.querySelector(".viz-note");
        const canvas = vizPanel.querySelector(".viz-canvas");
        const renderer = LabViz.render[p.viz.kind];
        const computeSrc = LabViz.computeSource(p.viz.kind);
        if (!renderer || !computeSrc) {
          note.textContent = "💥 unknown visualization: " + p.viz.kind;
          return;
        }

        vizBtn.disabled = true;
        LabViz.stop();
        note.textContent = t("Running…");
        vizPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
        try {
          /* Both paths execute in a Worker — the learner's code never runs on
             the main thread, so a runaway loop here can't freeze the page. */
          const out = lang === "python"
            ? await Runner.computePython(editor.getValue(), p.py.vizScript(p.viz), (msg) => { note.textContent = msg; })
            : await Runner.computeJavascript(editor.getValue(), p.fnName, computeSrc, p.viz);

          if (out.error) {
            note.textContent = "💥 " + out.error;
          } else {
            renderer(out.data, p.viz, canvas, (msg) => { note.textContent = msg; });
          }
        } catch (err) {
          note.textContent = "💥 " + (err && err.message ? err.message : String(err));
        } finally {
          vizBtn.disabled = false;
        }
      });
    }
  }

  /* ---------- Routing ---------- */

  function render() {
    const id = location.hash.replace("#", "");
    const p = problems.find((x) => x.id === id);
    if (p) renderDetail(p);
    else renderList();
    renderStreakPill();
    XP.renderPill();
    window.scrollTo({ top: 0 });
  }

  window.addEventListener("hashchange", render);
  /* A sync pull or another tab changed our XP/progress: refresh the pills and
     the solved badges rather than showing stale state. Skipped while a detail
     view is open so we never yank the editor out from under someone typing. */
  onStateChanged(() => {
    if (location.hash.replace("#", "")) {
      renderStreakPill();
      XP.renderPill();
    } else {
      render();
    }
  });
  render();
})();
