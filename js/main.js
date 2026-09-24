/* ============================================
   1991 Academy — Landing page
   Dashboard (goal ring, level, actions), track
   cards, missions teaser, achievements strip.
   ============================================ */

function ringSVG(pct) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    '<div class="ring" role="img" aria-label="' + pct + '% complete">' +
    '<svg viewBox="0 0 52 52">' +
    '<circle class="ring-bg" cx="26" cy="26" r="' + r + '" fill="none" stroke-width="4"/>' +
    '<circle class="ring-fg" cx="26" cy="26" r="' + r + '" fill="none" stroke-width="4" ' +
    'stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + offset + '"/>' +
    '<text x="26" y="30" text-anchor="middle">' + pct + '%</text>' +
    "</svg></div>"
  );
}

/* ---------- Dashboard ---------- */

/* NOTE: never name a local `t` — that is the global translate function. */
function continueTarget() {
  const done = Progress.allDone();
  let fallback = null;
  for (const id of M.order) {
    const track = M.tracks[id];
    if (!track) continue;
    const lessons = allLessons(track);
    const next = lessons.find((l) => !done[l.id]);
    if (!next) continue;
    if (lessons.some((l) => done[l.id])) return { track, lesson: next };
    if (!fallback) fallback = { track, lesson: next };
  }
  return fallback;
}

function renderDashboard() {
  const el = document.getElementById("dashboard");
  if (!el) return;

  const todayXP = XP.todayXP();
  const goal = XP.goal();
  const pct = Math.min(100, Math.round((todayXP / goal) * 100));
  const r = 56;
  const c = 2 * Math.PI * r;
  const level = XP.levelInfo();
  const due = Review.dueCards().length;
  const target = continueTarget();
  const missions = M.missions || [];
  const done = Progress.allDone();
  const readyMissions = missions.filter(
    (m) => !XP.has("mission:" + m.id) && m.prereqs.every((p) => done[p])
  ).length;

  el.innerHTML =
    '<div class="goal-ring-wrap"><div class="goal-ring">' +
    '<svg viewBox="0 0 130 130">' +
    "<defs><linearGradient id=\"goalGrad\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">" +
    '<stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs>' +
    '<circle class="g-bg" cx="65" cy="65" r="' + r + '" fill="none" stroke-width="10"/>' +
    '<circle class="g-fg" cx="65" cy="65" r="' + r + '" fill="none" stroke-width="10" stroke-linecap="round" ' +
    'stroke-dasharray="' + c + '" stroke-dashoffset="' + c * (1 - pct / 100) + '"/></svg>' +
    '<div class="g-center"><strong>' + todayXP + "</strong><span>" + t("/ {0} XP today", goal) + "</span></div></div>" +
    '<div class="goal-edit" data-goal-edit>' + t("daily goal: {0} XP · change", goal) + "</div></div>" +
    '<div class="dash-right">' +
    '<div class="level-line"><span class="level-name">' + t("Level {0} · {1}", level.level, t(level.name)) + "</span>" +
    '<span class="level-next">' +
    (level.next ? t("{0} / {1} XP to {2}", level.total, level.next.at, t(level.next.name)) : t("Max level — legendary")) +
    "</span></div>" +
    '<div class="bar"><i style="width:' + level.pct + '%"></i></div>' +
    '<div class="dash-actions">' +
    (target
      ? '<a class="btn btn-primary" href="tracks/' + target.track.id + '.html#' + target.lesson.id + '">' + t("▶ Continue: {0}", esc(L(target.lesson, "title"))) + "</a>"
      : '<a class="btn btn-primary" href="missions.html">' + t("🏆 All lessons done — missions await") + "</a>") +
    '<a class="btn" href="practice.html">' + t("🧠 Practice") + (due ? ' <span class="due-badge">' + due + "</span>" : "") + "</a>" +
    '<a class="btn" href="lab.html">' + t("🧪 Lab") + (M.lab ? ' <span style="color:var(--text-faint)">' + M.lab.filter((p) => XP.has("lab:" + p.id)).length + "/" + M.lab.length + "</span>" : "") + "</a>" +
    '<a class="btn" href="missions.html">' + t("🛰️ Missions") + (readyMissions ? ' <span class="due-badge" style="background:var(--success); color:#06281c">' + readyMissions + "</span>" : "") + "</a>" +
    "</div></div>";

  el.querySelector("[data-goal-edit]").addEventListener("click", () => {
    XP.cycleGoal();
    renderDashboard();
  });
}

/* ---------- Track cards ---------- */

