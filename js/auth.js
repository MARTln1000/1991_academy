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
    "1991_academy:progress:v1",
    "1991_academy:xp:v1",
    "1991_academy:review:v1",
    "1991_academy:lang",
  ];
  const DRAFT_PREFIX = "1991_academy:draft:";
  const LAST_USER_KEY = "1991_academy:lastUser";

  /* The server caps a request body at 300 KB. Stay under it with room for
     JSON overhead; if we're over, code drafts are shed before progress. */
  const PAYLOAD_LIMIT = 260_000;
  const PUSH_DEBOUNCE_MS = 1500;

  let user = null;
  let offline = false; // no server behind this page (e.g. opened via file://)
  let pushTimer = null;
  let lastSyncedAt = null;
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

  /* Replace local state with the server's copy, then tell the page so it can
     re-render in place (no full reload — that threw away the rendered view
     and flashed the whole UI). Reports whether the language changed, since
     that IS baked into every rendered string and needs a reload. */
  function apply(data) {
    const langBefore = localStorage.getItem("1991_academy:lang");
    clearLocal();
    for (const [key, v] of Object.entries(data || {})) {
      const k = currentStoreKey(key); // a blob saved before the "martinium:" rename
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
    if (!user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push().catch(() => {}), PUSH_DEBOUNCE_MS);
  }

  /* Best-effort flush of anything still sitting in the debounce window when
     the tab goes away — otherwise the last few seconds of work never leave.
     sendBeacon can't be used here: it only issues POST, and /api/state is PUT. */
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
        keepalive: body.length < 60_000, // the keepalive body cap
        body,
      }).catch(() => {});
    } catch {
      /* on the way out — nothing useful left to do */
    }
  }

  /* Decide what wins when logging in on a device with existing data. */
  async function reconcile(newUser) {
    const previousOwner = localStorage.getItem(LAST_USER_KEY);
    const server = (await api("/api/state")).data;
    const ownDevice = !previousOwner || previousOwner === newUser.username;
    let adoptedServer = false;

    if (!ownDevice) {
      // Local data belongs to a different account (already synced there).
      apply(server || {});
      adoptedServer = true;
    } else if (server && xpTotalOf(server) > xpTotalOf(collect())) {
      // The account knows more than this device — take the server copy.
      apply(server);
      adoptedServer = true;
    } else {
      // This device is the richest copy — upload it. Best-effort: the account
      // already exists and the local copy is intact, so a failed first push
      // must not make a successful sign-in look like a failure. push() has
      // already warned the user, and schedule() retries on the next change.
      await push().catch(() => {});
    }
    localStorage.setItem(LAST_USER_KEY, newUser.username);
    return adoptedServer;
  }

  /* ---------- Nav ---------- */

  function updateNav() {
    /* Signed out, only the sign-in and privacy pages are reachable: hide the
       links to everything else (css/components.css, body.signed-out). */
    document.body.classList.toggle("signed-out", !user && !offline);
    const label = user ? "👤 " + user.username : (typeof t === "function" ? t("Sign in") : "Sign in");
    document.querySelectorAll("[data-account]").forEach((el) => {
      el.textContent = label;
      /* Admins get a link to the admin panel next to their name. (Only a
         shortcut: the server checks the admin flag on every admin request.) */
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
      // Another device may have earned XP since this one last synced.
      const server = (await api("/api/state")).data;
      if (server && xpTotalOf(server) > xpTotalOf(collect())) {
        // The page is already rendered, so only a language switch needs a reload.
        if (apply(server).langChanged) {
          location.reload();
          return user;
        }
      }
    } catch (e) {
      if (e.status === undefined) offline = true; // network error: no server here
      user = null;
    }
    updateNav();
    return user;
  }

  const ready = init();

  /* PUT is not guaranteed on unload, so flush via sendBeacon instead.
     pagehide covers the bfcache/mobile path that unload misses. */
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

    /* Also an invited student's first password: then the answer carries the
       account, and they are signed in. */
    async resetPassword(token, password) {
      return api("/api/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
    },

    /* Whose invitation (or reset) link this is: {username}. */
    welcome(token) {
      return api("/api/welcome", { method: "POST", body: JSON.stringify({ token }) });
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
