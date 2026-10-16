/**
 * Shared utilities, loaded first on every page: namespace, storage migration,
 * theme, toasts, state-change events and HTML helpers.
 */

window.ACADEMY_1991 = window.ACADEMY_1991 || { tracks: {}, order: [] };

const M = window.ACADEMY_1991;

/* ---------- Storage prefix ----------
   All localStorage keys use STORE_PREFIX. Keys with the legacy prefix are
   migrated once on load, before other scripts read them. */
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
    /* storage unavailable */
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
   Progress, XP and Review cache their parsed blobs. Writers outside those
   modules (sync pulls, other tabs) must call notifyStateChanged(), which
   dispatches:

     1991_academy:store-invalidate   drop caches
     1991_academy:state-changed      re-render */

function invalidateStores() {
  document.dispatchEvent(new CustomEvent("1991_academy:store-invalidate"));
}

function notifyStateChanged() {
  invalidateStores();
  document.dispatchEvent(new CustomEvent("1991_academy:state-changed"));
}

/* Subscribe a page controller to state changes. */
function onStateChanged(handler) {
  document.addEventListener("1991_academy:state-changed", handler);
}

/* Cross-tab updates. Debounced: a sync pull rewrites many keys at once. */
(function watchOtherTabs() {
  let timer = null;
  window.addEventListener("storage", (e) => {
    if (e.key && !e.key.startsWith(STORE_PREFIX)) return;
    clearTimeout(timer);
    timer = setTimeout(notifyStateChanged, 150);
  });
})();

/* ---------- Toast (queued) ---------- */
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

/* Escape for HTML text and attribute contexts (including single quotes). */
const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function esc(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ESC_MAP[ch]);
}

/* Option labels: A..Z, then AA, AB, ... */
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
   Attribution footer for FAST Foundation course materials. */
(function fastCredit() {
  const credit = document.createElement("p");
  credit.className = "fast-credit";
  credit.setAttribute("data-i18n", "credit.fast");
  credit.textContent = "Course materials (lectures, slides and homework) were created by FAST Foundation.";
  document.body.appendChild(credit);
})();