function renderTrackCards() {
  const grid = document.getElementById("tracks-grid");
  if (!grid) return;

  grid.innerHTML = M.order
    .map((id, i) => {
      const tr = M.tracks[id];
      const stats = Progress.trackStats(tr);
      const totalMin = allLessons(tr).reduce((s, l) => s + (l.minutes || 0), 0);
      return (
        '<a class="track-card rise" href="tracks/' + tr.id + '.html" ' +
        'style="--accent:' + tr.accent + '; --accent-soft:' + tr.accentSoft + '; animation-delay:' + i * 70 + 'ms">' +
        '<div class="track-card-top">' +
        '<div class="track-icon">' + tr.icon + "</div>" +
        ringSVG(stats.pct) +
        "</div>" +
        "<h3>" + esc(L(tr, "title")) + "</h3>" +
        '<p class="tagline">' + esc(L(tr, "tagline")) + "</p>" +
        '<div class="bar"><i style="width:' + stats.pct + '%"></i></div>' +
        '<div class="track-meta">' +
        "<span>" + t("{0}/{1} lessons", stats.done, stats.total) + "</span>" +
        "<span>" + t("~{0} min", totalMin) + "</span>" +
        "<span>" + t("{0} modules", tr.modules.length) + "</span>" +
        "</div></a>"
      );
    })
    .join("");
}

/* ---------- Missions teaser ---------- */

function renderMissionsTeaser() {
  const grid = document.getElementById("missions-teaser");
  if (!grid || !M.missions || typeof renderMissionCard !== "function") return;
  grid.innerHTML = M.missions.map((m) => renderMissionCard(m, "")).join("");
}

/* ---------- Achievements ---------- */

function renderBadges() {
  const el = document.getElementById("badges");
  if (!el) return;
  const earned = XP.earnedBadges();
  el.innerHTML = XP.BADGES.map((b) => {
    const has = !!earned[b.id];
    return (
      '<span class="badge ' + (has ? "earned" : "locked") + '" title="' + esc(t(b.desc)) + '">' +
      '<span class="b-icon">' + b.icon + "</span>" + esc(t(b.title)) + "</span>"
    );
  }).join("");
}

/* ---------- Leaderboard (opt-in, needs the backend) ---------- */

async function renderLeaderboard(period) {
  const el = document.getElementById("leaderboard");
  const section = document.getElementById("leaderboard-section");
  if (!el || !section) return;
  try {
    const { top, you, period: active } = await Auth.leaderboard(period);

    // Only reveal the whole section once SOMEONE has opted in. If this period is
    // empty, check all-time before hiding — an empty week isn't an empty board.
    if (!top || !top.length) {
      const all = await Auth.leaderboard("all").catch(() => ({ top: [] }));
      if (!all.top || !all.top.length) return; /* truly nobody yet — stay hidden */
    }

    const levelName = (xp) => t(XP.levelNameFor(xp));

    const tabs =
      '<div class="lb-tabs">' +
      '<button class="lb-tab' + (active === "week" ? " active" : "") + '" data-period="week">' + t("This week") + "</button>" +
      '<button class="lb-tab' + (active === "all" ? " active" : "") + '" data-period="all">' + t("All time") + "</button>" +
      "</div>";

    const rows = (top && top.length)
      ? top
          .map((row, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1;
            return (
              '<div class="lb-row' + (i < 3 ? " lb-top" : "") + '">' +
              '<span class="lb-rank">' + medal + "</span>" +
              '<span class="lb-name">' + esc(row.username) + "</span>" +
              '<span class="lb-level">' + levelName(row.xp) + "</span>" +
              '<span class="lb-xp">⚡ ' + row.xp + " XP</span></div>"
            );
          })
          .join("")
      : '<p class="lb-empty">' + t("No XP earned this week yet — be the first.") + "</p>";

    el.innerHTML = tabs + rows + (you ? '<p class="lb-you">' + t("Your rank: #{0}", you) + "</p>" : "");
    el.querySelectorAll("[data-period]").forEach((b) =>
      b.addEventListener("click", () => renderLeaderboard(b.dataset.period))
    );
    section.hidden = false;
  } catch {
    /* static serving / offline: no leaderboard, no error */
  }
}

/* ---------- Hero stats ---------- */

function renderHeroStats() {
  const el = document.getElementById("hero-stats");
  if (!el) return;
  const tracks = M.order.map((id) => M.tracks[id]);
  const g = Progress.globalStats(tracks);
  const streak = Progress.getStreak();
  el.innerHTML =
    statChip(g.done + " / " + g.total, t("lessons completed")) +
    statChip(t("~{0} min", g.minutes), t("of focused study")) +
    statChip(t(streak === 1 ? "{0} day" : "{0} days", streak), t("current streak")) +
    statChip(XP.total() + " XP", t("lifetime experience"));
}

function statChip(value, label) {
  return '<div class="stat-chip rise"><strong>' + esc(value) + "</strong><span>" + esc(label) + "</span></div>";
}

/* ---------- Boot ---------- */

function renderAll() {
  Review.sync();
  renderDashboard();
  renderTrackCards();
  renderMissionsTeaser();
  renderBadges();
  renderHeroStats();
  renderStreakPill();
  XP.renderPill();
  XP.checkAchievements();
}

renderAll();
renderLeaderboard();

/* Progress pulled from the account, or earned in another tab — the dashboard
   is a pure function of that state, so just draw it again. */
onStateChanged(renderAll);
