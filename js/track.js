/* ============================================
   1991 Academy — Track page
   Sidebar curriculum, lesson reader, quiz
   engine, completion + hash routing.
   ============================================ */

(function () {
  const trackId = document.body.dataset.track;
  const track = M.tracks[trackId];
  if (!track) return;

  const lessons = allLessons(track);
  const sidebarEl = document.getElementById("sidebar");
  const lessonEl = document.getElementById("lesson");

  document.title = L(track, "title") + " — 1991 Academy";

  /* ---------- State ---------- */

  function currentLessonId() {
    const hash = location.hash.replace("#", "");
    if (lessons.some((l) => l.id === hash)) return hash;
    const firstIncomplete = lessons.find((l) => !Progress.isDone(l.id));
    return (firstIncomplete || lessons[0]).id;
  }

  function lessonIndex(id) {
    return lessons.findIndex((l) => l.id === id);
  }

  function moduleOf(lessonId) {
    return track.modules.find((m) => m.lessons.some((l) => l.id === lessonId));
  }

  /* ---------- Sidebar ---------- */

  function renderSidebar(activeId) {
    const stats = Progress.trackStats(track);
    let html =
      '<div class="track-progress-box">' +
      '<div class="tp-label"><span>' + t("Track progress") + "</span><span>" + stats.pct + "%</span></div>" +
      '<div class="bar"><i style="width:' + stats.pct + '%"></i></div>' +
      "</div>";

    for (const mod of track.modules) {
      const done = mod.lessons.filter((l) => Progress.isDone(l.id)).length;
      html +=
        '<div class="module-group">' +
        '<div class="module-head"><h4>' + esc(L(mod, "title")) + "</h4><span>" + done + "/" + mod.lessons.length + "</span></div>";
      for (const l of mod.lessons) {
        const cls = [
          "lesson-item",
          l.id === activeId ? "active" : "",
          Progress.isDone(l.id) ? "done" : "",
        ].join(" ");
        html +=
          '<button class="' + cls + '" data-goto="' + l.id + '">' +
          '<span class="check">✓</span>' +
          "<span>" + esc(L(l, "title")) + "</span>" +
          "</button>";
      }
      html += "</div>";
    }
    sidebarEl.innerHTML = html;
  }

  /* ---------- Quiz ---------- */

  function renderQuiz(lesson) {
    if (!lesson.quiz || !lesson.quiz.length) return "";
    let html =
      '<div class="quiz" data-quiz>' +
      "<h3>" + t("🧠 Check yourself") + "</h3>" +
      '<p class="quiz-sub">' + t("Active recall beats re-reading. Answer before you peek.") + "</p>";
    lesson.quiz.forEach((q, qi) => {
      html += '<div class="quiz-q" data-q="' + qi + '"><p class="q-text">' + esc(L(q, "q")) + "</p><div class=\"q-options\">";
      L(q, "options").forEach((opt, oi) => {
        html +=
          '<button class="q-option" type="button" data-q="' + qi + '" data-opt="' + oi + '">' +
          '<span class="opt-key">' + optionLetter(oi) + "</span>" +
          "<span>" + esc(opt) + "</span>" +
          "</button>";
      });
      html += "</div></div>";
    });
    html += "</div>";
    return html;
  }

  function bindQuiz(lesson) {
    const quizEl = lessonEl.querySelector("[data-quiz]");
    if (!quizEl) return;
    const answered = new Set();
    let score = 0;
    let earned = 0;

    quizEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".q-option");
      if (!btn) return;
      const qi = Number(btn.dataset.q);
      if (answered.has(qi)) return;
      answered.add(qi);

      const q = lesson.quiz[qi];
      const oi = Number(btn.dataset.opt);
      const options = quizEl.querySelectorAll('.q-option[data-q="' + qi + '"]');
      options.forEach((o) => (o.disabled = true));
      if (options[q.answer]) options[q.answer].classList.add("correct");
      if (oi === q.answer) {
        score += 1;
        earned += XP.add(5, "q:" + lesson.id + ":" + qi);
      } else {
        btn.classList.add("wrong");
      }

      const explain = document.createElement("div");
      explain.className = "q-explain";
      explain.textContent = L(q, "explain");
      quizEl.querySelector('.quiz-q[data-q="' + qi + '"]').appendChild(explain);

      if (answered.size === lesson.quiz.length) {
        Progress.saveQuiz(lesson.id, score, lesson.quiz.length);
        const perfect = score === lesson.quiz.length;
        let bonusText = "";
        if (perfect && !XP.has("perfect:" + lesson.id)) {
          /* variable reward: a surprise-sized bonus for a first-try perfect */
          const bonus = 10 + Math.floor(Math.random() * 16);
          XP.add(bonus, "perfect:" + lesson.id);
          XP.bump("perfectQuizzes");
          earned += bonus;
          bonusText = t(" ✨ perfect bonus included!");
        }
        const result = document.createElement("div");
        result.className = "quiz-result";
        result.textContent =
          (perfect
            ? t("🎉 Perfect — {0}/{1}!", score, lesson.quiz.length)
            : t("You scored {0}/{1}.", score, lesson.quiz.length)) +
          (earned > 0 ? t(" +{0} XP.", earned) : "") +
          bonusText +
          (perfect ? t(" Mark the lesson complete.") : t(" Skim the lesson once more, then move on."));
        quizEl.appendChild(result);
        XP.checkAchievements();
        XP.renderPill();
      }
    });
  }

  /* ---------- Lesson reader ---------- */

  function renderLesson(id) {
    const lesson = lessons.find((l) => l.id === id);
    const mod = moduleOf(id);
    const idx = lessonIndex(id);
    const prev = lessons[idx - 1];
    const next = lessons[idx + 1];
    const done = Progress.isDone(id);

    let html =
      '<span class="lesson-kicker">' + esc(L(mod, "title")) + " · " + t("Lesson {0} of {1}", idx + 1, lessons.length) + "</span>" +
      "<h1>" + esc(L(lesson, "title")) + "</h1>" +
      '<div class="lesson-meta"><span>' + t("⏱ {0} min read", lesson.minutes) + "</span>" +
      (lesson.quiz && lesson.quiz.length ? "<span>" + t("🧠 {0}-question quiz", lesson.quiz.length) + "</span>" : "") +
      (lesson.videos && lesson.videos.length ? "<span>" + t("🎬 {0} video(s)", lesson.videos.length) + "</span>" : "") +
      "</div>" +
      '<div class="lesson-body">' + L(lesson, "content") + "</div>";

    if (lesson.materials && lesson.materials.length) {
      html +=
        '<div class="materials"><h3 class="videos-title">' + t("📂 Course materials") + "</h3>" +
        '<div class="mat-row">' +
        lesson.materials
          .map((m) => '<a class="btn" href="' + encodeURI(m.href) + '" download>⤓ ' + esc(L(m, "label")) + "</a>")
          .join("") +
        "</div></div>";
    }

    if (lesson.videos && lesson.videos.length) {
      html +=
        '<div class="videos"><h3 class="videos-title">' + t("🎬 Video lessons") + "</h3>" +
        '<p class="videos-sub">' + t("Hand-picked free courses from the best teachers — click and watch right here.") + "</p>" +
        '<div class="video-grid">' +
        lesson.videos
          .map(
            (v) =>
              '<div class="video-card" data-video="' + v.id + '" role="button" tabindex="0" aria-label="Play: ' + esc(v.title) + '">' +
              '<div class="video-thumb"><img loading="lazy" decoding="async" width="480" height="360" src="https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg" alt="" />' +
              '<span class="video-play">▶</span></div>' +
              '<div class="video-meta"><strong>' + esc(v.title) + "</strong><span>" + esc(v.channel) + " · " + esc(v.length) + "</span></div></div>"
          )
          .join("") +
        "</div></div>";
    }

    if (lesson.takeaways && lesson.takeaways.length) {
      html +=
        '<div class="takeaways"><h3>' + t("Key takeaways") + "</h3><ul>" +
        L(lesson, "takeaways").map((x) => "<li>" + x + "</li>").join("") +
        "</ul></div>";
    }

    html += '<div id="ex-wrap"></div>';
    html += renderQuiz(lesson);

    html +=
      '<div class="lesson-nav">' +
      '<button class="btn" data-goto="' + (prev ? prev.id : "") + '"' + (prev ? "" : " disabled") + ">" + t("← Previous") + "</button>" +
      '<button class="btn ' + (done ? "btn-done" : "btn-primary") + '" data-complete>' +
      (done ? t("✓ Completed") : t("Mark as complete")) +
      "</button>" +
      '<button class="btn push" data-goto="' + (next ? next.id : "") + '"' + (next ? "" : " disabled") + ">" + t("Next →") + "</button>" +
      "</div>" +
      '<p class="kbd-hint">' + t("Navigate with <kbd>[</kbd> and <kbd>]</kbd>.") + "</p>";

    lessonEl.innerHTML = html;
    lessonEl.style.animation = "none";
    void lessonEl.offsetWidth; /* restart entry animation */
    lessonEl.style.animation = "";

    bindQuiz(lesson);
    Exercises.mount(lesson, lessonEl.querySelector("#ex-wrap"), (i) => {
      const got = XP.add(15, "ex:" + lesson.id + ":" + i);
      if (got) {
        XP.bump("exercises");
        toast(t("🛠️ Exercise solved! +15 XP"));
        XP.checkAchievements();
        XP.renderPill();
      } else {
        toast(t("✓ Solved again — still got it."));
      }
    });
    if (window.typesetMath) window.typesetMath(lessonEl); /* render \( … \) math if KaTeX is loaded */
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- Navigation & completion ---------- */

  function goto(id) {
    if (!id) return;
    if (location.hash === "#" + id) {
      render();
    } else {
      location.hash = id;
    }
  }

  function render() {
    const id = currentLessonId();
    renderSidebar(id);
    renderLesson(id);
    renderStreakPill();
  }

  function playVideo(card) {
    if (!card || card.classList.contains("playing")) return false;
    card.classList.add("playing");
    card.querySelector(".video-thumb").innerHTML =
      '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(card.dataset.video) + '?autoplay=1" ' +
      'title="Video lesson" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    return true;
  }

  document.addEventListener("click", (e) => {
    if (playVideo(e.target.closest(".video-card"))) return;
    const nav = e.target.closest("[data-goto]");
    if (nav && nav.dataset.goto) {
      goto(nav.dataset.goto);
      return;
    }
    const complete = e.target.closest("[data-complete]");
    if (complete) {
      const id = currentLessonId();
      const wasDone = Progress.isDone(id);
      Progress.setDone(id, !wasDone);
      if (!wasDone) {
        const got = XP.add(20, "lesson:" + id);
        const stats = Progress.trackStats(track);
        toast(
          (stats.pct === 100
            ? t("🏆 Track complete — outstanding!")
            : t("✓ Nice! {0}/{1} lessons done.", stats.done, stats.total)) +
          (got ? " +20 XP" : "")
        );
        XP.checkAchievements();
        XP.renderPill();
      }
      goto(id); /* pin the hash so the view stays on this lesson */
    }
  });

  document.addEventListener("keydown", (e) => {
    // The video card is a div with role="button": make it behave like one.
    const card = e.target.closest && e.target.closest(".video-card");
    if (card && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      playVideo(card);
      return;
    }
    if (e.target.matches("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
    const idx = lessonIndex(currentLessonId());
    if (e.key === "[" && lessons[idx - 1]) goto(lessons[idx - 1].id);
    if (e.key === "]" && lessons[idx + 1]) goto(lessons[idx + 1].id);
  });

  window.addEventListener("hashchange", render);
  /* Progress arriving from a sync pull or another tab: refresh the sidebar
     ticks and pills, but leave the open lesson (and any half-done exercise)
     exactly as it is. */
  onStateChanged(() => {
    renderSidebar(currentLessonId());
    renderStreakPill();
    XP.renderPill();
  });

  render();
})();
