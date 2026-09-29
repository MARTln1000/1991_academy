# DSA content and API contract

DSA content lives in `content/dsa/catalog.json` and `content/dsa/lessons/{id}.json`.
The FastAPI router is registered by `app.include_router(build_dsa_router())` before
static-file routing. It adds no database tables: learner state uses the existing
account-scoped `/api/state` sync mechanism. Completion and mastery are distinct
fields in the DSA state document.

## Publishing content

Catalog `topics` define stable IDs, prerequisites, aliases, category and readiness.
`resources` and `paths` are reusable catalog collections. Detailed lessons carry
sections, language implementations, quizzes, problems, resource IDs and trace
metadata. Lesson JSON filenames must match their IDs and each ID must name a topic.
Only mark a topic `published` when its corresponding lesson is available. Aliases name
one canonical topic; Fenwick Tree and Binary Indexed Tree must not become separate
learning records. Preserve ambiguous terminology as pending curation.

The API validates the entire revision on first request and caches it until restart.
Publish catalog and lesson files together, validate them in tests, then restart the
server. Invalid IDs, duplicate IDs/aliases, missing prerequisites, cycles and broken
lesson resource references return a redacted HTTP 503. Missing lessons return 404.
Failed validation is not cached, so corrected files can be retried. Content files
are trusted authored data, not uploads or a runtime code-execution mechanism.

## Endpoints

- `GET /api/dsa/catalog`: topic/navigation metadata and resource/path catalogs.
- `GET /api/dsa/lessons/{id}`: a detailed lesson, loaded by route when needed.
- `GET /api/dsa/resources`: `q`, `topic`, `type`, `difficulty`, `language`, `limit`, `offset`.
- `GET /api/dsa/problems`: `topic`, `lesson`, `limit`, `offset`; includes problems embedded in lessons.
- `POST /api/dsa/tutor`: explicit learner request for a context-aware tutor response.

Pagination returns `{items, total, limit, offset}`. Limits range from 1 to 100
(default 20), offsets are nonnegative. Filter values match authored metadata.
Resource search is case-insensitive. Topic matching uses canonical IDs.

Tutor requests use `{lessonId, question, mode, context}`. Modes are `explain`,
`socratic`, `hint`, `exam`. Context accepts `frame` (snapshot object or index),
`code`, `error`, `problem` (ID), `attempts` (count), `hints` (already used count),
`mastery` (dimension-to-percentage map), and `selectedObject`. Unknown fields and
oversized context are rejected. The server never executes learner code. Responses
include `answer`, `provider`, `mode`, `lessonId` and a provider disclosure `notice`.

Without configuration, `provider: guided` is a deterministic lesson guide. It
retrieves relevant lesson prose, offers authored progressive hints, and asks
reflection questions. It must not be presented as a language model or code debugger.

## Optional model tutor

Configure an administrator-controlled chat-completions-compatible endpoint:

- `ACADEMY_TUTOR_URL`: full HTTPS endpoint URL (loopback HTTP also allowed).
- `ACADEMY_TUTOR_MODEL`: provider's model identifier.
- `ACADEMY_TUTOR_KEY`: optional bearer credential, stored server-side only.

Both URL and model must be present. Lesson loading and navigation never contact
the provider. Only a learner's explicit tutor POST sends question, mode, selected
lesson excerpt and bounded execution/code context. Disclose that transfer beside
the Ask button. Exam/hint requests omit lesson excerpts to avoid sending solution
material; the system instruction asks for questions or progressive hints. Like any
model instruction, it cannot guarantee the provider never reveals an answer.

Provider requests have a 20-second timeout and a 128KB response limit. Redirects
are rejected to protect credentials. Upstream failures return a redacted 502;
there is no silent fallback that could disguise a failed model call. The app requires a signed-in account for configured model calls and applies a per-IP request limit. Deployments exposing a paid provider should also configure provider spending caps or per-account quotas. Never commit API keys to the catalog.

## Testing

Run `.venv/bin/pytest -q tests/test_dsa_api.py`. Tests use temporary content and
mock provider calls; they need neither a model credential nor outbound access.
