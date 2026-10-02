/* ============================================
   1991 Academy — Admin panel (admin.html)
   For accounts the server marks as admins
   (`make admin NAME=…`). Tabs: overview,
   learners, lessons, announcements, activity.
   The server checks the admin flag on every
   request; this page only shows what it gets.
   ============================================ */

(async function () {
  const root = document.getElementById("admin-root");
  const M = window.ACADEMY_1991;
  await Auth.ready;
  renderStreakPill();
  XP.renderPill();

  /* ---------- HTTP ---------- */

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      ...opts,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(t(body.error || "HTTP " + res.status));
      e.status = res.status;
      throw e;
    }
    return body;
  }

  const send = (method, path, data) => api(path, { method, body: JSON.stringify(data || {}) });
  const userPath = (name) => "/api/admin/users/" + encodeURIComponent(name);
  const lessonPath = (id) => "/api/admin/lessons/" + encodeURIComponent(id);

  /* ---------- Formatting ---------- */

  const fmtDate = (s) =>
    s ? new Date(s * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
  const fmtDateTime = (s) =>
    s ? new Date(s * 1000).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const fmtDay = (d) => new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  const num = (n) => Number(n || 0).toLocaleString();
  const chip = (value, label) => '<div class="stat-chip"><strong>' + esc(value) + "</strong><span>" + esc(label) + "</span></div>";
  const badge = (kind, text) => '<span class="admin-badge badge-' + kind + '">' + esc(text) + "</span>";
  const card = (inner, cls) => '<section class="admin-card' + (cls ? " " + cls : "") + '">' + inner + "</section>";

  /* ---------- The curriculum ---------- */

  /* Lessons as shipped in js/data/ (this page doesn't load api/content.js). */
  const builtin = {};
  for (const id of M.order)
    for (const mod of M.tracks[id].modules) for (const l of mod.lessons) builtin[l.id] = { lesson: l, track: M.tracks[id], module: mod };

  /* The tracks with these lesson records applied, the way learners' pages
     apply them (js/custom-content.js), on a copy of the built-in data. */
  function liveTracks(records) {
    const tracks = structuredClone(M.tracks);
    const unplaced = CustomContent.applyLessons(tracks, records);
    const index = {};
    for (const id of M.order)
      for (const mod of tracks[id].modules) for (const l of mod.lessons) index[l.id] = { lesson: l, track: tracks[id], module: mod };
    return { tracks, index, unplaced };
  }

  const published = (records) => records.filter((r) => r.published);
  const lessonTitle = (entry, id) => (entry ? L(entry.lesson, "title") : id);

  /* ---------- Who may see this page ---------- */

  function notice(icon, text, extra) {
    root.innerHTML =
      '<div class="practice-card practice-done"><div class="p-big">' + icon + "</div>" +
      "<h2>" + text + "</h2>" + (extra || "") + "</div>";
  }

  const me = Auth.current();
  if (Auth.isOffline()) return notice("🔌", t("The admin panel needs the 1991 Academy server."));
  if (!me) {
    return notice("🔒", t("Sign in with an admin account to open the admin panel."),
      '<a class="btn btn-primary" href="account.html">' + t("Sign in") + "</a>");
  }
  if (!me.admin) {
    return notice("🔒", t("This page is for the site's administrators."),
      '<a class="btn" href="index.html">' + t("Home") + "</a>");
  }

  /* ---------- Layout & routing ---------- */

  const TABS = [
    ["overview", "📊 " + t("Overview")],
    ["learners", "👥 " + t("Learners")],
    ["lessons", "📚 " + t("Lessons")],
    ["announcements", "📣 " + t("Announcements")],
    ["log", "🧾 " + t("Activity log")],
  ];
  root.innerHTML =
    '<div class="admin-head"><h1>' + t("Admin panel") + "</h1>" +
    '<nav class="lb-tabs admin-tabs">' +
    TABS.map(([id, label]) => '<a class="lb-tab" data-tab="' + id + '" href="#' + id + '">' + label + "</a>").join("") +
    "</nav></div>" +
    '<div id="admin-view"></div>';
  const view = root.querySelector("#admin-view");

  const VIEWS = {
    overview: viewOverview,
    learners: viewLearners,
    learner: viewLearner,
    lessons: viewLessons,
    lesson: viewLesson,
    new: viewNewLesson,
    announcements: viewAnnouncements,
    log: viewLog,
  };
  const TAB_OF = { learner: "learners", lesson: "lessons", new: "lessons" };
  let routeToken = 0;

  /* #name/arg/arg → VIEWS[name](args). A view returns {html, bind}; it is
     shown only if no newer navigation happened while it was loading. */
  async function route() {
    const [raw, ...rest] = location.hash.replace(/^#/, "").split("/");
    const name = VIEWS[raw] ? raw : "overview";
    const tab = TAB_OF[name] || name;
    root.querySelectorAll("[data-tab]").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
    const token = ++routeToken;
    view.innerHTML = '<p class="admin-muted">' + t("Loading…") + "</p>";
    try {
      const out = await VIEWS[name](rest.map(decodeURIComponent));
      if (token !== routeToken) return;
      view.innerHTML = out.html;
      if (out.bind) out.bind(view);
    } catch (e) {
      if (token !== routeToken) return;
      if (e.status === 401 || e.status === 403) {
        notice("🔒", t("Your admin access has ended. Sign in again with an admin account."),
          '<a class="btn btn-primary" href="account.html">' + t("Sign in") + "</a>");
        return;
      }
      view.innerHTML = card('<p class="form-error">' + esc(e.message) + "</p>");
    }
  }

  window.addEventListener("hashchange", () => {
    route();
    window.scrollTo({ top: 0 });
  });
  route();

  /* ============================================================ Overview */

  function chart(title, days, values) {
    const max = Math.max(0, ...values);
    const total = values.reduce((a, b) => a + b, 0);
    const bars = values
      .map((v, i) =>
        '<div class="chart-bar" style="height:' + (max ? Math.max(2, Math.round((v / max) * 100)) : 2) + '%" title="' +
        esc(fmtDay(days[i]) + ": " + v) + '"></div>')
      .join("");
    return card(
      '<div class="chart-head"><h3>' + esc(title) + "</h3><span>" + t("{0} in total", num(total)) + "</span></div>" +
      '<div class="chart" role="img" aria-label="' + esc(title + ": " + total) + '">' + bars + "</div>" +
      '<div class="chart-axis"><span>' + fmtDay(days[0]) + "</span><span>" + t("busiest day: {0}", max) + "</span><span>" +
      fmtDay(days[days.length - 1]) + "</span></div>",
      "chart-card");
  }

  function lessonRow(entry, n) {
    return (
      '<li><a href="#lesson/' + encodeURIComponent(entry.lesson.id) + '">' + esc(L(entry.lesson, "title")) + "</a>" +
      ' <span class="admin-muted">' + esc(L(entry.track, "title")) + "</span>" +
      '<span class="admin-count">' + num(n) + "</span></li>"
    );
  }

  async function viewOverview() {
    const [s, recs] = await Promise.all([api("/api/admin/overview"), api("/api/admin/lessons")]);
    const live = liveTracks(published(recs.lessons));

    const chips =
      '<div class="hero-stats admin-chips">' +
      chip(num(s.learners), t("learners with an account")) +
      chip(num(s.new7), t("new this week")) +
      chip(num(s.active7), t("active this week")) +
      chip(num(s.active30), t("active in 30 days")) +
      chip(num(s.withProgress), t("have completed a lesson")) +
      chip(num(s.optedIn), t("on the leaderboard")) +
      chip(num(s.xpTotal), t("XP earned in total")) +
      "</div>";

    const trackRows = M.order
      .map((id) => {
        const tr = live.tracks[id];
        const n = allLessons(tr).length;
        const st = s.tracks[id] || { starters: 0, completions: 0 };
        const avg = st.starters && n ? Math.round((100 * st.completions) / (st.starters * n)) + "%" : "—";
        return (
          "<tr><td>" + esc(tr.icon + " " + L(tr, "title")) + "</td><td>" + n + "</td><td>" + num(st.starters) +
          "</td><td>" + num(st.completions) + "</td><td>" + avg + "</td></tr>"
        );
      })
      .join("");
    const tracksTable = card(
      "<h3>" + t("Tracks") + "</h3>" +
      '<div class="table-wrap"><table class="admin-table"><thead><tr><th>' + t("Track") + "</th><th>" + t("Lessons") +
      "</th><th>" + t("Learners who started") + "</th><th>" + t("Lessons completed") + "</th><th>" +
      t("Average progress of those who started") + "</th></tr></thead><tbody>" + trackRows + "</tbody></table></div>");

    const counted = Object.values(live.index).map((entry) => ({ entry, n: s.lessons[entry.lesson.id] || 0 }));
    const most = counted.filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 8);
    const least = [...counted].sort((a, b) => a.n - b.n).slice(0, 8);
    const lessonLists =
      '<div class="admin-two">' +
      card("<h3>" + t("Most completed lessons") + "</h3>" +
        (most.length ? '<ol class="admin-list">' + most.map((x) => lessonRow(x.entry, x.n)).join("") + "</ol>"
          : '<p class="admin-muted">' + t("No lesson has been completed yet.") + "</p>")) +
      card("<h3>" + t("Least completed lessons") + "</h3>" +
        '<ol class="admin-list">' + least.map((x) => lessonRow(x.entry, x.n)).join("") + "</ol>") +
      "</div>";

    const solvedList = (items, counts) =>
      '<ul class="admin-list">' +
      items.map((p) => "<li>" + esc(L(p, "title")) + '<span class="admin-count">' + num(counts[p.id] || 0) + "</span></li>").join("") +
      "</ul>";
    const solved =
      '<div class="admin-two">' +
      card("<h3>🧪 " + t("Lab problems solved") + "</h3>" + solvedList(M.lab || [], s.labs)) +
      card("<h3>🎯 " + t("Missions completed") + "</h3>" + solvedList(M.missions || [], s.missions)) +
      "</div>";

    return {
      html:
        chips +
        '<div class="admin-two">' + chart(t("Sign-ups, last 30 days"), s.days, s.signups) +
        chart(t("Lessons completed, last 30 days"), s.days, s.completions) + "</div>" +
        tracksTable + lessonLists + solved +
        '<p class="admin-muted admin-note">' + t("Progress counts come from learners with an account; guests' progress stays in their browser.") + "</p>",
    };
  }

  /* ============================================================ Learners */

  const learnerQuery = { q: "", sort: "created", offset: 0 };
  const SORTS = [["created", "Newest first"], ["active", "Recently active"], ["xp", "Most XP"], ["name", "Name"]];

  async function viewLearners() {
    return {
      html: card(
        '<div class="admin-toolbar">' +
        '<input class="admin-input" type="search" data-q placeholder="' + esc(t("Search by name or email")) + '" value="' + esc(learnerQuery.q) + '" />' +
        '<select class="admin-input" data-sort aria-label="' + esc(t("Sort")) + '">' +
        SORTS.map(([id, label]) => '<option value="' + id + '"' + (learnerQuery.sort === id ? " selected" : "") + ">" + t(label) + "</option>").join("") +
        "</select></div><div data-list></div>"),
      bind(el) {
        const list = el.querySelector("[data-list]");
        let timer = null;
        async function load() {
          const params = new URLSearchParams({ q: learnerQuery.q, sort: learnerQuery.sort, offset: learnerQuery.offset });
          const token = routeToken;
          const d = await api("/api/admin/users?" + params);
          if (token !== routeToken) return;
          list.innerHTML = renderLearners(d);
        }
        const reload = () => load().catch((e) => (list.innerHTML = '<p class="form-error">' + esc(e.message) + "</p>"));
        el.querySelector("[data-q]").addEventListener("input", (e) => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            learnerQuery.q = e.target.value.trim();
            learnerQuery.offset = 0;
            reload();
          }, 250);
        });
        el.querySelector("[data-sort]").addEventListener("change", (e) => {
          learnerQuery.sort = e.target.value;
          learnerQuery.offset = 0;
          reload();
        });
        list.addEventListener("click", (e) => {
          const pager = e.target.closest("[data-page]");
          if (!pager) return;
          learnerQuery.offset = Math.max(0, Number(pager.dataset.page));
          reload();
        });
        reload();
      },
    };
  }

  function renderLearners(d) {
    if (!d.learners.length) return '<p class="admin-muted">' + t("No learners match.") + "</p>";
    const rows = d.learners
      .map((u) =>
        '<tr><td><a href="#learner/' + encodeURIComponent(u.username) + '">' + esc(u.username) + "</a>" +
        (u.admin ? " " + badge("admin", t("admin")) : "") + "</td>" +
        "<td>" + esc(u.email) + "</td><td>" + fmtDate(u.created) + "</td><td>" + fmtDate(u.lastActive) + "</td>" +
        "<td>" + num(u.xp) + "</td><td>" + num(u.lessons) + "</td></tr>")
      .join("");
    const from = d.offset + 1;
    const to = d.offset + d.learners.length;
    return (
      '<div class="table-wrap"><table class="admin-table"><thead><tr><th>' + t("Learner") + "</th><th>" + t("Email") +
      "</th><th>" + t("Joined") + "</th><th>" + t("Last active") + "</th><th>XP</th><th>" + t("Lessons") +
      "</th></tr></thead><tbody>" + rows + "</tbody></table></div>" +
      '<div class="admin-pager"><span class="admin-muted">' + t("{0}–{1} of {2}", from, to, d.total) + "</span>" +
      '<button class="btn" data-page="' + (d.offset - d.pageSize) + '"' + (d.offset > 0 ? "" : " disabled") + ">" + t("← Previous") + "</button>" +
      '<button class="btn" data-page="' + (d.offset + d.pageSize) + '"' + (to < d.total ? "" : " disabled") + ">" + t("Next →") + "</button></div>"
    );
  }

  /* ---------- One learner ---------- */

  function localDay(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  async function viewLearner([name]) {
    const [d, recs] = await Promise.all([api(userPath(name)), api("/api/admin/lessons")]);
    const live = liveTracks(published(recs.lessons));
    const u = d.learner;
    const p = d.progress;
    const self = u.username === me.username;
    const alive = p.streak.last === localDay(0) || p.streak.last === localDay(-1);
    const doneIds = Object.keys(p.done);

    const head =
      '<div class="profile-head"><div class="avatar">' + esc(u.username[0].toUpperCase()) + "</div><div>" +
      "<h2>" + esc(u.username) + " " + (u.admin ? badge("admin", t("admin")) : "") + (u.optIn ? badge("info", t("on the leaderboard")) : "") + "</h2>" +
      '<p class="admin-muted">' + esc(u.email) + "</p></div></div>" +
      '<div class="hero-stats admin-chips">' +
      chip(num(u.xp) + " XP", t("in total")) +
      chip(num(u.weekXp) + " XP", t("this week")) +
      chip(num(doneIds.length), t("lessons completed")) +
      chip(alive ? t(p.streak.count === 1 ? "{0} day" : "{0} days", p.streak.count) : "0", t("current streak")) +
      chip(num(p.labs.length), t("Lab problems solved")) +
      chip(num(p.missions.length), t("missions completed")) +
      chip(num(p.exercises), t("exercises solved")) +
      "</div>" +
      '<dl class="admin-facts">' +
      "<dt>" + t("Joined") + "</dt><dd>" + fmtDateTime(u.created) + "</dd>" +
      "<dt>" + t("Last active") + "</dt><dd>" + fmtDateTime(u.lastActive) + "</dd>" +
      "<dt>" + t("Last sign-in") + "</dt><dd>" + fmtDateTime(u.lastSignIn) + "</dd>" +
      "<dt>" + t("Signed in on") + "</dt><dd>" + t(u.sessions === 1 ? "{0} device" : "{0} devices", u.sessions) + "</dd>" +
      (p.streak.last ? "<dt>" + t("Last studied") + "</dt><dd>" + esc(p.streak.last) + "</dd>" : "") +
      "</dl>";

    const actions =
      "<h3>" + t("Account") + "</h3>" +
      '<div class="dash-actions">' +
      '<button class="btn" data-reset>' + t("Send a password-reset link") + "</button>" +
      '<button class="btn" data-signout' + (self ? " disabled" : "") + ">" + t("Sign out on every device") + "</button>" +
      '<button class="btn btn-danger" data-del-open' + (self || u.admin ? " disabled" : "") + ">" + t("Delete account") + "</button>" +
      "</div>" +
      (u.admin ? '<p class="admin-muted">' + t("Admin accounts can't be deleted here. Remove the admin rights on the server first (make admin-remove).") + "</p>" : "") +
      '<div data-reset-out></div>' +
      '<form data-del-form hidden class="admin-confirm">' +
      "<p>" + t("This permanently deletes {0}'s account and synced progress. Type the username to confirm:", "<strong>" + esc(u.username) + "</strong>") + "</p>" +
      '<input class="admin-input" name="confirm" autocomplete="off" />' +
      '<div class="dash-actions"><button class="btn btn-danger" type="submit">' + t("Delete account") + "</button>" +
      '<button class="btn" type="button" data-del-cancel>' + t("Cancel") + "</button></div></form>" +
      '<p class="form-error" data-msg></p>';

    const tracksHtml = M.order
      .map((id) => {
        const tr = live.tracks[id];
        const lessons = allLessons(tr);
        const done = lessons.filter((l) => p.done[l.id] !== undefined);
        const pct = lessons.length ? Math.round((100 * done.length) / lessons.length) : 0;
        const items = done
          .map((l) => {
            const q = p.quiz[l.id];
            return (
              "<li>" + esc(L(l, "title")) + ' <span class="admin-muted">' +
              (p.done[l.id] ? fmtDate(p.done[l.id] / 1000) : "") +
              (q && q.total ? " · " + t("quiz {0}/{1}", q.score, q.total) : "") + "</span></li>"
            );
          })
          .join("");
        return (
          '<details class="admin-track"><summary>' +
          '<span class="admin-track-name">' + esc(tr.icon + " " + L(tr, "title")) + "</span>" +
          '<span class="bar admin-bar"><i style="width:' + pct + '%"></i></span>' +
          '<span class="admin-muted">' + done.length + " / " + lessons.length + "</span></summary>" +
          (items ? '<ul class="admin-list">' + items + "</ul>" : '<p class="admin-muted">' + t("Nothing completed yet.") + "</p>") +
          "</details>"
        );
      })
      .join("");
    const gone = doneIds.filter((id) => !live.index[id]);
    const solved = (items, ids) =>
      ids.length ? '<ul class="admin-list">' + ids.map((id) => {
        const item = items.find((x) => x.id === id);
        return "<li>" + esc(item ? L(item, "title") : id) + "</li>";
      }).join("") + "</ul>" : '<p class="admin-muted">' + t("None yet.") + "</p>";

    return {
      html:
        '<a class="back-link" href="#learners">' + t("← All learners") + "</a>" +
        card(head) +
        card(actions) +
        card("<h3>" + t("Progress by track") + "</h3>" + tracksHtml +
          (gone.length ? '<p class="admin-muted">' + t("Also completed lessons that are no longer on the site: {0}", esc(gone.join(", "))) + "</p>" : "")) +
        '<div class="admin-two">' +
        card("<h3>🧪 " + t("Lab problems solved") + "</h3>" + solved(M.lab || [], p.labs)) +
        card("<h3>🎯 " + t("Missions completed") + "</h3>" + solved(M.missions || [], p.missions)) +
        "</div>",
      bind(el) {
        const msg = el.querySelector("[data-msg]");
        const fail = (e) => {
          msg.style.color = "";
          msg.textContent = e.message;
        };
        const ok = (text) => {
          msg.style.color = "var(--success)";
          msg.textContent = text;
        };

        el.querySelector("[data-reset]").addEventListener("click", async (e) => {
          e.target.disabled = true;
          msg.textContent = "";
          try {
            const out = await send("POST", userPath(u.username) + "/reset-link");
            const box = el.querySelector("[data-reset-out]");
            if (out.sent) {
              box.innerHTML = "";
              ok(t("A reset link is on its way to {0}.", out.email));
            } else {
              box.innerHTML =
                '<div class="admin-confirm"><p>' + t("Email isn't set up on this server, so give this link to the learner yourself. It works once, for one hour:") + "</p>" +
                '<div class="admin-toolbar"><input class="admin-input" readonly value="' + esc(out.link) + '" />' +
                '<button class="btn" type="button" data-copy>' + t("Copy") + "</button></div></div>";
              box.querySelector("[data-copy]").addEventListener("click", async () => {
                const input = box.querySelector("input");
                try {
                  await navigator.clipboard.writeText(input.value);
                  toast(t("Copied."));
                } catch {
                  input.select();
                }
              });
            }
          } catch (err) {
            fail(err);
          }
          e.target.disabled = false;
        });

        el.querySelector("[data-signout]").addEventListener("click", async (e) => {
          if (!confirm(t("Sign {0} out on every device?", u.username))) return;
          e.target.disabled = true;
          try {
            const out = await send("POST", userPath(u.username) + "/sign-out");
            ok(t(out.sessions === 1 ? "Signed out of {0} device." : "Signed out of {0} devices.", out.sessions));
          } catch (err) {
            fail(err);
          }
          e.target.disabled = false;
        });

        const delForm = el.querySelector("[data-del-form]");
        el.querySelector("[data-del-open]").addEventListener("click", () => {
          delForm.hidden = false;
          delForm.querySelector("input").focus();
        });
        el.querySelector("[data-del-cancel]").addEventListener("click", () => {
          delForm.hidden = true;
        });
        delForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          if (delForm.querySelector("input").value.trim() !== u.username) {
            fail(new Error(t("Type the username exactly as shown.")));
            return;
          }
          try {
            await send("POST", userPath(u.username) + "/delete");
            toast(t("{0}'s account was deleted.", u.username));
            location.hash = "#learners";
          } catch (err) {
            fail(err);
          }
        });
      },
    };
  }

  /* ============================================================ Lessons */

  function lessonStatus(id, rec) {
    const isBuiltin = !!builtin[id];
    if (!rec) return badge("muted", t("original"));
    if (isBuiltin) return rec.published ? badge("edited", t("edited")) : badge("draft", t("edited · draft"));
    return rec.published ? badge("new", t("new")) : badge("draft", t("new · draft"));
  }

  async function viewLessons() {
    const recs = (await api("/api/admin/lessons")).lessons;
    const byId = Object.fromEntries(recs.map((r) => [r.id, r]));
    const shown = liveTracks(recs); /* drafts too, to show where they go */

    const tracksHtml = M.order
      .map((tid) => {
        const tr = shown.tracks[tid];
        const changed = allLessons(tr).filter((l) => byId[l.id]).length;
        const modules = tr.modules
          .map((mod) =>
            '<div class="admin-module"><div class="admin-module-head"><h4>' + esc(L(mod, "title")) + "</h4>" +
            '<a class="btn" href="#new/' + tid + "/" + encodeURIComponent(mod.id) + '">＋ ' + t("New lesson") + "</a></div>" +
            '<ol class="admin-list admin-lessons">' +
            mod.lessons
              .map((l) =>
                '<li><a href="#lesson/' + encodeURIComponent(l.id) + '">' + esc(L(l, "title")) + "</a> " +
                '<code class="admin-muted">' + esc(l.id) + "</code> " + lessonStatus(l.id, byId[l.id]) + "</li>")
              .join("") +
            "</ol></div>")
          .join("");
        return (
          '<details class="admin-card admin-track-lessons"><summary><strong>' + esc(tr.icon + " " + L(tr, "title")) + "</strong> " +
          '<span class="admin-muted">' + t("{0} lessons", allLessons(tr).length) + (changed ? " · " + t("{0} changed here", changed) : "") +
          "</span></summary>" + modules + "</details>"
        );
      })
      .join("");

    const unplaced = shown.unplaced.length
      ? card("<h3>" + t("Lessons without a place") + "</h3><p class=\"admin-muted\">" +
        t("Their track or module no longer exists, so learners don't see them.") + '</p><ul class="admin-list">' +
        shown.unplaced.map((r) => '<li><a href="#lesson/' + encodeURIComponent(r.id) + '">' + esc(r.data.title) + "</a> <code>" + esc(r.id) + "</code></li>").join("") +
        "</ul>")
      : "";

    return {
      html:
        '<p class="admin-muted admin-note">' +
        t("Edit any lesson, or add new ones to a module. Your text replaces the original for learners; course materials and exercises stay as they are. Saving without “Visible to learners” keeps it as a draft.") +
        "</p>" + tracksHtml + unplaced,
    };
  }

  /* ---------- The editor ---------- */

  function blankLesson() {
    return { title: "", title_hy: "", minutes: 10, content: "", content_hy: "", takeaways: [], takeaways_hy: [], quiz: [], videos: [] };
  }

  /* A built-in lesson as editable data: its English text plus whatever the
     Armenian packs added. */
  function fromBuiltin(l) {
    return {
      title: l.title,
      title_hy: l.title_hy || "",
      minutes: l.minutes,
      content: (l.content || "").trim(),
      content_hy: (l.content_hy || "").trim(),
      takeaways: l.takeaways || [],
      takeaways_hy: l.takeaways_hy || [],
      quiz: (l.quiz || []).map((q) => ({
        q: q.q, q_hy: q.q_hy || "", options: q.options, options_hy: q.options_hy || [],
        answer: q.answer, explain: q.explain || "", explain_hy: q.explain_hy || "",
      })),
      videos: (l.videos || []).map((v) => ({ id: v.id, title: v.title, channel: v.channel || "", length: v.length || "" })),
    };
  }

  function suggestId(trackId, moduleId, recs) {
    const taken = new Set([...Object.keys(builtin), ...recs.map((r) => r.id)]);
    const n = (moduleId.match(/-m(\d+)$/) || [])[1];
    const base = trackId + "-" + (n || "new") + "-";
    let k = 1;
    while (taken.has(base + k)) k += 1;
    return base + k;
  }

  /* A YouTube link in any of its usual shapes, or the bare id. */
  function youtubeId(text) {
    const s = text.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : s;
  }

  async function viewLesson([id]) {
    const recs = (await api("/api/admin/lessons")).lessons;
    const rec = recs.find((r) => r.id === id) || null;
    const b = builtin[id];
    if (!rec && !b) {
      return { html: '<a class="back-link" href="#lessons">' + t("← All lessons") + "</a>" + card('<p class="form-error">' + t("No such lesson.") + "</p>") };
    }
    return editor({
      id, rec, recs,
      isBuiltin: !!b,
      trackId: b ? b.track.id : rec.track,
      moduleId: b ? b.module.id : rec.module,
      after: rec ? rec.after : null,
      data: rec ? rec.data : fromBuiltin(b.lesson),
    });
  }

  async function viewNewLesson([trackId, moduleId]) {
    const recs = (await api("/api/admin/lessons")).lessons;
    const track = M.tracks[trackId];
    if (!track || !track.modules.some((m) => m.id === moduleId)) {
      return { html: '<a class="back-link" href="#lessons">' + t("← All lessons") + "</a>" + card('<p class="form-error">' + t("No such module.") + "</p>") };
    }
    return editor({
      id: suggestId(trackId, moduleId, recs), rec: null, recs,
      isBuiltin: false, trackId, moduleId, after: null, data: blankLesson(),
    });
  }

  let uid = 0;
  let flash = null; /* the message a first save leaves for the reopened editor */

  function field(label, control, hint) {
    return '<div class="field"><label>' + label + "</label>" + control + (hint ? '<p class="admin-hint">' + hint + "</p>" : "") + "</div>";
  }
  const input = (attrs, value) => '<input class="admin-input" ' + attrs + ' value="' + esc(value == null ? "" : value) + '" />';
  const area = (attrs, value, rows) => '<textarea class="admin-input" rows="' + (rows || 3) + '" ' + attrs + ">" + esc(value || "") + "</textarea>";
  const pair = (en, hy) => '<div class="admin-pair">' + en + hy + "</div>";

  function videoRow(v) {
    return (
      '<div class="admin-row-edit" data-video-row>' +
      input('data-v="id" placeholder="' + esc(t("YouTube link")) + '"', v.id ? "https://youtu.be/" + v.id : "") +
      input('data-v="title" placeholder="' + esc(t("Title")) + '"', v.title) +
      input('data-v="channel" placeholder="' + esc(t("Channel")) + '"', v.channel) +
      input('data-v="length" placeholder="' + esc(t("Length, e.g. 12:30")) + '"', v.length) +
      '<button class="icon-btn" type="button" data-remove-row aria-label="' + esc(t("Remove")) + '">×</button></div>'
    );
  }

  function optionRow(name, en, hy, correct) {
    return (
      '<div class="admin-row-edit admin-option" data-option>' +
      '<input type="radio" name="' + name + '"' + (correct ? " checked" : "") + ' aria-label="' + esc(t("Correct answer")) + '" />' +
      input('data-o="en" placeholder="' + esc(t("Answer")) + '"', en) +
      input('data-o="hy" placeholder="' + esc(t("Answer (Armenian)")) + '"', hy) +
      '<button class="icon-btn" type="button" data-remove-row aria-label="' + esc(t("Remove")) + '">×</button></div>'
    );
  }

  function questionBlock(q) {
    const name = "correct-" + ++uid;
    const options = q.options.length ? q.options : ["", ""];
    return (
      '<div class="admin-question" data-question>' +
      '<div class="admin-question-head"><strong data-qnum></strong>' +
      '<button class="link-btn" type="button" data-remove-q>' + t("Remove question") + "</button></div>" +
      pair(field(t("Question"), area('data-f="q"', q.q, 2)), field(t("Question (Armenian)"), area('data-f="q_hy"', q.q_hy, 2))) +
      '<p class="admin-hint">' + t("Answers: tick the correct one. Armenian answers: all of them or none.") + "</p>" +
      '<div data-options>' + options.map((o, i) => optionRow(name, o, (q.options_hy || [])[i] || "", q.answer === i)).join("") + "</div>" +
      '<button class="link-btn" type="button" data-add-option="' + name + '">＋ ' + t("Add an answer") + "</button>" +
      pair(field(t("Explanation"), area('data-f="explain"', q.explain, 2)), field(t("Explanation (Armenian)"), area('data-f="explain_hy"', q.explain_hy, 2))) +
      "</div>"
    );
  }

  function editor(ctx) {
    const { id, rec, isBuiltin } = ctx;
    const d = ctx.data;
    const track = M.tracks[ctx.trackId];
    const live = liveTracks(ctx.recs.filter((r) => r.id !== id));
    const savedOnce = !!rec;
    const isPublished = rec ? rec.published : isBuiltin;

    const module = track && track.modules.find((m) => m.id === ctx.moduleId);
    let where;
    if (isBuiltin || savedOnce) {
      where =
        '<p class="admin-muted">' + esc((track ? track.icon + " " + L(track, "title") : ctx.trackId) + " · " + (module ? L(module, "title") : ctx.moduleId)) +
        ' · <code>' + esc(id) + "</code></p>";
    } else {
      where = '<p class="admin-muted">' + esc(track.icon + " " + L(track, "title")) + "</p>";
    }
    const positionFields = !isBuiltin
      ? '<div class="admin-pair">' +
        field(t("Module"), '<select class="admin-input" data-module>' +
          track.modules.map((m) => '<option value="' + esc(m.id) + '"' + (m.id === ctx.moduleId ? " selected" : "") + ">" + esc(L(m, "title")) + "</option>").join("") +
          "</select>") +
        field(t("Position"), '<select class="admin-input" data-after></select>') +
        "</div>" +
        (savedOnce ? "" : field(t("Lesson id"), input('data-id maxlength="40"', id),
          t("Used in links and in learners' progress. It can't be changed after the first save.")))
      : "";

    const intro = isBuiltin
      ? t("A lesson that ships with the site. Your version replaces its text for learners; its course materials and exercises stay. “Undo my changes” brings the original back.")
      : t("A lesson added here. It appears in its module as soon as it is visible to learners.");

    const html =
      '<a class="back-link" href="#lessons">' + t("← All lessons") + "</a>" +
      card(
        '<div class="admin-editor-head"><h2>' + esc(d.title || t("New lesson")) + "</h2>" +
        (savedOnce || isBuiltin ? lessonStatus(id, rec) : "") + "</div>" + where +
        '<p class="admin-muted admin-note">' + intro + "</p>" +
        '<form data-editor novalidate>' +
        positionFields +
        '<div class="admin-pair">' +
        field(t("Title") + " *", input('data-f="title" maxlength="200"', d.title)) +
        field(t("Title (Armenian)"), input('data-f="title_hy" maxlength="200"', d.title_hy)) +
        "</div>" +
        field(t("Reading time (minutes)"), input('data-f="minutes" type="number" min="1" max="600" step="1"', d.minutes)) +
        '<div class="admin-pair">' +
        field(t("Content") + " *", area('data-f="content" spellcheck="true"', d.content, 16)) +
        field(t("Content (Armenian)"), area('data-f="content_hy" spellcheck="true"', d.content_hy, 16)) +
        "</div>" +
        '<p class="admin-hint">' + t("Content is HTML. You can use: {0}. Anything else (scripts, styles, images, frames) is removed when you save.",
          "<code>" + esc('<p> <h3> <h4> <strong> <em> <ul>/<ol>/<li> <code> <pre><code>…</code></pre> <a href="https://…"> <blockquote> <table> <div class="callout">') + "</code>") + "</p>" +
        '<div class="admin-pair">' +
        field(t("Key takeaways (one per line)"), area('data-f="takeaways"', (d.takeaways || []).join("\n"), 4)) +
        field(t("Key takeaways (Armenian, one per line)"), area('data-f="takeaways_hy"', (d.takeaways_hy || []).join("\n"), 4)) +
        "</div>" +
        "<h3>" + t("Videos") + "</h3>" +
        '<div data-videos>' + (d.videos || []).map(videoRow).join("") + "</div>" +
        '<button class="link-btn" type="button" data-add-video>＋ ' + t("Add a video") + "</button>" +
        "<h3>" + t("Quiz") + "</h3>" +
        '<div data-quiz>' + (d.quiz || []).map(questionBlock).join("") + "</div>" +
        '<button class="link-btn" type="button" data-add-question>＋ ' + t("Add a question") + "</button>" +
        '<label class="lb-opt admin-publish"><input type="checkbox" data-f="published"' + (isPublished ? " checked" : "") + " /> " +
        t("Visible to learners") + "</label>" +
        '<div class="dash-actions">' +
        '<button class="btn btn-primary" type="submit">' + t("Save") + "</button>" +
        '<button class="btn" type="button" data-preview>' + t("Preview") + "</button>" +
        (isBuiltin || (rec && rec.published)
          ? '<a class="btn" href="tracks/' + esc(ctx.trackId) + ".html#" + encodeURIComponent(id) + '" target="_blank" rel="noopener">' + t("Open on the site ↗") + "</a>"
          : "") +
        (rec
          ? '<button class="btn btn-danger" type="button" data-delete>' + (isBuiltin ? t("Undo my changes") : t("Delete lesson")) + "</button>"
          : "") +
        "</div>" +
        '<p class="form-error" data-msg></p>' +
        "</form>") +
      '<div data-preview-out hidden></div>';

    return {
      html,
      bind(el) {
        const form = el.querySelector("[data-editor]");
        const msg = el.querySelector("[data-msg]");
        if (flash) {
          msg.style.color = "var(--success)";
          msg.textContent = flash;
          flash = null;
        }
        const f = (name) => form.querySelector('[data-f="' + name + '"]');

        /* position: the lessons of the chosen module (new lessons only) */
        const moduleSel = form.querySelector("[data-module]");
        const afterSel = form.querySelector("[data-after]");
        function fillPositions(selected) {
          const mod = live.tracks[ctx.trackId].modules.find((m) => m.id === moduleSel.value);
          const lessons = mod ? mod.lessons : [];
          afterSel.innerHTML =
            lessons.map((l) => '<option value="' + esc(l.id) + '">' + esc(t("After “{0}”", L(l, "title"))) + "</option>").join("") +
            '<option value="">' + t("At the end of the module") + "</option>";
          afterSel.value = selected && lessons.some((l) => l.id === selected) ? selected : "";
        }
        if (moduleSel) {
          fillPositions(ctx.after);
          moduleSel.addEventListener("change", () => fillPositions(null));
        }

        function renumber() {
          form.querySelectorAll("[data-question]").forEach((q, i) => {
            q.querySelector("[data-qnum]").textContent = t("Question {0}", i + 1);
          });
        }
        renumber();

        form.addEventListener("click", (e) => {
          const target = e.target.closest("button");
          if (!target) return;
          if (target.matches("[data-remove-row]")) target.closest(".admin-row-edit").remove();
          else if (target.matches("[data-remove-q]")) {
            target.closest("[data-question]").remove();
            renumber();
          } else if (target.matches("[data-add-video]")) {
            form.querySelector("[data-videos]").insertAdjacentHTML("beforeend", videoRow({}));
          } else if (target.matches("[data-add-question]")) {
            form.querySelector("[data-quiz]").insertAdjacentHTML("beforeend",
              questionBlock({ q: "", q_hy: "", options: [], options_hy: [], answer: 0, explain: "", explain_hy: "" }));
            renumber();
          } else if (target.matches("[data-add-option]")) {
            target.previousElementSibling.insertAdjacentHTML("beforeend", optionRow(target.dataset.addOption, "", "", false));
          }
        });

        const lines = (name) => f(name).value.split("\n").map((s) => s.trim()).filter(Boolean);

        function collect() {
          const videos = [...form.querySelectorAll("[data-video-row]")]
            .map((row) => {
              const v = (k) => row.querySelector('[data-v="' + k + '"]').value.trim();
              return { id: youtubeId(v("id")), title: v("title"), channel: v("channel"), length: v("length") };
            })
            .filter((v) => v.id || v.title || v.channel || v.length);
          const quiz = [...form.querySelectorAll("[data-question]")].map((qel) => {
            const val = (k) => qel.querySelector('[data-f="' + k + '"]').value.trim();
            const opts = [...qel.querySelectorAll("[data-option]")];
            const optionsHy = opts.map((o) => o.querySelector('[data-o="hy"]').value.trim());
            return {
              q: val("q"), q_hy: val("q_hy"),
              options: opts.map((o) => o.querySelector('[data-o="en"]').value.trim()),
              options_hy: optionsHy.every((x) => !x) ? [] : optionsHy,
              answer: opts.findIndex((o) => o.querySelector('input[type="radio"]').checked),
              explain: val("explain"), explain_hy: val("explain_hy"),
            };
          });
          return {
            track: ctx.trackId,
            module: moduleSel ? moduleSel.value : ctx.moduleId,
            after: afterSel ? afterSel.value || null : ctx.after,
            published: f("published").checked,
            title: f("title").value.trim(),
            title_hy: f("title_hy").value.trim(),
            minutes: Number(f("minutes").value),
            content: f("content").value,
            content_hy: f("content_hy").value,
            takeaways: lines("takeaways"),
            takeaways_hy: lines("takeaways_hy"),
            quiz,
            videos,
          };
        }

        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          msg.style.color = "";
          msg.textContent = "";
          const idInput = form.querySelector("[data-id]");
          const lessonId = idInput ? idInput.value.trim() : id;
          if (idInput && (builtin[lessonId] || ctx.recs.some((r) => r.id === lessonId))) {
            msg.textContent = t("That lesson id is taken. Choose another.");
            return;
          }
          const payload = collect();
          const btn = form.querySelector('button[type="submit"]');
          btn.disabled = true;
          try {
            const out = await send("PUT", lessonPath(lessonId), payload);
            /* The server removes HTML lessons can't use: say so, and show what it stored. */
            const stored = out.lesson.data;
            const cleaned =
              ["content", "content_hy"].some((k) => stored[k].trim() !== payload[k].trim()) ||
              ["takeaways", "takeaways_hy"].some((k) => stored[k].join("\n") !== payload[k].join("\n"));
            const note = cleaned
              ? t("Saved. Some HTML that lessons can't use was removed: check the content.")
              : out.lesson.published ? t("Saved. Learners see this version now.") : t("Saved as a draft. Learners don't see it yet.");
            if (!savedOnce) {
              /* First save: reopen as a saved lesson (delete/undo button, fixed id). */
              flash = note;
              const target = "#lesson/" + encodeURIComponent(lessonId);
              if (location.hash === target) route();
              else location.hash = target;
              return;
            }
            for (const k of ["content", "content_hy"]) f(k).value = stored[k];
            for (const k of ["takeaways", "takeaways_hy"]) f(k).value = stored[k].join("\n");
            ctx.recs = ctx.recs.filter((r) => r.id !== lessonId).concat(out.lesson);
            el.querySelector(".admin-editor-head").innerHTML =
              "<h2>" + esc(stored.title) + "</h2>" + lessonStatus(lessonId, out.lesson);
            msg.style.color = "var(--success)";
            msg.textContent = note;
          } catch (err) {
            msg.textContent = err.message;
          }
          btn.disabled = false;
        });

        const del = form.querySelector("[data-delete]");
        if (del) {
          del.addEventListener("click", async () => {
            const question = isBuiltin
              ? t("Undo your changes to this lesson? Learners will see the original again.")
              : t("Delete this lesson? Learners who completed it keep that in their progress, but the lesson is gone.");
            if (!confirm(question)) return;
            try {
              await send("DELETE", lessonPath(id));
              toast(isBuiltin ? t("The original lesson is back.") : t("Lesson deleted."));
              location.hash = "#lessons";
            } catch (err) {
              msg.textContent = err.message;
            }
          });
        }

        /* Preview: the lesson as saving would store it (the server checks it
           and removes HTML lessons can't use, without saving), roughly as
           learners see it, in the language the site is in. */
        form.querySelector("[data-preview]").addEventListener("click", async () => {
          const idInput = form.querySelector("[data-id]");
          msg.textContent = "";
          let d2;
          try {
            const payload = collect();
            d2 = (await send("POST", lessonPath(idInput ? idInput.value.trim() : id) + "/preview", payload)).data;
          } catch (err) {
            msg.style.color = "";
            msg.textContent = err.message;
            return;
          }
          const hy = I18N.lang() === "hy";
          const pick = (en, arm) => (hy && arm && (!Array.isArray(arm) || arm.length) ? arm : en);
          const out = el.querySelector("[data-preview-out]");
          const takeaways = pick(d2.takeaways, d2.takeaways_hy);
          out.innerHTML = card(
            '<span class="lesson-kicker">' + t("Preview") + "</span>" +
            '<div class="lesson admin-preview"><h1>' + esc(pick(d2.title, d2.title_hy)) + "</h1>" +
            '<div class="lesson-meta"><span>' + t("⏱ {0} min read", d2.minutes) + "</span></div>" +
            '<div class="lesson-body">' + pick(d2.content, d2.content_hy) + "</div>" +
            (takeaways.length ? '<div class="takeaways"><h3>' + t("Key takeaways") + "</h3><ul>" + takeaways.map((x) => "<li>" + x + "</li>").join("") + "</ul></div>" : "") +
            (d2.quiz.length
              ? "<h3>" + t("Quiz") + "</h3><ol>" + d2.quiz.map((q) =>
                  "<li><p>" + esc(pick(q.q, q.q_hy)) + "</p><ul>" +
                  pick(q.options, q.options_hy).map((o, i) => "<li>" + (i === q.answer ? "✅ " : "") + esc(o) + "</li>").join("") +
                  "</ul></li>").join("") + "</ol>"
              : "") +
            "</div>");
          out.hidden = false;
          out.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      },
    };
  }

  /* ============================================================ Announcements */

  let editingAnnouncement = null;

  async function viewAnnouncements() {
    const list = (await api("/api/admin/announcements")).announcements;
    const editing = list.find((a) => a.id === editingAnnouncement) || null;
    const a = editing || { text: "", text_hy: "", level: "info", active: true };

    const form = card(
      "<h3>" + (editing ? t("Edit announcement") : t("New announcement")) + "</h3>" +
      '<p class="admin-muted">' + t("Shown at the top of every page until you hide it. Learners can close it on their device.") + "</p>" +
      '<form data-ann-form>' +
      '<div class="admin-pair">' +
      field(t("Text") + " *", area('name="text" maxlength="300"', a.text, 3)) +
      field(t("Text (Armenian)"), area('name="text_hy" maxlength="300"', a.text_hy, 3)) +
      "</div>" +
      field(t("Kind"), '<select class="admin-input" name="level">' +
        '<option value="info"' + (a.level === "info" ? " selected" : "") + ">📣 " + t("Information") + "</option>" +
        '<option value="warning"' + (a.level === "warning" ? " selected" : "") + ">⚠️ " + t("Warning") + "</option></select>") +
      '<label class="lb-opt"><input type="checkbox" name="active"' + (a.active ? " checked" : "") + " /> " + t("Show it now") + "</label>" +
      '<div class="dash-actions"><button class="btn btn-primary" type="submit">' + (editing ? t("Save") : t("Post")) + "</button>" +
      (editing ? '<button class="btn" type="button" data-ann-cancel>' + t("Cancel") + "</button>" : "") +
      "</div><p class=\"form-error\" data-msg></p></form>");

    const items = list.length
      ? list.map((x) =>
          card(
            '<div class="admin-ann-head">' + (x.level === "warning" ? badge("draft", "⚠️ " + t("Warning")) : badge("info", "📣 " + t("Information"))) +
            (x.active ? badge("new", t("showing")) : badge("muted", t("hidden"))) + "</div>" +
            '<p class="admin-ann-text">' + esc(x.text) + "</p>" +
            (x.text_hy ? '<p class="admin-ann-text admin-muted" lang="hy">' + esc(x.text_hy) + "</p>" : "") +
            '<p class="admin-hint">' + t("Posted by {0} on {1}", esc(x.createdBy), fmtDateTime(x.created)) + "</p>" +
            '<div class="dash-actions">' +
            '<button class="btn" data-toggle="' + x.id + '">' + (x.active ? t("Hide") : t("Show")) + "</button>" +
            '<button class="btn" data-edit="' + x.id + '">' + t("Edit") + "</button>" +
            '<button class="btn btn-danger" data-remove="' + x.id + '">' + t("Delete") + "</button></div>",
            "admin-ann")).join("")
      : card('<p class="admin-muted">' + t("No announcements yet.") + "</p>");

    return {
      html: form + '<div data-ann-list>' + items + "</div>",
      bind(el) {
        const formEl = el.querySelector("[data-ann-form]");
        const msg = formEl.querySelector("[data-msg]");
        const body = () => {
          const fd = new FormData(formEl);
          return { text: fd.get("text"), text_hy: fd.get("text_hy"), level: fd.get("level"), active: fd.get("active") === "on" };
        };
        formEl.addEventListener("submit", async (e) => {
          e.preventDefault();
          msg.textContent = "";
          try {
            if (editing) await send("PUT", "/api/admin/announcements/" + editing.id, body());
            else await send("POST", "/api/admin/announcements", body());
            toast(editing ? t("Saved.") : t("Posted."));
            editingAnnouncement = null;
            route();
          } catch (err) {
            msg.textContent = err.message;
          }
        });
        const cancel = formEl.querySelector("[data-ann-cancel]");
        if (cancel) {
          cancel.addEventListener("click", () => {
            editingAnnouncement = null;
            route();
          });
        }
        el.querySelector("[data-ann-list]").addEventListener("click", async (e) => {
          const b = e.target.closest("button[data-toggle], button[data-edit], button[data-remove]");
          if (!b) return;
          const x = list.find((y) => String(y.id) === (b.dataset.toggle || b.dataset.edit || b.dataset.remove));
          if (!x) return;
          try {
            if (b.dataset.edit) {
              editingAnnouncement = x.id;
            } else if (b.dataset.toggle) {
              await send("PUT", "/api/admin/announcements/" + x.id, { ...x, active: !x.active });
            } else {
              if (!confirm(t("Delete this announcement?"))) return;
              await send("DELETE", "/api/admin/announcements/" + x.id);
            }
            route();
          } catch (err) {
            toast(err.message);
          }
        });
      },
    };
  }

  /* ============================================================ Activity log */

  const ACTIONS = {
    "reset-link": "Sent a password-reset link",
    "sign-out": "Signed out on every device",
    "delete-account": "Deleted an account",
    "lesson-create": "Created a lesson",
    "lesson-update": "Changed a lesson",
    "lesson-delete": "Deleted a lesson",
    "announcement-create": "Posted an announcement",
    "announcement-update": "Changed an announcement",
    "announcement-delete": "Deleted an announcement",
    "admin-add": "Made an admin",
    "admin-remove": "Removed admin rights",
  };
  const DETAILS = { published: "visible to learners", draft: "draft", shown: "showing", hidden: "hidden" };

  async function viewLog() {
    const entries = (await api("/api/admin/log")).entries;
    if (!entries.length) return { html: card('<p class="admin-muted">' + t("Nothing has been changed yet.") + "</p>") };
    /* A built-in lesson's first save and its delete are an edit and an undo. */
    const action = (e) => {
      if (builtin[e.target] && e.action === "lesson-create") return t("Edited a lesson");
      if (builtin[e.target] && e.action === "lesson-delete") return t("Undid the changes to a lesson");
      return t(ACTIONS[e.action] || e.action);
    };
    const target = (e) => {
      if (!e.target) return "";
      if (e.action.startsWith("lesson-") && (e.action !== "lesson-delete" || builtin[e.target])) {
        return '<a href="#lesson/' + encodeURIComponent(e.target) + '">' + esc(e.target) + "</a>";
      }
      if (["reset-link", "sign-out", "admin-add", "admin-remove"].includes(e.action)) {
        return '<a href="#learner/' + encodeURIComponent(e.target) + '">' + esc(e.target) + "</a>";
      }
      return esc(e.target);
    };
    const detail = (e) => {
      if (!e.detail) return "";
      if (DETAILS[e.detail]) return esc(t(DETAILS[e.detail]));
      const sessions = e.detail.match(/^(\d+) session\(s\)$/);
      if (sessions) return esc(t(sessions[1] === "1" ? "{0} device" : "{0} devices", sessions[1]));
      return esc(e.detail);
    };
    const rows = entries
      .map((e) =>
        "<tr><td>" + fmtDateTime(e.ts) + "</td><td>" + esc(e.admin === "(server)" ? t("the server (make admin)") : e.admin) + "</td>" +
        "<td>" + esc(action(e)) + "</td><td>" + target(e) + "</td><td>" + detail(e) + "</td></tr>")
      .join("");
    return {
      html: card(
        '<p class="admin-muted">' + t("Every change made in this panel, newest first (the last 200).") + "</p>" +
        '<div class="table-wrap"><table class="admin-table"><thead><tr><th>' + t("When") + "</th><th>" + t("Who") +
        "</th><th>" + t("What") + "</th><th>" + t("Which") + "</th><th>" + t("Details") + "</th></tr></thead><tbody>" +
        rows + "</tbody></table></div>"),
    };
  }
})();
