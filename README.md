# 1991 Academy

Online learning platform of 1991 Unit (1991 Ստորաբաժանում). It offers seven
course tracks with lessons, quizzes, coding exercises and progress tracking,
in English and Armenian. Access is restricted to enrolled students.

Contact: [ai.1991@mil.am](mailto:ai.1991@mil.am)

## Features

- **Tracks:** Mathematics for ML, Programming for ML, Web Development, Machine
  Learning, Deep Learning, Agentic AI, Algorithms and Data Structures.
- **Lessons** with embedded lecture videos, takeaways and quizzes.
- **Exercises:** in-page exercises (code ordering, fill-in-the-blank, matching,
  worked math problems) and Python exercises solved in Google Colab.
- **Missions and Lab:** cross-track projects and implement-from-scratch problems
  (algorithms, classical ML, neural networks).
- **Practice:** spaced repetition built from completed lessons' quizzes.
- **Progress:** XP, levels, daily goals, streaks, achievements and a weekly
  leaderboard, synchronised across devices.
- **Administration:** student onboarding through invitation links, progress
  overview, lesson editing, announcements and an audit log.
- **Bilingual UI and content** (English / Armenian).

## Tech stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.12, FastAPI, Uvicorn |
| Storage | SQLite (WAL mode) |
| Frontend | HTML, CSS and vanilla JavaScript, no build step |
| Deployment | Docker Compose, Caddy (automatic TLS) |
| CI | GitHub Actions: ruff, pytest, pip-audit, Docker smoke test |

## Quick start

Requirements: Python 3.12+ and `make`. Docker is optional for local use.

```bash
make install   # create .venv with runtime and dev dependencies
make dev       # http://localhost:8735
```

Create an administrator, then sign in with the printed temporary password:

```bash
.venv/bin/python app.py admin add <username> <email>
```

To run the production container stack locally instead: `make up` (requires
Docker), then `make admin NAME=<username> EMAIL=<email>`.

Run `make` to list all available targets.

## Documentation

| Document | Contents |
|----------|----------|
| [docs/deployment.md](docs/deployment.md) | Server requirements, installation, configuration, updates, backups, troubleshooting |
| [docs/administration.md](docs/administration.md) | Accounts, onboarding, admin panel, administration CLI |
| [docs/architecture.md](docs/architecture.md) | System design, data model, state sync, internationalization |
| [docs/security.md](docs/security.md) | Security controls and threat model |
| [docs/api.md](docs/api.md) | HTTP API reference |
| [docs/content.md](docs/content.md) | Authoring lessons, exercises, missions, videos and translations |

## Project structure

```
app.py                  Backend: API, authentication, admin, static file serving
index.html, *.html      Pages (dashboard, lab, missions, practice, account, admin, privacy)
tracks/                 One page per course track
css/                    Design tokens, base styles, components
js/                     Frontend modules
js/data/                Course content and Armenian translation packs
assets/courses/         Course materials (slides, homework, datasets)
assets/colab/           Generated Colab notebooks (en/, hy/)
deploy/                 Caddyfile, backup and auto-update scripts
tools/                  Notebook generator, release and video encoding scripts
tests/                  Test suite
docs/                   Documentation
```

## Development

```bash
make test        # run the test suite
make lint        # static analysis (ruff)
make notebooks   # regenerate Colab notebooks after changing exercises
```

Tests run against temporary databases and never touch local data. Coding
exercises are verified by executing every generated notebook with a reference
solution (`tests/content/solutions/`).

### Dependencies

`requirements.txt` declares runtime dependencies; `requirements.lock` pins the
exact versions used by CI and the Docker image. To update the lock file:

```bash
python3 -m venv /tmp/lockenv
/tmp/lockenv/bin/pip install -r requirements.txt   # add -c requirements.lock to keep current pins
{ grep '^#' requirements.lock; /tmp/lockenv/bin/pip freeze; } > requirements.lock.new && mv requirements.lock.new requirements.lock
make install test
```

### Release workflow

Work happens on a feature branch. `make release` runs the tests and then pushes
the branch to `dev` and `master` atomically. Servers deploy `master`
automatically (see [docs/deployment.md](docs/deployment.md#updates)).

## Credits

Course lectures, slides and homework are provided by FAST Foundation.
