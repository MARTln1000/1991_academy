# Content authoring

Course content lives in `js/data/` as JavaScript data. Lessons can also be
added or edited in the admin panel without a code change (see
[administration.md](administration.md)); this document covers content shipped
with the code.

After changing coding exercises, missions or Lab problems, run
`make notebooks` and `make test`.

## Lessons

Add an object to a module's `lessons` array in the track file
(`js/data/<track>.js`):

```js
{
  id: "web-2-4",              // <track>-<module>-<n>; used for progress and deep links
  title: "New lesson",
  minutes: 10,
  content: `<p>HTML content</p>`,
  takeaways: ["..."],
  quiz: [
    { q: "Question?", options: ["A", "B", "C", "D"], answer: 1, explain: "..." },
  ],
  videos: [ /* see below */ ],
  exercises: [ /* see below */ ],
  materials: [{ label: "Slides (PDF)", href: "../assets/courses/..." }],
}
```

Navigation, progress tracking and the quiz are derived automatically. Lesson
ids that are prerequisites of missions must remain stable.

## Videos

```js
videos: [
  { id: "aircAruvnKk", title: "But what is a neural network?", channel: "3Blue1Brown", length: "19 min" },
]
```

Videos render as click-to-play `youtube-nocookie.com` embeds. No API key is
needed.

### Lecture videos

A lecture can be self-hosted so it does not depend on YouTube. Lessons with a
hosted copy play it; others continue to use YouTube.

1. Encode (requires ffmpeg):
   ```bash
   make video SRC="Lecture 05 - CNNs.mp4" ID=<youtube-id>
   ```
   Produces `<id>.mp4` (H.264/AAC, up to 720p, about 400-700 MB per hour) and a
   `<id>.jpg` poster in `MEDIA_DIR` (default `media/`). The id is the lesson's
   YouTube id; the admin panel lists them under Lessons.
2. Upload: `make media-upload TO=root@SERVER`. Only new files are transferred;
   no restart is needed.
3. Verify in the admin panel (Lessons → Lesson videos).

`MEDIA_DIR` may point to external storage (e.g. a USB drive locally, a larger
volume on the server). Media files are not stored in git, the image or
backups. Only FAST Foundation lectures with their permission should be
hosted; other channels remain YouTube embeds.

## Exercises

Add an `exercises` array to a lesson:

```js
{ type: "order",   title, prompt, lines: ["line 1", "line 2"] }               // Parsons problem
{ type: "blanks",  title, prompt, code: "a {{0}} b", blanks: [{ options, answer }] }
{ type: "match",   title, prompt, pairs: [["left", "right"]] }
{ type: "problem", title, prompt, source, statement, solution }               // worked math problem
{ type: "code",    title, prompt, source, fnName, starter, tests }            // Python, solved in Colab
```

- `problem`: `statement` and `solution` are HTML with `\( \)` / `\[ \]` LaTeX,
  rendered by KaTeX on the math track. Author with `String.raw`.
- `code`: solved in a generated Colab notebook (`<lesson-id>-ex<n>.ipynb`).
  `tests` is a Python script calling `__check(name, actual, expected)`. The
  track page must include `js/colab.js`. Add a reference solution to
  `tests/content/solutions/` so the test suite can verify the exercise.

## Missions

Append to `js/data/missions.js`: `id`, `title`, `icon`, `tracks`, `prereqs`
(lesson ids that unlock it), `xp`, `blurb`, `brief` (HTML), `fnName`,
`starter`, `tests` and `hints`. Add a reference solution as
`tests/content/solutions/<id>.py`, then run `make notebooks` and `make test`.
The test suite checks that the solution passes and the starter code does not.

Lab problems (`js/data/lab.js`) follow the same structure, with an optional
plot configuration.

## Course materials

Slides, homework and datasets are stored under `assets/courses/` and linked
from lessons through `materials`. They are served only to signed-in users.
Notebooks added here must not contain Colab `executionInfo` metadata; the test
suite rejects it.

## Translations

The UI and all content are available in Armenian.

- **UI strings:** add the English string as a key with its Armenian value in
  `js/i18n.js` (or `js/i18n-admin.js` for the admin panel). The test suite
  fails if a string used by the account page or admin panel has no
  translation.
- **Content:** add `_hy` fields next to the English ones (`title_hy`,
  `content_hy`, `takeaways_hy`, quiz `q_hy` / `options_hy` / `explain_hy`,
  exercise `prompt_hy`, mission and Lab `brief_hy` / `hints_hy`), either in the
  data file or in the track's pack `js/data/i18n-hy-<track>.js`. Packs must load
  after their data file.
- **Notebooks:** generated in both languages from the same fields
  (`make notebooks`).

Code, starter code and test names remain in English. Empty Armenian fields fall
back to English.
