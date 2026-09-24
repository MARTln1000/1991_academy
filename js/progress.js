/* ============================================
   1991 Academy — Progress
   localStorage-backed lesson completion,
   quiz scores and daily streak.
   ============================================ */

const Progress = (() => {
  const KEY = "martinium:progress:v1";

  function blank() {
    return { done: {}, quiz: {}, streak: { count: 0, last: null } };
  }

  /* A render pass asks "is this done?" once per lesson, plus trackStats and
     badge checks on top — parsing the blob every time made a 22-lesson
     sidebar do 40+ JSON.parse calls. Cache it; drop the cache whenever the
     blob is replaced from outside (sync pull, another tab). */
  let cache = null;

  function load() {
    if (cache) return cache;
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(KEY));
    } catch {
      stored = null;
    }
    cache = stored && typeof stored === "object" ? { ...blank(), ...stored } : blank();
    if (!cache.done || typeof cache.done !== "object") cache.done = {};
    if (!cache.quiz || typeof cache.quiz !== "object") cache.quiz = {};
    if (!cache.streak || typeof cache.streak !== "object") cache.streak = { count: 0, last: null };
    return cache;
  }

  function save(data) {
    cache = data;
    localStorage.setItem(KEY, JSON.stringify(data));
    if (window.Sync) Sync.schedule();
  }

  document.addEventListener("martinium:store-invalidate", () => {
    cache = null;
  });

  /* Local calendar day — matches what the learner sees on their clock. */
  function dayKey(date) {
    const d = date || new Date();
    return (
      d.getFullYear() +
      "-" + String(d.getMonth() + 1).padStart(2, "0") +
      "-" + String(d.getDate()).padStart(2, "0")
    );
  }

  function today() {
    return dayKey();
  }

  function yesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dayKey(d);
  }

  return {
    dayKey: today,

    isDone(lessonId) {
      return !!load().done[lessonId];
    },

    allDone() {
      return load().done;
    },

    /* Any XP-earning activity keeps the streak alive — bump once per day. */
    noteActivity() {
      const data = load();
      const s = data.streak;
      if (s.last !== today()) {
        s.count = s.last === yesterday() ? s.count + 1 : 1;
        s.last = today();
        save(data);
      }
    },

    setDone(lessonId, done) {
      const data = load();
      if (done) {
        data.done[lessonId] = Date.now();
      } else {
        delete data.done[lessonId];
      }
      save(data);
      if (done) this.noteActivity();
    },

    saveQuiz(lessonId, score, total) {
      const data = load();
      data.quiz[lessonId] = { score, total, at: Date.now() };
      save(data);
    },

    getQuiz(lessonId) {
      return load().quiz[lessonId] || null;
    },

    trackStats(track) {
      const done = load().done;
      const lessons = allLessons(track);
      const n = lessons.filter((l) => done[l.id]).length;
      return { done: n, total: lessons.length, pct: lessons.length ? Math.round((n / lessons.length) * 100) : 0 };
    },

    globalStats(tracks) {
      const data = load();
      let done = 0, total = 0, minutes = 0;
      for (const t of tracks) {
        for (const l of allLessons(t)) {
          total += 1;
          if (data.done[l.id]) {
            done += 1;
            minutes += l.minutes || 0;
          }
        }
      }
      return { done, total, minutes };
    },

    getStreak() {
      const s = load().streak;
      // A streak is alive only if the user studied today or yesterday
      if (s.last === today() || s.last === yesterday()) return s.count;
      return 0;
    },
  };
})();
