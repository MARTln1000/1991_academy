/* ============================================
   1991 Academy — Practice page
   Short spaced-repetition sessions built from
   the quizzes of lessons you've completed.
   ============================================ */

(function () {
  const root = document.getElementById("practice-root");
  const SESSION_SIZE = 12;

  Review.sync();

  let queue = [];
  let index = 0;
  let correct = 0;
  let earned = 0;

  function fmtWhen(ts) {
    const diff = ts - Date.now();
    if (diff <= 0) return t("now");
    const mins = Math.round(diff / 60000);
    if (mins < 60) return t("in {0} min", mins);
    const hours = Math.round(mins / 60);
    if (hours < 30) return t("in {0} h", hours);
    return t("in {0} days", Math.round(hours / 24));
  }

  function renderEmpty() {
    const next = Review.nextDueAt();
    const anyDone = Object.keys(Progress.allDone()).length > 0;
    root.innerHTML =
      '<div class="practice-card practice-done">' +
      '<div class="p-big">🌤️</div>' +
      "<h2>" + (anyDone ? t("Nothing due right now") : t("Nothing to review yet")) + "</h2>" +
      "<p>" +
      (anyDone
        ? next
          ? t("Your memory is fresh. Next review {0}.", fmtWhen(next))
          : t("Complete more lessons to grow your review deck.")
        : t("Finish a few lessons first — their questions become your personal review cards, scheduled for just before you'd forget them.")) +
      "</p>" +
      '<a class="btn btn-primary" href="index.html">' + t("Browse tracks") + "</a>" +
      "</div>";
  }

  function renderSummary() {
    root.innerHTML =
      '<div class="practice-card practice-done">' +
      '<div class="p-big">' + (correct === queue.length ? "🏆" : "💪") + "</div>" +
      "<h2>" + t("Session complete") + "</h2>" +
      "<p>" + t("{0}/{1} correct · +{2} XP earned.", correct, queue.length, earned) + "<br/>" +
      t("Every correct answer pushes the card further into the future — that's spaced repetition at work.") + "</p>" +
      '<div class="dash-actions" style="justify-content:center">' +
      (Review.dueCards().length
        ? '<button class="btn btn-primary" data-again>' + t("Another round ({0} due)", Review.dueCards().length) + "</button>"
        : "") +
      '<a class="btn" href="index.html">' + t("Home") + "</a></div></div>";

    const again = root.querySelector("[data-again]");
    if (again) again.addEventListener("click", start);
    XP.checkAchievements();
    XP.renderPill();
  }

  function renderCard() {
    if (index >= queue.length) return renderSummary();

    const card = queue[index];
    const resolved = Review.resolve(card);
    if (!resolved) {
      /* stale card (content edited) — skip it */
      index += 1;
      return renderCard();
    }
    const { q, lesson, track } = resolved;

    root.innerHTML =
      '<div class="practice-head">' +
      "<h1 style=\"font-size:1.5rem\">" + t("🧠 Practice") + "</h1>" +
      '<span class="p-count">' + (index + 1) + " / " + queue.length + "</span></div>" +
      '<div class="bar" style="margin-bottom:24px"><i style="width:' + Math.round((index / queue.length) * 100) + '%"></i></div>' +
      '<div class="practice-card">' +
      '<div class="p-source">' + esc(L(track, "title")) + " · " + esc(L(lesson, "title")) + "</div>" +
      '<p class="q-text" style="font-weight:600; margin-bottom:14px">' + esc(L(q, "q")) + "</p>" +
      '<div class="q-options">' +
      L(q, "options")
        .map(
          (opt, oi) =>
            '<button class="q-option" type="button" data-opt="' + oi + '"><span class="opt-key">' +
            optionLetter(oi) + "</span><span>" + esc(opt) + "</span></button>"
        )
        .join("") +
      "</div><div data-after></div></div>";

    root.querySelector(".q-options").addEventListener("click", (e) => {
      const btn = e.target.closest(".q-option");
      if (!btn || root.querySelector("[data-next]")) return;

      const oi = Number(btn.dataset.opt);
      const options = root.querySelectorAll(".q-option");
      options.forEach((o) => (o.disabled = true));
      if (options[q.answer]) options[q.answer].classList.add("correct");

      const isRight = oi === q.answer;
      if (isRight) {
        correct += 1;
        earned += XP.add(5);
      } else {
        btn.classList.add("wrong");
      }
      Review.grade(card.id, isRight);
      XP.bump("reviews");
      XP.renderPill();

      const after = root.querySelector("[data-after]");
      after.innerHTML =
        '<div class="q-explain">' + esc(L(q, "explain")) + "</div>" +
        '<div class="ex-actions" style="margin-top:14px">' +
        '<button class="btn btn-primary" data-next>' + (index + 1 < queue.length ? t("Next →") : t("Finish")) + "</button>" +
        '<a class="btn" href="tracks/' + track.id + '.html#' + lesson.id + '">' + t("Revisit lesson") + "</a></div>";

      after.querySelector("[data-next]").addEventListener("click", () => {
        index += 1;
        renderCard();
      });
    });
  }

  function start() {
    queue = Review.dueCards()
      .sort(() => Math.random() - 0.5)
      .slice(0, SESSION_SIZE);
    index = 0;
    correct = 0;
    earned = 0;
    if (!queue.length) return renderEmpty();
    renderCard();
  }

  renderStreakPill();
  XP.renderPill();
  start();

  /* A session in progress owns the screen — only refresh the pills when state
     arrives from elsewhere, never restart the queue mid-question. */
  onStateChanged(() => {
    renderStreakPill();
    XP.renderPill();
  });
})();
