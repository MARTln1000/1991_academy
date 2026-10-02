/* ============================================
   1991 Academy — The Lab
   LeetCode-style problems + from-scratch ML/DL
   builds, in Python. Each one is solved in
   Google Colab (colab.js): task, starter code,
   tests and a plot of what the learner's code
   does.
   ============================================ */

(function () {
  const root = document.getElementById("lab-root");
  const problems = M.lab;
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
      '<span class="diff-chip d-py">Python</span>' +
      (p.viz ? '<span class="diff-chip d-viz">' + t("📊 visual") + "</span>" : "")
    );
  }

  /* ---------- List ---------- */

  function renderList() {
    const shown = problems.filter((p) => filter === "all" || p.track === filter);
    const done = problems.filter(solved).length;

    root.innerHTML =
      '<div class="section">' +
      '<h1 class="section-title" style="font-size:2rem">' + t("🧪 The Lab") + "</h1>" +
      '<p class="section-sub">' + t("Don't just read about algorithms and models — write them yourself in <strong>Python</strong> in Google Colab, test them, and <strong>plot what your own code does</strong>. ") +
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

  function hintsHtml(p) {
    return L(p, "hints").map((h, i) => "<details><summary>" + t("Hint {0}", i + 1) + "</summary><p>" + esc(h) + "</p></details>").join("");
  }

  function renderDetail(p) {
    const wasSolved = solved(p);
    root.innerHTML =
      '<div class="mission-detail">' +
      '<a class="back-link" href="lab.html" style="margin-bottom:20px; display:inline-flex">' + t("← All problems") + "</a>" +
      '<div class="mission-top" style="margin:14px 0 6px"><div class="mission-tracks">' + chips(p) + "</div></div>" +
      "<h1 style=\"margin-bottom:14px\">" + esc(L(p, "title")) +
      (wasSolved ? ' <span class="ex-status ok" style="font-size:1rem">' + t("✓ solved") + "</span>" : "") + "</h1>" +
      '<div class="lesson-body">' + L(p, "brief") + "</div>" +
      (p.viz ? '<p class="colab-note">' + t("📊 The notebook also plots what your code does.") + "</p>" : "") +
      Colab.panel(p.id, wasSolved) +
      '<div class="hint-box">' + hintsHtml(p) + "</div></div>";

    Colab.wire(root, () => {
      if (XP.add(p.xp, "lab:" + p.id)) {
        XP.bump("labs");
        toast(t("🧪 Solved! +{0} XP", p.xp));
        XP.checkAchievements();
        XP.renderPill();
      }
    });
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
     view is open, which has nothing that depends on them. */
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
