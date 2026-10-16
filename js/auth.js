/**
 * Authentication and state sync.
 *
 * The site works without an account (state lives in localStorage). When signed
 * in, the same keys are synchronised with /api/state, debounced.
 */

const Auth = (() => {
  /* Keys synchronised with the account; everything else stays device-local. */
  const SYNC_KEYS = [
    "1991_academy:progress:v1",
    "1991_academy:xp:v1",
    "1991_academy:review:v1",
    "1991_academy:lang",
  ];
  const DRAFT_PREFIX = "1991_academy:draft:";
  const LAST_USER_KEY = "1991_academy:lastUser";

  /* Request-body budget, below the server's 300 KB limit. */
  const PAYLOAD_LIMIT = 260_000;
  const PUSH_DEBOUNCE_MS = 1500;

  let user = null;
  let offline = false; // true when no backend is available (e.g. file://)
  let pushTimer = null;
  let lastSyncedAt = null;
  let warnedAbout = null; // last failure reported, to avoid repeated toasts

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
      err.body = body;          /* structured error details, e.g. mustChangePassword */
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

  /* Serialize for upload. When over budget, drop the largest code drafts first;
     progress, XP and reviews are never dropped. */
  function serialize(data) {
    let payload = data;
    let body = JSON.stringify({ data: payload });
    if (body.length <= PAYLOAD_LIMIT) return { body, dropped: 0 };

    payload = { ...data };
    const drafts = Object.keys(payload)
      .filter(isDraft)
      .sort((a, b) => payload[b].length - payload[a].length);
    let dropped = 0;
    for (const k of drafts) {
      delete payload[k];
      dropped += 1;
      body = JSON.stringify({ data: payload });
      if (body.length <= PAYLOAD_LIMIT) break;
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

  /* Replace local state with the server copy and notify the page to re-render.
     Returns whether the language changed, which requires a full reload. */
  function apply(data) {
    const langBefore = localStorage.getItem("1991_academy:lang");
    clearLocal();
    for (const [key, v] of Object.entries(data || {})) {
      const k = currentStoreKey(key); // legacy key prefix
      if (syncedKey(k) && typeof v === "string") localStorage.setItem(k, v);
    }
    if (typeof notifyStateChanged === "function") notifyStateChanged();
    return { langChanged: localStorage.getItem("1991_academy:lang") !== langBefore };
  }

  function xpTotalOf(blob) {
    try {
      return JSON.parse(blob["1991_academy:xp:v1"] ?? blob["martinium:xp:v1"]).total || 0;
    } catch {
      return 0;
    }
  }

  /* ---------- Sync ---------- */

  function warnOnce(kind, message) {
    if (warnedAbout === kind) return;
    warnedAbout = kind;
    if (typeof toast === "function") toast(message);
  }

  async function push() {
    if (!user) return;
    const { body, dropped } = serialize(collect());
    try {
      await api("/api/state", { method: "PUT", body });
      lastSyncedAt = Date.now();
      warnedAbout = null;
      if (dropped) {
        warnOnce("dropped", t("Progress synced. {0} large code draft(s) stayed on this device.", dropped));
      }
    } catch (err) {
      if (err.status === 401) {
        // Session expired or revoked: treat as signed out.
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
    if (!user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push().catch(() => {}), PUSH_DEBOUNCE_MS);
  }

  /* Flush pending changes when the page is hidden. Uses fetch keepalive,
     since sendBeacon only supports POST and /api/state is PUT. */
  function flush() {
    if (!user || pushTimer === null) return;
    clearTimeout(pushTimer);
    pushTimer = null;
    const { body } = serialize(collect());
    try {
      fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive: body.length < 60_000, // keepalive body limit
        body,
      }).catch(() => {});
    } catch {
      /* ignore: page is unloading */
    }
  }

  /* Resolve local vs. server state on sign-in. */
  async function reconcile(newUser) {
    const previousOwner = localStorage.getItem(LAST_USER_KEY);
    const server = (await api("/api/state")).data;
    const ownDevice = !previousOwner || previousOwner === newUser.username;
    let adoptedServer = false;

    if (!ownDevice) {
      // Local data belongs to another account: adopt the server copy.
      apply(server || {});
      adoptedServer = true;
    } else if (server && xpTotalOf(server) > xpTotalOf(collect())) {
      // Server copy is ahead: adopt it.
      apply(server);
      adoptedServer = true;
    } else {
      // Local copy is ahead: upload it. A failure here is non-fatal: push()
      // reports it and the next change retries.
      await push().catch(() => {});
    }
    localStorage.setItem(LAST_USER_KEY, newUser.username);
    return adoptedServer;
  }

  /* ---------- Nav ---------- */

  function updateNav() {
    /* Signed out: hide links to pages that require a session. */
    document.body.classList.toggle("signed-out", !user && !offline);
    const label = user ? "👤 " + user.username : (typeof t === "function" ? t("Sign in") : "Sign in");
    document.querySelectorAll("[data-account]").forEach((el) => {
      el.textContent = label;
      /* Admin panel shortcut; authorization is enforced server-side. */
      const link = el.previousElementSibling && el.previousElementSibling.matches("[data-admin-link]")
        ? el.previousElementSibling : null;
      if (user && user.admin && !link) {
        const a = document.createElement("a");
        a.className = "nav-link";
        a.dataset.adminLink = "";
        a.href = el.getAttribute("href").replace("account.html", "admin.html");
        a.textContent = typeof t === "function" ? t("Admin") : "Admin";
        el.before(a);
      } else if (!(user && user.admin) && link) {
        link.remove();
      }
    });
  }

  /* ---------- Session ---------- */

  async function init() {
    try {
      user = (await api("/api/me")).user;
      // Another device may have synced newer progress.
      const server = (await api("/api/state")).data;
      if (server && xpTotalOf(server) > xpTotalOf(collect())) {
        // Only a language change requires a reload.
        if (apply(server).langChanged) {
          location.reload();
          return user;
        }
      }
    } catch (e) {
      if (e.status === undefined) offline = true; // network error: no backend
      user = null;
    }
    updateNav();
    return user;
  }

  const ready = init();

  /* Flush on pagehide, which also fires for bfcache and on mobile. */
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });

  return {
    ready,
    current: () => user,
    isOffline: () => offline,
    lastSyncedAt: () => lastSyncedAt,

    async login(identifier, password) {
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
      await api("/api/logout", { method: "POST" }).catch(() => {});
      // The local copy is kept on this device.
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

    /* Exchange a temporary password for a new one and sign in. */
    async firstPassword(identifier, password, newPassword) {
      const out = await api("/api/first-password", {
        method: "POST",
        body: JSON.stringify({ identifier, password, newPassword }),
      });
      user = out.user;
      await reconcile(user);
      updateNav();
      return user;
    },

    /* Invitation links (account.html#join=TOKEN): validate, then redeem. */
    joinCheck(token) {
      return api("/api/join/check", { method: "POST", body: JSON.stringify({ token }) });
    },

    join(token, email, username) {
      return api("/api/join", { method: "POST", body: JSON.stringify({ token, email, username }) });
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

    /* Leaderboard opt-in and standings. */
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

/* Called by progress.js, xp.js and review.js after each save. */
window.Sync = { schedule: Auth.schedule };
