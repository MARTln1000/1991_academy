/* ============================================
   1991 Academy — Missions page
   Card list with prerequisite locks + a detail
   view with editor (JavaScript, Python or
   C++), sandboxed tests and XP.
   ============================================ */

(function () {
  const root = document.getElementById("missions-root");
  const missions = M.missions;
  const DRAFT_PREFIX = "1991_academy:draft:";
  const LANG_PREFIX = "1991_academy:missionlang:";
  const LANG_LABEL = { javascript: "JavaScript", python: "Python", cpp: "C++" };
  /* JavaScript drafts keep their original key, so nobody's saved work moves. */
  const SUFFIX = { python: ":py", cpp: ":cpp", javascript: "" };

  const TRACK_CHIP_COLORS = {
    web: ["rgba(245,158,11,0.14)", "#f59e0b"],
    ml: ["rgba(168,85,247,0.14)", "#a855f7"],
    dl: ["rgba(34,211,238,0.14)", "#22d3ee"],
    agents: ["rgba(52,211,153,0.14)", "#34d399"],
    dsa: ["rgba(251,113,133,0.14)", "#fb7185"],
  };

  function findLesson(id) {
    for (const track of Object.values(M.tracks)) {
      for (const mod of track.modules) {
        for (const lesson of mod.lessons) {
          if (lesson.id === id) return { lesson, track };
        }
      }
    }
    return null;
  }

  function missionState(m) {
    if (XP.has("mission:" + m.id)) return "done";
    const done = Progress.allDone();
    return m.prereqs.every((p) => done[p]) ? "unlocked" : "locked";
  }

  function chips(m) {
    return (
      '<div class="mission-tracks">' +
      m.tracks
        .map((tid) => {
          const [bg, fg] = TRACK_CHIP_COLORS[tid] || ["var(--accent-soft)", "var(--accent)"];
          const name = M.tracks[tid] ? L(M.tracks[tid], "title").split(" ")[0] : tid;
          return '<span class="track-chip" style="--chip-bg:' + bg + ";--chip-fg:" + fg + '">' + esc(name) + "</span>";
        })
        .join("") +
      "</div>"
    );
  }

  window.renderMissionCard = function (m, base) {
    const state = missionState(m);
    const done = Progress.allDone();
    const stateHtml =
      state === "done"
        ? '<div class="mission-state done">' + t("✓ Completed · {0} XP earned", m.xp) + "</div>"
        : state === "unlocked"
          ? '<div class="mission-state">' + t("▶ Ready · reward {0} XP", m.xp) + "</div>"
          : '<div class="mission-locks">' + t("🔒 Unlocks after: ") +
            m.prereqs
              .filter((p) => !done[p])
              .map((p) => {
                const found = findLesson(p);
                return found
                  ? '<a href="' + base + "tracks/" + found.track.id + ".html#" + p + '">' + esc(L(found.lesson, "title")) + "</a>"
                  : p;
              })
              .join(" · ") +
            "</div>";

    const inner =
      '<div class="mission-top"><span class="mission-icon">' + m.icon + "</span>" + chips(m) + "</div>" +
      "<h3>" + esc(L(m, "title")) + "</h3>" +
      '<p class="m-blurb">' + esc(L(m, "blurb")) + "</p>" +
      stateHtml;

    return state === "locked"
      ? '<div class="mission-card locked">' + inner + "</div>"
      : '<a class="mission-card unlocked" href="' + base + "missions.html#" + m.id + '">' + inner + "</a>";
  };

  if (!root) return; /* included on other pages just for renderMissionCard */

  /* ---------- List view ---------- */

  function renderList() {
    const unlocked = missions.filter((m) => missionState(m) !== "locked").length;
    root.innerHTML =
      '<div class="section">' +
      '<h1 class="section-title" style="font-size:2rem">' + t("🛰️ Missions") + "</h1>" +
      '<p class="section-sub">' + t("Real problems that need knowledge from more than one track — this is where the lessons click together. ") +
      t("{0} of {1} unlocked.", unlocked, missions.length) + "</p>" +
      '<div class="missions-grid">' +
      missions.map((m) => renderMissionCard(m, "")).join("") +
      "</div></div>";
  }

  /* ---------- Detail view ---------- */

  const variantFor = (m, lang) => (lang === "python" ? m.py : lang === "cpp" ? m.cpp : m);
  const draftKey = (m, lang) => DRAFT_PREFIX + m.id + (SUFFIX[lang] || "");

  function hintsHtml(m, lang) {
    const hints = L(m, "hints").map((h, i) => "<details><summary>" + t("Hint {0}", i + 1) + "</summary><p>" + esc(h) + "</p></details>");
    const variant = lang === "javascript" ? null : variantFor(m, lang);
    if (variant && variant.hint) {
      hints.push("<details><summary>" + t("Hint for {0}", LANG_LABEL[lang]) + "</summary><p>" + esc(L(variant, "hint")) + "</p></details>");
    }
    return hints.join("");
  }

  function renderDetail(m) {
    const doneBefore = XP.has("mission:" + m.id);
    let lang = localStorage.getItem(LANG_PREFIX + m.id) || "javascript";
    if (!variantFor(m, lang)) lang = "javascript";

    root.innerHTML =
      '<div class="mission-detail">' +
      '<a class="back-link" href="missions.html" style="margin-bottom:20px; display:inline-flex">' + t("← All missions") + "</a>" +
      '<div class="mission-top" style="margin:14px 0 6px"><span class="mission-icon" style="font-size:2.2rem">' + m.icon + "</span>" + chips(m) + "</div>" +
      "<h1 style=\"margin-bottom:14px\">" + esc(L(m, "title")) + (doneBefore ? ' <span class="ex-status ok" style="font-size:1rem">' + t("✓ completed") + "</span>" : "") + "</h1>" +
      '<div class="lesson-body">' + L(m, "brief") + "</div>" +
      '<div class="editor-host"></div>' +
      '<div class="ex-actions" style="margin-top:14px">' +
      '<button class="btn btn-primary" data-run>' + t("▶ Run tests") + "</button>" +
      '<button class="btn" data-reset-code>' + t("Reset code") + "</button>" +
      '<span class="ex-status"></span></div>' +
      '<div class="test-results"></div>' +
      '<div class="hint-box">' + hintsHtml(m, lang) + "</div></div>";

    const resultsEl = root.querySelector(".test-results");
    const status = root.querySelector(".ex-status");
    const hintBox = root.querySelector(".hint-box");

    const languages = ["javascript", "python", "cpp"]
      .filter((l) => variantFor(m, l))
      .map((l) => ({ id: l, label: LANG_LABEL[l] }));
    const filenameFor = (l) => (l === "javascript" ? m.id.replace("mission-", "") : variantFor(m, l).fnName);
    const starterFor = (l) => variantFor(m, l).starter;

    const editor = CodeEditor.create(root.querySelector(".editor-host"), {
      value: localStorage.getItem(draftKey(m, lang)) ?? starterFor(lang),
      language: lang,
      languages,
      filename: filenameFor(lang),
      onChange(v) {
        localStorage.setItem(draftKey(m, lang), v);
        if (window.Sync) Sync.schedule();
      },
      onLanguageChange(next) {
        if (next === lang || !variantFor(m, next)) return;
        localStorage.setItem(draftKey(m, lang), editor.getValue());
        lang = next;
        localStorage.setItem(LANG_PREFIX + m.id, lang);
        editor.setLanguage(lang);
        editor.setFilename(filenameFor(lang));
        editor.setValue(localStorage.getItem(draftKey(m, lang)) ?? starterFor(lang));
        resultsEl.innerHTML = "";
        status.textContent = "";
        hintBox.innerHTML = hintsHtml(m, lang);
        if (lang === "python") Runner.warmPython(); /* start the download early */
      },
    });
    if (lang === "python") Runner.warmPython();

    root.querySelector("[data-reset-code]").addEventListener("click", () => {
      editor.setValue(starterFor(lang));
      localStorage.removeItem(draftKey(m, lang));
      resultsEl.innerHTML = "";
      status.textContent = "";
    });

    function runTests() {
      const code = editor.getValue();
      if (lang === "python") return Runner.python(code, m.py.tests, (msg) => { status.textContent = msg; });
      if (lang === "cpp") return Runner.cpp(code, m.cpp.tests, m.cpp.prelude);
      return Runner.javascript(code, m.tests);
    }

    const runBtn = root.querySelector("[data-run]");
    runBtn.addEventListener("click", async () => {
      runBtn.disabled = true;
      status.textContent = t("Running…");
      status.className = "ex-status";
      try {
        let out;
        try {
          out = await runTests();
        } catch (err) {
          out = { error: (err && err.message) || String(err), results: [] };
        }
        const summary = Runner.renderResults(resultsEl, out);
        status.textContent = Runner.statusText(out, summary);
        status.className = "ex-status " + (summary.allPass ? "ok" : "bad");
        if (summary.allPass && XP.add(m.xp, "mission:" + m.id)) {
          XP.bump("missions");
          toast(t("🚀 Mission complete! +{0} XP", m.xp));
          XP.checkAchievements();
          XP.renderPill();
        }
      } finally {
        runBtn.disabled = false;
      }
    });
  }

  /* ---------- Routing ---------- */

  function render() {
    const id = location.hash.replace("#", "");
    const m = missions.find((x) => x.id === id);
    if (m && missionState(m) !== "locked") {
      renderDetail(m);
    } else {
      renderList();
    }
    renderStreakPill();
    XP.renderPill();
    window.scrollTo({ top: 0 });
  }

  window.addEventListener("hashchange", render);
  /* Keep the lock states honest when progress arrives from a sync or another
     tab — but don't redraw an open editor out from under the learner. */
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
