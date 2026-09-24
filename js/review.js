/* ============================================
   1991 Academy — Spaced repetition
   Quiz questions from completed lessons become
   review cards. Correct answers push the card
   further into the future; misses bring it back.
   ============================================ */

const Review = (() => {
  const KEY = "martinium:review:v1";
  const DAY = 24 * 60 * 60 * 1000;

  let cache = null;

  function load() {
    if (cache) return cache;
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(KEY));
    } catch {
      stored = null;
    }
    cache = stored && typeof stored === "object" && stored.cards ? stored : { cards: {} };
    return cache;
  }

  function save(s) {
    cache = s;
    localStorage.setItem(KEY, JSON.stringify(s));
    if (window.Sync) Sync.schedule();
  }

  document.addEventListener("martinium:store-invalidate", () => {
    cache = null;
  });

  /* Walk every loaded track once, yielding [lesson, track] pairs. */
  function* eachLesson() {
    for (const track of Object.values(M.tracks)) {
      for (const mod of track.modules) {
        for (const lesson of mod.lessons) yield [lesson, track];
      }
    }
  }

  return {
    /* Create cards for every quiz question of every completed lesson.
       Call on pages where all track data is loaded. */
    sync() {
      const s = load();
      const done = Progress.allDone();
      let added = 0;
      for (const [lesson, track] of eachLesson()) {
        if (!done[lesson.id] || !lesson.quiz) continue;
        lesson.quiz.forEach((q, qi) => {
          const id = "rc:" + lesson.id + ":" + qi;
          if (!s.cards[id]) {
            // brand-new cards come due after one day — recall, not re-read
            s.cards[id] = { lessonId: lesson.id, trackId: track.id, qi, interval: 0, due: Date.now() + DAY };
            added += 1;
          }
        });
      }
      if (added) save(s);
      return added;
    },

    dueCards() {
      const now = Date.now();
      return Object.entries(load().cards)
        .filter(([, c]) => c && c.due <= now)
        .map(([id, c]) => ({ id, ...c }));
    },

    nextDueAt() {
      const due = Object.values(load().cards)
        .filter((c) => c && typeof c.due === "number")
        .map((c) => c.due);
      return due.length ? Math.min(...due) : null;
    },

    grade(cardId, correct) {
      const s = load();
      const c = s.cards[cardId];
      if (!c) return;
      if (correct) {
        c.interval = c.interval ? Math.min(c.interval * 2.5, 90) : 1;
        c.due = Date.now() + c.interval * DAY;
      } else {
        c.interval = 0;
        c.due = Date.now() + 10 * 60 * 1000; // retry in 10 minutes
      }
      save(s);
    },

    /* Resolve a card back to its live question content (skips stale cards:
       a lesson dropped by a course rebuild, or a quiz that lost a question). */
    resolve(card) {
      const track = M.tracks[card.trackId];
      if (!track) return null;
      const lesson = allLessons(track).find((l) => l.id === card.lessonId);
      if (!lesson) return null;
      const q = lesson.quiz && lesson.quiz[card.qi];
      return q ? { q, lesson, track } : null;
    },
  };
})();
