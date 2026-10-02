/* ============================================
   1991 Academy — Common
   Namespace, theme toggle, toast, store
   invalidation, helpers.
   Loaded first on every page.
   ============================================ */

window.ACADEMY_1991 = window.ACADEMY_1991 || { tracks: {}, order: [] };

const M = window.ACADEMY_1991;

/* ---------- Storage prefix ----------
   Everything this site keeps in localStorage (progress, XP, reviews, settings,
   code drafts) lives under STORE_PREFIX. Until the project was renamed the
   prefix was "martinium:", so a returning visitor's data is moved over once,
   here, before any other script reads it. auth.js renames old keys arriving
   from the server with currentStoreKey(), and the server does the same. */
const STORE_PREFIX = "1991_academy:";
const LEGACY_STORE_PREFIX = "martinium:";

function currentStoreKey(key) {
  return key.startsWith(LEGACY_STORE_PREFIX) ? STORE_PREFIX + key.slice(LEGACY_STORE_PREFIX.length) : key;
}

(function migrateLegacyStorage() {
  try {
    const legacy = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LEGACY_STORE_PREFIX)) legacy.push(k);
    }
    for (const k of legacy) {
      const renamed = currentStoreKey(k);
      if (localStorage.getItem(renamed) === null) localStorage.setItem(renamed, localStorage.getItem(k));
      localStorage.removeItem(k);
    }
  } catch {
    /* storage blocked (private mode, settings): nothing to migrate */
  }
})();

/* ---------- Theme ---------- */
const THEME_KEY = "1991_academy:theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.textContent = theme === "dark" ? "☀️" : "🌙";
    btn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  });
}

function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "dark");
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-theme-toggle]")) return;
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}

/* ---------- Store invalidation ----------
   Progress/XP/Review cache their parsed localStorage blob so a render pass
   doesn't re-parse it dozens of times. Anything that writes those keys from
   OUTSIDE those modules (a sync pull, or another tab) must announce it:

     1991_academy:store-invalidate → caches drop, no re-render
     1991_academy:state-changed    → page controllers re-render

   `notifyStateChanged()` fires both, in that order. */

function invalidateStores() {
  document.dispatchEvent(new CustomEvent("1991_academy:store-invalidate"));
}

function notifyStateChanged() {
  invalidateStores();
  document.dispatchEvent(new CustomEvent("1991_academy:state-changed"));
}

/* Page controllers call this instead of wiring the listener by hand. */
function onStateChanged(handler) {
  document.addEventListener("1991_academy:state-changed", handler);
}

/* Another tab wrote our keys — adopt its view. Debounced because a sync pull
   rewrites every key in a burst and each one fires its own storage event. */
(function watchOtherTabs() {
  let timer = null;
  window.addEventListener("storage", (e) => {
    if (e.key && !e.key.startsWith(STORE_PREFIX)) return;
    clearTimeout(timer);
    timer = setTimeout(notifyStateChanged, 150);
  });
})();

/* ---------- Toast (queued, so rewards don't overwrite each other) ---------- */
const toastQueue = [];
let toastActive = false;

function toast(message) {
  toastQueue.push(message);
  if (!toastActive) nextToast();
}

function nextToast() {
  const message = toastQueue.shift();
  if (message === undefined) {
    toastActive = false;
    return;
  }
  toastActive = true;
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(nextToast, 260);
  }, 2100);
}

/* ---------- Helpers ---------- */

/* Escapes every character that can break out of an HTML text node OR an
   attribute value — single quotes included, since not every template here
   uses double quotes. */
const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function esc(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ESC_MAP[ch]);
}

/* Quiz/practice answer keys: A, B, C … Z, then AA, AB … so a question with
   more than four options never renders "undefined". */
function optionLetter(i) {
  let out = "";
  let n = i;
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

function allLessons(track) {
  return track.modules.flatMap((m) => m.lessons);
}

function renderStreakPill() {
  const el = document.querySelector("[data-streak]");
  if (!el || typeof Progress === "undefined") return;
  const streak = Progress.getStreak();
  el.textContent = streak > 0 ? "🔥 " + t("{0}-day streak", streak) : "🔥 " + t("Start your streak");
}

initTheme();

/* ---------- Credit ----------
   The courses' lectures, slides and homework were created by FAST Foundation.
   One very small line at the foot of every page says so; i18n.js translates
   it. (Who runs the site, the support address and the privacy policy link
   are in the main page's footer.) */
(function fastCredit() {
  const credit = document.createElement("p");
  credit.className = "fast-credit";
  credit.setAttribute("data-i18n", "credit.fast");
  credit.textContent = "Course materials (lectures, slides and homework) were created by FAST Foundation.";
  document.body.appendChild(credit);
})();
