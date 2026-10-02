/* Prints, as JSON, every coding exercise on the site, for
   tools/build_notebooks.py (which turns each one into a Google Colab
   notebook) and the tests. Loads the site's own js/data files the way the
   pages do, so the notebooks always match what the site shows:

     node tools/site_data.js

   {
     "lab":      [{id, track, title, title_hy, brief, brief_hy, hints, hints_hy, viz,
                   fnName, starter, tests}]                (Python)
     "missions": [same shape],
     "lessons":  [{id, lessonId, index, trackId, title, title_hy, prompt, prompt_hy,
                   source, fnName, starter, tests}]      (Python exercises in lessons)
   }

   Plain Node, no packages (it has to run on old Node versions too). */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DATA = path.join(__dirname, "..", "js", "data");
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);

/* Content packs augment earlier files, so load in dependency order: base
   tracks first, then the course rebuilds, then the Armenian packs. */
const files = fs.readdirSync(DATA).filter((f) => f.endsWith(".js"));
const rank = (f) => (f.startsWith("i18n-hy-") ? 3 : f === "i18n-hy.js" ? 2 : /-(course|exercises(-2)?)\.js$/.test(f) ? 1 : 0);
let pending = files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
for (let round = 0; round < 5 && pending.length; round++) {
  const failed = [];
  for (const f of pending) {
    try {
      vm.runInContext(fs.readFileSync(path.join(DATA, f), "utf8"), ctx, { filename: f });
    } catch (err) {
      failed.push(f);
      if (round === 4) throw new Error(f + ": " + err.message);
    }
  }
  pending = failed;
}

const A = ctx.window.ACADEMY_1991;
const pick = (obj, keys) => {
  const out = {};
  if (!obj) return null;
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
};
const FIELDS = ["id", "track", "title", "title_hy", "blurb", "blurb_hy", "brief", "brief_hy", "hints", "hints_hy", "viz",
                "tracks", "fnName", "starter", "tests"];
const problem = (p) => pick(p, FIELDS);

const lessons = [];
for (const trackId of Object.keys(A.tracks)) {
  for (const mod of A.tracks[trackId].modules) {
    for (const lesson of mod.lessons) {
      (lesson.exercises || []).forEach((ex, index) => {
        if (ex.type !== "code") return;
        lessons.push(Object.assign(
          { id: lesson.id + "-ex" + (index + 1), lessonId: lesson.id, index, trackId,
            lessonTitle: lesson.title, lessonTitle_hy: lesson.title_hy },
          pick(ex, ["title", "title_hy", "prompt", "prompt_hy", "source", "fnName", "starter", "tests"])
        ));
      });
    }
  }
}

process.stdout.write(JSON.stringify({ lab: A.lab.map(problem), missions: A.missions.map(problem), lessons }));
