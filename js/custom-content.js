/* ============================================
   1991 Academy — content from the admin panel
   api/content.js (loaded just before this file)
   sets window.ACADEMY_CUSTOM: the published
   lessons and the active announcements. This
   file merges the lessons into the track data,
   so load it AFTER the data files and the
   Armenian packs, and BEFORE the page's own
   script. Every page loads it, for the banner.
   The admin panel reuses CustomContent to show
   lessons the way learners see them.
   ============================================ */

const CustomContent = (() => {
  const FIELDS = ["title", "title_hy", "minutes", "content", "content_hy", "takeaways", "takeaways_hy", "quiz", "videos"];

  /* A blank Armenian field falls back to English, as if it weren't there. */
  function dropBlankHy(obj) {
    for (const k of Object.keys(obj)) {
      if (!k.endsWith("_hy")) continue;
      const v = obj[k];
      if (v == null || v === "" || (Array.isArray(v) && !v.length)) delete obj[k];
    }
    return obj;
  }

  /* An id that matches a built-in lesson replaces its text; its materials
     and exercises stay. Any other id is a new lesson, placed in its module
     after `after` (or at the end). */
  function applyLesson(tracks, rec) {
    const track = tracks[rec.track];
    if (!track) return false;
    const fields = {};
    for (const k of FIELDS) if (rec.data[k] !== undefined) fields[k] = rec.data[k];
    fields.quiz = (fields.quiz || []).map((q) => dropBlankHy({ ...q }));
    for (const mod of track.modules) {
      const lesson = mod.lessons.find((l) => l.id === rec.id);
      if (lesson) {
        for (const k of FIELDS) delete lesson[k];
        Object.assign(lesson, dropBlankHy(fields));
        return true;
      }
    }
    const mod = track.modules.find((m) => m.id === rec.module);
    if (!mod) return false;
    const lesson = dropBlankHy({ id: rec.id, ...fields });
    const at = rec.after ? mod.lessons.findIndex((l) => l.id === rec.after) : -1;
    if (at >= 0) mod.lessons.splice(at + 1, 0, lesson);
    else mod.lessons.push(lesson);
    return true;
  }

  /* Returns the records that found no place (unknown track or module). */
  function applyLessons(tracks, records) {
    const unplaced = [];
    for (const rec of records) {
      try {
        if (!applyLesson(tracks, rec)) unplaced.push(rec);
      } catch (e) {
        console.warn("Lesson " + rec.id + " from the admin panel could not be added", e);
        unplaced.push(rec);
      }
    }
    return unplaced;
  }

  /* ---------- Announcements ----------
     A banner under the navigation bar. Plain text only. A learner who
     closes one doesn't see it again on this device. */
  const DISMISSED_KEY = "1991_academy:announcements-dismissed";

  function dismissed() {
    try {
      const v = JSON.parse(localStorage.getItem(DISMISSED_KEY));
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  function showAnnouncements(list) {
    const shown = list.filter((a) => !dismissed().includes(a.id));
    if (!shown.length) return;
    const box = document.createElement("div");
    box.className = "announcements";
    for (const a of shown) {
      const el = document.createElement("div");
      el.className = "announcement" + (a.level === "warning" ? " announcement-warning" : "");
      el.setAttribute("role", "status");
      const row = document.createElement("div");
      row.className = "container announcement-row";
      const text = document.createElement("p");
      text.textContent = (a.level === "warning" ? "⚠️ " : "📣 ") + L(dropBlankHy({ ...a }), "text");
      const close = document.createElement("button");
      close.className = "announcement-close";
      close.type = "button";
      close.textContent = "×";
      close.setAttribute("aria-label", t("Dismiss"));
      close.addEventListener("click", () => {
        try {
          localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed().concat(a.id).slice(-50)));
        } catch { /* storage full or blocked: it just shows again next time */ }
        el.remove();
      });
      row.append(text, close);
      el.appendChild(row);
      box.appendChild(el);
    }
    const nav = document.querySelector(".nav");
    if (nav) nav.after(box);
    else document.body.prepend(box);
  }

  return { applyLessons, dropBlankHy, showAnnouncements };
})();

(function () {
  const C = window.ACADEMY_CUSTOM;
  if (!C) return; /* no server behind this page (static copy, file://), or the admin panel */
  const M = window.ACADEMY_1991;
  if (M && M.tracks) CustomContent.applyLessons(M.tracks, C.lessons || []);
  CustomContent.showAnnouncements(C.announcements || []);
})();
