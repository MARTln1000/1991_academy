/**
 * Applies admin-managed content from /api/content.js (window.ACADEMY_CUSTOM):
 * published lessons, announcements and self-hosted video URLs.
 *
 * Load after the track data and Armenian packs, before the page script.
 * Also used by the admin panel for previews.
 */

const CustomContent = (() => {
  const FIELDS = ["title", "title_hy", "minutes", "content", "content_hy", "takeaways", "takeaways_hy", "quiz", "videos"];

  /* Empty Armenian fields fall back to English. */
  function dropBlankHy(obj) {
    for (const k of Object.keys(obj)) {
      if (!k.endsWith("_hy")) continue;
      const v = obj[k];
      if (v == null || v === "" || (Array.isArray(v) && !v.length)) delete obj[k];
    }
    return obj;
  }

  /* Ids matching a built-in lesson override its text (materials and exercises
     are kept); other ids are inserted after `after`, or appended. */
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

  /* Returns records that could not be placed (unknown track or module). */
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

  /* Prefer self-hosted copies of lesson videos when available. */
  function applyMedia(tracks, media) {
    for (const track of Object.values(tracks))
      for (const mod of track.modules)
        for (const lesson of mod.lessons)
          for (const v of lesson.videos || []) {
            const hosted = media[v.id];
            if (hosted) {
              v.file = hosted.video;
              v.poster = hosted.poster || null;
            }
          }
  }

  /* ---------- Announcements ----------
     Plain-text banner below the navigation; dismissal is remembered per device. */
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
        } catch { /* storage unavailable: the banner shows again */ }
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

  return { applyLessons, applyMedia, dropBlankHy, showAnnouncements };
})();

(function () {
  const C = window.ACADEMY_CUSTOM;
  if (!C) return; /* no backend (static copy) */
  const M = window.ACADEMY_1991;
  if (M && M.tracks) {
    CustomContent.applyLessons(M.tracks, C.lessons || []);
    CustomContent.applyMedia(M.tracks, C.media || {});
  }
  CustomContent.showAnnouncements(C.announcements || []);
})();
