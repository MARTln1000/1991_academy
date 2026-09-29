/* ============================================
   1991 Academy — Auth & sync
   Accounts are optional: everything works as a
   guest in localStorage. Signed in, the same
   state syncs to the server (debounced), so
   progress follows you across devices.
   ============================================ */

const Auth = (() => {
  /* Keys mirrored to the account. Anything not listed here stays on this
     device (theme, per-problem editor language). */
  const SYNC_KEYS = [
    "martinium:progress:v1",
    "martinium:xp:v1",
    "martinium:review:v1",
    "martinium:dsa:v1",
    "martinium:lang",
  ];
  const DRAFT_PREFIX = "martinium:draft:";
  const LAST_USER_KEY = "martinium:lastUser";
  const BASE_KEY = "martinium:sync-base";

  /* The server caps a request body at 300 KB. Stay under it with room for
     JSON overhead; if we're over, code drafts are shed before progress. */
  const PAYLOAD_LIMIT = 260_000;
  const PUSH_DEBOUNCE_MS = 1500;

  let user = null;
  let offline = false; // no server behind this page (e.g. opened via file://)
  let pushTimer = null;
  let lastSyncedAt = null;
  let revision = null;
  let conflict = null;
  let pushQueue = Promise.resolve();
  let reconciling = false;
  let warnedAbout = null; // so a persistent failure toasts once, not every 1.5 s

  /* ---------- HTTP ---------- */

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      ...opts,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || "HTTP " + res.status);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  /* ---------- Local state <-> blob ---------- */

  function isDraft(k) {
    return k.startsWith(DRAFT_PREFIX);
  }

  function syncedKey(k) {
    return SYNC_KEYS.includes(k) || isDraft(k);
  }

  function collect() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (syncedKey(k)) data[k] = localStorage.getItem(k);
    }
    return data;
  }

  /* Serialize for the wire, shedding the largest code drafts first if the
     blob would be rejected. Progress/XP/reviews are never dropped — losing a
     draft is an inconvenience, losing progress is not acceptable. */
  function serialize(data) {
    let payload = data;
    let body = JSON.stringify({ data: payload, expectedUpdated: revision, owner: user && user.username });
    if (new TextEncoder().encode(body).length <= PAYLOAD_LIMIT) return { body, dropped: 0 };

    payload = { ...data };
    const drafts = Object.keys(payload)
      .filter(isDraft)
      .sort((a, b) => payload[b].length - payload[a].length);
    let dropped = 0;
    for (const k of drafts) {
      delete payload[k];
      dropped += 1;
      body = JSON.stringify({ data: payload, expectedUpdated: revision, owner: user && user.username });
      if (new TextEncoder().encode(body).length <= PAYLOAD_LIMIT) break;
    }
    return { body, dropped };
  }

  function clearLocal() {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (syncedKey(k)) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  }

  /* Replace local state with the server's copy, then tell the page so it can
     re-render in place (no full reload — that threw away the rendered view
     and flashed the whole UI). Reports whether the language changed, since
     that IS baked into every rendered string and needs a reload. */
  function apply(data) {
    const langBefore = localStorage.getItem("martinium:lang");
    const previous = collect();
    try {
      clearLocal();
      for (const [key, v] of Object.entries(data || {})) {
        const k = key; // a blob saved before the storage rename
        if (syncedKey(k) && typeof v === "string") localStorage.setItem(k, v);
      }
    } catch (err) {
      clearLocal();
      for (const [key, value] of Object.entries(previous)) localStorage.setItem(key, value);
      throw err;
    }
    if (typeof notifyStateChanged === "function") notifyStateChanged();
    return { langChanged: localStorage.getItem("martinium:lang") !== langBefore };
  }

  function same(a, b) {
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    return [...keys].every(k => (a || {})[k] === (b || {})[k]);
  }

  function remember(data) {
    try { localStorage.setItem(BASE_KEY, JSON.stringify({ owner: user.username, data })); }
    catch { /* If storage is full, next reconciliation asks instead of guessing. */ }
  }

  function baseline() {
    try {
      const base = JSON.parse(localStorage.getItem(BASE_KEY));
      return base && base.owner === user.username ? base.data : null;
    } catch { return null; }
  }

  function reportConflict(server) {
    conflict = { server };
    warnOnce("conflict", t("Progress changed in another session. Open Account to choose which copy to keep."));
    if (typeof notifyStateChanged === "function") notifyStateChanged();
  }

  /* ---------- Sync ---------- */

  function warnOnce(kind, message) {
    if (warnedAbout === kind) return;
    warnedAbout = kind;
    if (typeof toast === "function") toast(message);
  }

  function push() {
    const owner = user;
    const next = pushQueue.catch(() => {}).then(() => {
      if (!owner || owner !== user) return;
      return pushOnce();
    });
    pushQueue = next;
    return next;
  }

  async function pushOnce() {
    if (!user) return;
    const owner = user;
    if (conflict) throw new Error("Resolve the progress conflict on the Account page first.");
    if (localStorage.getItem(LAST_USER_KEY) !== owner.username) {
      user = null;
      updateNav();
      throw new Error("Account changed in another tab. Reload before syncing.");
    }
    const { body, dropped } = serialize(collect());
    try {
      const out = await api("/api/state", { method: "PUT", body, keepalive: new TextEncoder().encode(body).length < 60_000 });
      if (user !== owner) return;
      revision = out.updated;
      remember(JSON.parse(body).data);
      lastSyncedAt = Date.now();
      warnedAbout = null;
      if (dropped) {
        warnOnce("dropped", t("Progress synced. {0} large code draft(s) stayed on this device.", dropped));
      }
    } catch (err) {
      if (user !== owner) throw err;
      if (err.status === 409) {
        reportConflict(null);
      } else if (err.status === 401) {
        // Session expired or revoked elsewhere — stop pretending we're signed in.
        user = null;
        updateNav();
        warnOnce("auth", t("Signed out — your progress is safe on this device."));
      } else {
        warnOnce("net", t("Couldn't sync to your account. Your progress is safe on this device."));
      }
      throw err;
    }
  }

  function schedule() {
    if (!user || reconciling) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushTimer = null; push().catch(() => {}); }, PUSH_DEBOUNCE_MS);
  }

  /* Best-effort flush of anything still sitting in the debounce window when
     the tab goes away — otherwise the last few seconds of work never leave.
     sendBeacon can't be used here: it only issues POST, and /api/state is PUT. */
  function flush() {
    if (!user || pushTimer === null || reconciling) return;
    clearTimeout(pushTimer);
    pushTimer = null;
    // Use the same queue and revision handling as normal sync. A background
    // fetch racing an active write could overwrite it or leave us on an old revision.
    push().catch(() => {});
  }

  /* Decide what wins when logging in on a device with existing data. */
  async function reconcile(newUser) {
    const previousOwner = localStorage.getItem(LAST_USER_KEY);
    const snapshot = await api("/api/state");
    if (snapshot.owner && snapshot.owner !== newUser.username) throw new Error("Account changed. Reload before syncing.");
    const server = snapshot.data;
    revision = snapshot.updated;
    const ownDevice = !previousOwner || previousOwner === newUser.username;
    let adoptedServer = false;

    conflict = null;
    const local = collect();
    const base = baseline();
    if (!ownDevice || (!Object.keys(local).length && server)) {
      apply(server || {});
      remember(server || {});
      adoptedServer = true;
    } else if (server && same(server, local)) {
      remember(server);
    } else if (!server || (base && same(server, base))) {
      localStorage.setItem(LAST_USER_KEY, newUser.username);
      await push().catch(() => {});
    } else if (base && same(local, base)) {
      apply(server);
      remember(server);
      adoptedServer = true;
    } else {
      // XP does not order draft edits, reviews, deletions or language changes.
      // Retain both copies until the learner chooses; never upload a guess.
      reportConflict(server);
    }
    localStorage.setItem(LAST_USER_KEY, newUser.username);
    return adoptedServer;
  }

  /* ---------- Nav ---------- */

  function updateNav() {
    const label = user ? "👤 " + user.username : (typeof t === "function" ? t("Sign in") : "Sign in");
    document.querySelectorAll("[data-account]").forEach((el) => {
      el.textContent = label;
    });
  }

  /* ---------- Session ---------- */

  async function init() {
    try {
      user = (await api("/api/me")).user;
      reconciling = true;
      const langBefore = localStorage.getItem("martinium:lang");
      await reconcile(user);
      if (localStorage.getItem("martinium:lang") !== langBefore) location.reload();
    } catch (e) {
      if (e.status === undefined) offline = true; // network error: no server here
      user = null;
    }
    reconciling = false;
    updateNav();
    return user;
  }

  const ready = init();

  /* Flush early on visibilitychange; pagehide is a best-effort fallback. */
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });

  return {
    ready,
    current: () => user,
    isOffline: () => offline,
    lastSyncedAt: () => lastSyncedAt,
    hasConflict: () => !!conflict,

    async resolveConflict(choice) {
      if (!user || !conflict) return;
      const snapshot = await api("/api/state");
      if (localStorage.getItem(LAST_USER_KEY) !== user.username || (snapshot.owner && snapshot.owner !== user.username)) {
        throw new Error("Account changed. Reload before syncing.");
      }
      revision = snapshot.updated;
      if (choice === "server") {
        const changed = apply(snapshot.data || {});
        remember(snapshot.data || {});
        conflict = null;
        if (changed.langChanged) location.reload();
      } else if (choice === "local") {
        conflict = null;
        try { await push(); }
        catch (err) { reportConflict(snapshot.data); throw err; }
      } else {
        throw new Error("Choose local or server progress.");
      }
    },

    async register(username, email, password) {
      await ready;
      clearTimeout(pushTimer);
      pushTimer = null;
      await pushQueue.catch(() => {});
      const out = await api("/api/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      });
      user = out.user;
      await reconcile(user);
      updateNav();
      return user;
    },

    async login(identifier, password) {
      await ready;
      clearTimeout(pushTimer);
      pushTimer = null;
      await pushQueue.catch(() => {});
      const out = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });
      user = out.user;
      const adopted = await reconcile(user);
      updateNav();
      return { user, adopted };
    },

    async logout() {
      clearTimeout(pushTimer);
      pushTimer = null;
      if (!conflict) await push();
      await api("/api/logout", { method: "POST" });
      // The local copy stays on this device; the account keeps its own.
      user = null;
      clearTimeout(pushTimer);
      pushTimer = null;
      warnedAbout = null;
      updateNav();
    },

    async changePassword(currentPassword, newPassword) {
      await api("/api/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },

    // Always resolves (the server returns a generic response either way).
    async forgotPassword(email) {
      await api("/api/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    },

    async resetPassword(token, password) {
      await api("/api/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
    },

    async deleteAccount(password) {
      await api("/api/delete-account", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      user = null;
      updateNav();
    },

    async syncNow() {
      clearTimeout(pushTimer);
      pushTimer = null;
      await push();
      return lastSyncedAt;
    },

    /* Read the opt-in flag / rank board. Kept here so every network call to
       the account API lives in one module. */
    async setLeaderboardOptIn(optIn) {
      const out = await api("/api/leaderboard-optin", {
        method: "POST",
        body: JSON.stringify({ optIn }),
      });
      if (user) user.leaderboardOptIn = out.optIn;
      return out.optIn;
    },

    leaderboard(period) {
      return api("/api/leaderboard?period=" + (period === "all" ? "all" : "week"));
    },

    schedule,
  };
})();

/* progress.js / xp.js / review.js call Sync.schedule() after every save */
window.Sync = { schedule: Auth.schedule };
