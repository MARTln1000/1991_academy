/* ============================================
   1991 Academy — XP engine
   One currency feeding everything: daily goal,
   levels, streak, achievements. Awards are
   ledgered so nothing can be farmed twice.
   ============================================ */

const XP = (() => {
  const KEY = "martinium:xp:v1";

  const LEVELS = [
    { at: 0, name: "Spark" },
    { at: 80, name: "Curious" },
    { at: 200, name: "Learner" },
    { at: 400, name: "Explorer" },
    { at: 650, name: "Builder" },
    { at: 950, name: "Hacker" },
    { at: 1300, name: "Engineer" },
    { at: 1750, name: "Architect" },
    { at: 2300, name: "Master" },
    { at: 3000, name: "Sage" },
  ];

  const GOALS = [30, 50, 100];

  function defaults() {
    return { total: 0, awards: {}, daily: {}, goal: 50, counters: {}, badges: {} };
  }

  let cache = null;

  function load() {
    if (cache) return cache;
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(KEY));
    } catch {
      stored = null;
    }
    // Always merge over defaults so a partial/foreign blob (e.g. a synced copy
    // that only carried `total`) can never leave `daily`/`awards` undefined and
    // crash a consumer like renderDashboard.
    cache = stored && typeof stored === "object" ? { ...defaults(), ...stored } : defaults();
    for (const k of ["awards", "daily", "counters", "badges"]) {
      if (!cache[k] || typeof cache[k] !== "object") cache[k] = {};
    }
    if (typeof cache.total !== "number" || !isFinite(cache.total)) cache.total = 0;
    if (!GOALS.includes(cache.goal)) cache.goal = 50;
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

  /* Local calendar day, shared with Progress so the goal ring and the streak
     roll over at the learner's midnight (not UTC's). */
  function today() {
    return Progress.dayKey();
  }

  /* ---------- Achievements ---------- */

  const BADGES = [
    { id: "first-lesson", icon: "🌱", title: "First Steps", desc: "Complete your first lesson" },
    { id: "hands-on", icon: "🔧", title: "Hands On", desc: "Solve your first interactive exercise" },
    { id: "perfect-quiz", icon: "🎯", title: "Sharpshooter", desc: "Ace a quiz on the first try" },
    { id: "five-perfect", icon: "🏹", title: "Deadeye", desc: "Ace 5 quizzes" },
    { id: "first-mission", icon: "🚀", title: "Shipped It", desc: "Complete your first mission" },
    { id: "all-missions", icon: "🛰️", title: "Mission Control", desc: "Complete every mission" },
    { id: "streak-3", icon: "🔥", title: "On a Roll", desc: "3-day streak" },
    { id: "streak-7", icon: "⚡", title: "Unstoppable", desc: "7-day streak" },
    { id: "streak-30", icon: "🌋", title: "Force of Nature", desc: "30-day streak" },
    { id: "lab-first", icon: "🧪", title: "Lab Rat", desc: "Solve your first Lab problem" },
    { id: "lab-8", icon: "⚗️", title: "Mad Scientist", desc: "Solve 8 Lab problems" },
    { id: "from-scratch", icon: "🧬", title: "From Scratch", desc: "Train a model you built yourself" },
    { id: "polyglot", icon: "🧭", title: "Renaissance Mind", desc: "Complete lessons in 3 different tracks" },
    { id: "track-complete", icon: "🏆", title: "Track Champion", desc: "Finish an entire track" },
    { id: "reviewer-25", icon: "🧠", title: "Memory Athlete", desc: "Answer 25 practice reviews" },
  ];

  function badgeEarnedNow(id, s) {
    const done = typeof Progress !== "undefined" ? Progress.allDone() : {};
    const doneIds = Object.keys(done);
    const c = s.counters;
    const streak = typeof Progress !== "undefined" ? Progress.getStreak() : 0;
    const missionCount = M && M.missions ? M.missions.length : null;

    switch (id) {
      case "first-lesson": return doneIds.length >= 1;
      case "lab-first": return (c.labs || 0) >= 1;
      case "lab-8": return (c.labs || 0) >= 8;
      case "from-scratch":
        return ["lab-linreg", "lab-kmeans", "lab-perceptron", "lab-mlp-xor"].some(
          (x) => s.awards["lab:" + x]
        );
      case "hands-on": return (c.exercises || 0) >= 1;
      case "perfect-quiz": return (c.perfectQuizzes || 0) >= 1;
      case "five-perfect": return (c.perfectQuizzes || 0) >= 5;
      case "first-mission": return (c.missions || 0) >= 1;
      case "all-missions": return missionCount !== null && (c.missions || 0) >= missionCount;
      case "streak-3": return streak >= 3;
      case "streak-7": return streak >= 7;
      case "streak-30": return streak >= 30;
      case "polyglot": {
        const prefixes = new Set(doneIds.map((x) => x.split("-")[0]));
        return prefixes.size >= 3;
      }
      case "track-complete": {
        const tracks = M ? M.tracks : {};
        return Object.values(tracks).some((tr) => {
          const ls = allLessons(tr);
          return ls.length > 0 && ls.every((l) => done[l.id]);
        });
      }
      case "reviewer-25": return (c.reviews || 0) >= 25;
      default: return false;
    }
  }

  return {
    LEVELS,
    BADGES,

    /* Add XP. With an awardKey, pays out only once ever. Returns XP granted. */
    add(amount, awardKey) {
      const s = load();
      if (awardKey) {
        if (s.awards[awardKey]) return 0;
        s.awards[awardKey] = true;
      }
      s.total += amount;
      s.daily[today()] = (s.daily[today()] || 0) + amount;
      save(s);
      if (typeof Progress !== "undefined") Progress.noteActivity();
      return amount;
    },

    has(awardKey) {
      return !!load().awards[awardKey];
    },

    bump(counter) {
      const s = load();
      s.counters[counter] = (s.counters[counter] || 0) + 1;
      save(s);
    },

    counter(name) {
      return load().counters[name] || 0;
    },

    total() {
      return load().total;
    },

    todayXP() {
      return load().daily[today()] || 0;
    },

    goal() {
      return load().goal;
    },

    cycleGoal() {
      const s = load();
      const i = GOALS.indexOf(s.goal);
      s.goal = GOALS[(i + 1) % GOALS.length];
      save(s);
      return s.goal;
    },

    levelInfo() {
      const total = load().total;
      let idx = 0;
      for (let i = 0; i < LEVELS.length; i++) if (total >= LEVELS[i].at) idx = i;
      const cur = LEVELS[idx];
      const next = LEVELS[idx + 1] || null;
      const pct = next
        ? Math.round(((total - cur.at) / (next.at - cur.at)) * 100)
        : 100;
      return { level: idx + 1, name: cur.name, total, next, pct };
    },

    /* Level name for an arbitrary XP total (used by the leaderboard). */
    levelNameFor(xp) {
      let name = LEVELS[0].name;
      for (const lv of LEVELS) if (xp >= lv.at) name = lv.name;
      return name;
    },

    earnedBadges() {
      return load().badges;
    },

    /* Evaluate all badge conditions; toast + persist the new ones. */
    checkAchievements() {
      const s = load();
      const fresh = [];
      for (const b of BADGES) {
        if (!s.badges[b.id] && badgeEarnedNow(b.id, s)) {
          s.badges[b.id] = Date.now();
          fresh.push(b);
        }
      }
      if (fresh.length) {
        save(s);
        fresh.forEach((b) => toast(b.icon + " " + t("Achievement unlocked: {0}!", t(b.title))));
      }
      return fresh;
    },

    renderPill() {
      const label = "⚡ " + load().total + " XP";
      document.querySelectorAll("[data-xp]").forEach((el) => {
        el.textContent = label;
      });
    },
  };
})();

XP.renderPill();
