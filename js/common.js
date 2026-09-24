/* ============================================
   1991 Academy — Common
   Namespace, theme toggle, toast, store
   invalidation, helpers.
   Loaded first on every page.
   ============================================ */

window.MARTINIUM = window.MARTINIUM || { tracks: {}, order: [] };

const M = window.MARTINIUM;

/* ---------- Theme ---------- */
const THEME_KEY = "martinium:theme";

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

     martinium:store-invalidate → caches drop, no re-render
     martinium:state-changed    → page controllers re-render

   `notifyStateChanged()` fires both, in that order. */

function invalidateStores() {
  document.dispatchEvent(new CustomEvent("martinium:store-invalidate"));
}

function notifyStateChanged() {
  invalidateStores();
  document.dispatchEvent(new CustomEvent("martinium:state-changed"));
}

/* Page controllers call this instead of wiring the listener by hand. */
function onStateChanged(handler) {
  document.addEventListener("martinium:state-changed", handler);
}

/* Another tab wrote our keys — adopt its view. Debounced because a sync pull
   rewrites every key in a burst and each one fires its own storage event. */
(function watchOtherTabs() {
  let timer = null;
  window.addEventListener("storage", (e) => {
    if (e.key && !e.key.startsWith("martinium:")) return;
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
