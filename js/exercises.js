/* ============================================
   1991 Academy — Interactive exercises
   Parsons (reorder), faded blanks, matching,
   worked problems and graded code.
   Sandboxed execution lives in runner.js.
   ============================================ */

const Exercises = (() => {
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- Parsons: click lines into order ---------- */

  /* Never hand back the solution already in order — on the first draw or
     after a reset. */
  function scramble(lines) {
    if (lines.length < 2) return lines.slice();
    let out = shuffle(lines);
    for (let tries = 0; tries < 8 && out.join("\n") === lines.join("\n"); tries++) {
      out = shuffle(lines);
    }
    if (out.join("\n") === lines.join("\n")) out.reverse();
    return out;
  }

  function mountOrder(ex, root, onSolved) {
    let pool = scramble(ex.lines);
    let answer = [];

    function draw() {
      root.querySelector(".parsons-answer").innerHTML = answer
        .map((l, i) => '<button class="parsons-line" data-from="answer" data-i="' + i + '">' + esc(l) + "</button>")
        .join("") || '<span class="parsons-label" style="margin:0">' + t("click lines below to build the solution…") + "</span>";
      root.querySelector(".parsons-pool").innerHTML = pool
        .map((l, i) => '<button class="parsons-line" data-from="pool" data-i="' + i + '">' + esc(l) + "</button>")
        .join("") || '<span class="parsons-label" style="margin:0">' + t("empty") + "</span>";
    }

    root.innerHTML =
      '<div class="parsons-label">' + t("Your solution (top to bottom)") + "</div>" +
      '<div class="parsons-answer"></div>' +
      '<div class="parsons-label">' + t("Available lines") + "</div>" +
      '<div class="parsons-pool"></div>' +
      '<div class="ex-actions">' +
      '<button class="btn btn-primary" data-check>' + t("Check") + "</button>" +
      '<button class="btn" data-reset>' + t("Reset") + "</button>" +
      '<span class="ex-status"></span></div>';
    draw();

    root.addEventListener("click", (e) => {
      const line = e.target.closest(".parsons-line");
      if (line) {
        const i = Number(line.dataset.i);
        if (line.dataset.from === "pool") {
          answer.push(pool.splice(i, 1)[0]);
        } else {
          pool.push(answer.splice(i, 1)[0]);
        }
        draw();
        return;
      }
      if (e.target.closest("[data-reset]")) {
        pool = scramble(ex.lines);
        answer = [];
        root.querySelector(".ex-status").textContent = "";
        draw();
        return;
      }
      if (e.target.closest("[data-check]")) {
        const status = root.querySelector(".ex-status");
        if (answer.join("\n") === ex.lines.join("\n")) {
          status.textContent = t("✓ Exactly right!");
          status.className = "ex-status ok";
          onSolved();
        } else {
          status.textContent = answer.length < ex.lines.length ? t("Use every line.") : t("Not quite — check the order.");
          status.className = "ex-status bad";
          root.querySelector(".parsons-answer").classList.add("shake");
          setTimeout(() => root.querySelector(".parsons-answer").classList.remove("shake"), 700);
        }
      }
    });
  }

  /* ---------- Faded blanks: dropdowns inside code ---------- */

  function mountBlanks(ex, root, onSolved) {
    const html = esc(ex.code).replace(/\{\{(\d+)\}\}/g, (m, n) => {
      const blank = ex.blanks[Number(n)];
      const opts = shuffle(blank.options.map((o, i) => ({ o, i })));
      return (
        '<select class="blank-select" data-blank="' + n + '">' +
        '<option value="">…</option>' +
        opts.map((x) => '<option value="' + x.i + '">' + esc(x.o) + "</option>").join("") +
        "</select>"
      );
    });

    root.innerHTML =
      '<div class="blanks-code">' + html + "</div>" +
      '<div class="ex-actions">' +
      '<button class="btn btn-primary" data-check>' + t("Check") + "</button>" +
      '<span class="ex-status"></span></div>';

    root.querySelector("[data-check]").addEventListener("click", () => {
      const selects = root.querySelectorAll(".blank-select");
      let allCorrect = true;
      selects.forEach((sel) => {
        const blank = ex.blanks[Number(sel.dataset.blank)];
        const ok = Number(sel.value) === blank.answer;
        sel.classList.toggle("ok", ok);
        sel.classList.toggle("bad", !ok);
        if (!ok) allCorrect = false;
      });
      const status = root.querySelector(".ex-status");
      if (allCorrect) {
        status.textContent = t("✓ Compiles in your head!");
        status.className = "ex-status ok";
        onSolved();
      } else {
        status.textContent = t("Red blanks need another look.");
        status.className = "ex-status bad";
      }
    });
  }

  /* ---------- Matching pairs ---------- */

  function mountMatch(ex, root, onSolved) {
    const left = ex.pairs.map((p, i) => ({ text: p[0], i }));
    const right = shuffle(ex.pairs.map((p, i) => ({ text: p[1], i })));
    let selected = null;
    let matched = 0;

    root.innerHTML =
      '<div class="match-grid">' +
      '<div class="match-col">' +
      left.map((x) => '<button class="match-item" data-side="l" data-i="' + x.i + '">' + esc(x.text) + "</button>").join("") +
      "</div><div class=\"match-col\">" +
      right.map((x) => '<button class="match-item" data-side="r" data-i="' + x.i + '">' + esc(x.text) + "</button>").join("") +
      "</div></div>" +
      '<div class="ex-actions"><span class="ex-status"></span></div>';

    root.addEventListener("click", (e) => {
      const item = e.target.closest(".match-item");
      if (!item || item.classList.contains("matched")) return;

      if (item.dataset.side === "l") {
        root.querySelectorAll('.match-item[data-side="l"]').forEach((x) => x.classList.remove("selected"));
        item.classList.add("selected");
        selected = item;
        return;
      }
      if (!selected) return;

      if (item.dataset.i === selected.dataset.i) {
        item.classList.add("matched");
        selected.classList.add("matched");
        selected.classList.remove("selected");
        selected = null;
        matched += 1;
        if (matched === ex.pairs.length) {
          const status = root.querySelector(".ex-status");
          status.textContent = t("✓ All pairs matched!");
          status.className = "ex-status ok";
          onSolved();
        }
      } else {
        item.classList.add("flash");
        setTimeout(() => item.classList.remove("flash"), 500);
      }
    });
  }

  /* ---------- Worked problem (math): attempt → reveal → self-check ---------- */

  function mountProblem(ex, root, onSolved) {
    /* prompt/solution are author-trusted HTML (math markup), injected as-is */
    root.innerHTML =
      '<div class="problem-prompt">' + L(ex, "statement") + "</div>" +
      '<div class="ex-actions">' +
      '<button class="btn" data-reveal>' + t("Show worked answer") + "</button>" +
      '<button class="btn btn-primary" data-solved>' + t("I solved it ✓") + "</button>" +
      '<span class="ex-status"></span></div>' +
      '<div class="problem-solution" hidden><div class="ps-label">' + t("Worked answer") + "</div>" + L(ex, "solution") + "</div>";

    const solEl = root.querySelector(".problem-solution");
    const status = root.querySelector(".ex-status");

    if (window.typesetMath) window.typesetMath(root);

    root.querySelector("[data-reveal]").addEventListener("click", (e) => {
      solEl.hidden = !solEl.hidden;
      e.target.textContent = solEl.hidden ? t("Show worked answer") : t("Hide worked answer");
      if (!solEl.hidden && window.typesetMath) window.typesetMath(solEl);
    });

    root.querySelector("[data-solved]").addEventListener("click", () => {
      status.textContent = t("✓ Nice work — self-checked.");
      status.className = "ex-status ok";
      onSolved();
    });
  }

  /* ---------- Graded code exercise (in-lesson mini-Lab) ---------- */

  function mountCode(ex, root, onSolved) {
    if (typeof CodeEditor === "undefined" || typeof Runner === "undefined") {
      root.innerHTML = '<p class="ex-prompt">' + t("This exercise needs the code runtime — open it from its track page.") + "</p>";
      return;
    }
    root.innerHTML =
      '<div class="editor-host"></div>' +
      '<div class="ex-actions" style="margin-top:12px">' +
      '<button class="btn btn-primary" data-run>' + t("▶ Run tests") + "</button>" +
      '<button class="btn" data-reset-code>' + t("Reset") + "</button>" +
      '<span class="ex-status"></span></div>' +
      '<div class="test-results"></div>';

    const draftKey = ex.__draftKey;
    const editor = CodeEditor.create(root.querySelector(".editor-host"), {
      value: (draftKey && localStorage.getItem(draftKey)) || ex.starter,
      language: "python",
      filename: ex.fnName || "solution",
      onChange(v) {
        if (draftKey) {
          localStorage.setItem(draftKey, v);
          if (window.Sync) Sync.schedule();
        }
      },
    });

    const status = root.querySelector(".ex-status");
    const resultsEl = root.querySelector(".test-results");
    const runBtn = root.querySelector("[data-run]");

    root.querySelector("[data-reset-code]").addEventListener("click", () => {
      editor.setValue(ex.starter);
      if (draftKey) localStorage.removeItem(draftKey);
      resultsEl.innerHTML = "";
      status.textContent = "";
    });

    runBtn.addEventListener("click", async () => {
      runBtn.disabled = true;
      status.textContent = t("Running…");
      status.className = "ex-status";
      try {
        let out;
        try {
          out = await Runner.python(editor.getValue(), ex.tests, (msg) => {
            status.textContent = msg;
          });
        } catch (err) {
          out = { error: (err && err.message) || String(err), results: [] };
        }
        const summary = Runner.renderResults(resultsEl, out);
        status.textContent = Runner.statusText(out, summary);
        status.className = "ex-status " + (summary.allPass ? "ok" : "bad");
        if (summary.allPass) onSolved();
      } finally {
        runBtn.disabled = false;
      }
    });
  }

  const MOUNTERS = { order: mountOrder, blanks: mountBlanks, match: mountMatch, problem: mountProblem, code: mountCode };

  /* ---------- Public API ---------- */

  return {
    /* Render a lesson's exercises into `wrap`. onSolved(index) fires once per solve click. */
    mount(lesson, wrap, onSolved) {
      if (!lesson.exercises || !lesson.exercises.length || !wrap) return;
      lesson.exercises.forEach((ex, i) => {
        const mounter = MOUNTERS[ex.type];
        if (!mounter) {
          // A content typo must not take the rest of the lesson down with it.
          console.warn("Unknown exercise type " + JSON.stringify(ex.type) + " in lesson " + lesson.id);
          return;
        }
        const solvedBefore = typeof XP !== "undefined" && XP.has("ex:" + lesson.id + ":" + i);
        const box = document.createElement("div");
        box.className = "exercise";
        const icon = ex.type === "problem" ? "📝" : ex.type === "code" ? "🐍" : "🛠️";
        ex.__draftKey = "martinium:draft:ex:" + lesson.id + ":" + i;
        box.innerHTML =
          "<h3>" + icon + " " + esc(L(ex, "title")) +
          (ex.source ? ' <span class="ex-source">' + esc(ex.source) + "</span>" : "") +
          (solvedBefore ? ' <span class="ex-status ok">' + t("✓ solved") + "</span>" : "") + "</h3>" +
          '<p class="ex-prompt">' + esc(L(ex, "prompt")) + "</p>" +
          '<div class="ex-body"></div>';
        wrap.appendChild(box);
        let fired = false;
        try {
          mounter(ex, box.querySelector(".ex-body"), () => {
            if (fired) return;
            fired = true;
            onSolved(i);
          });
        } catch (err) {
          console.error("Exercise " + lesson.id + ":" + i + " failed to mount", err);
          box.querySelector(".ex-body").innerHTML =
            '<p class="ex-status bad">' + t("This exercise could not be loaded.") + "</p>";
        }
      });
    },
  };
})();
