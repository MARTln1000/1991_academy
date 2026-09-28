/* For tests/test_content.py: loads the site's own Lab and Missions data and
   its own js/runner.js, exactly as the browser does (in Node, with a stub
   window), then either
     node tests/content/problems.js dump      prints every problem, and the
                                              Python driver the site runs
     node tests/content/problems.js run-js    runs the JSON list of
                                              {code, tests} jobs on stdin with
                                              the site's JavaScript runner */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "..");
const DATA = ["lab.js", "lab-py.js", "lab-cpp.js", "missions.js", "missions-py.js", "missions-cpp.js"];

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const file of DATA) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "data", file), "utf8"), ctx, { filename: file });
}
vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "runner.js"), "utf8") + "\n;window.Runner = Runner;", ctx, { filename: "runner.js" });

const pick = (v, keys) => (v ? Object.fromEntries(keys.filter((k) => v[k] !== undefined).map((k) => [k, v[k]])) : null);
const VARIANT = ["fnName", "starter", "tests", "prelude", "hint", "hint_hy"];

if (process.argv[2] === "dump") {
  const A = ctx.window.ACADEMY_1991;
  const items = [...A.lab.map((p) => ["lab", p]), ...A.missions.map((m) => ["mission", m])].map(([kind, p]) => ({
    id: p.id,
    kind,
    javascript: pick(p, VARIANT),
    python: pick(p.py, VARIANT),
    cpp: pick(p.cpp, VARIANT),
  }));
  process.stdout.write(JSON.stringify({ items, pyDriver: ctx.window.Runner._pyDriver }));
} else if (process.argv[2] === "run-js") {
  const jobs = JSON.parse(fs.readFileSync(0, "utf8"));
  const run = ctx.window.Runner._academyRunJS;
  process.stdout.write(JSON.stringify(jobs.map((job) => run({ mode: "tests", code: job.code, tests: job.tests }))));
} else {
  process.stderr.write("usage: node tests/content/problems.js dump|run-js\n");
  process.exit(2);
}
