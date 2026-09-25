# syntax=docker/dockerfile:1
# The whole of 1991 Academy in one image: app.py serves the API *and* the
# frontend (the HTML/CSS/JS files next to it), and the database is a SQLite
# file the app creates on first start. There is no separate frontend or
# database server to run.
#
# The database lives in /data, which docker-compose.yml mounts as a named
# volume so it survives rebuilds. Build and run it with `make up`, on a server
# or on your own computer; README.md → "Run with Docker".
FROM python:3.12-slim

# sqlite3: the CLI deploy/backup.sh uses for consistent online backups (and
# handy for inspecting the database from `make shell`).
RUN apt-get update \
 && apt-get install -y --no-install-recommends sqlite3 \
 && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore

# The app runs as `academy`, which owns /data and can't write the code.
RUN useradd --system --uid 10001 --user-group --home-dir /data --shell /usr/sbin/nologin academy \
 && install -d -o academy -g academy -m 700 /data

WORKDIR /app
# Dependencies first, so a code change doesn't reinstall them.
COPY requirements.txt requirements.lock ./
RUN pip install -r requirements.txt -c requirements.lock

# The folder as it is on disk, uncommitted changes included, minus everything
# .dockerignore excludes (the local database, .venv, .env, docs, tests, the
# systemd deploy files). COPY keeps the host's permissions, and on the Mac the
# course folders under assets/ are owner-only (drwx------), which the academy
# user couldn't read. --chmod makes everything world-readable (X: directories
# searchable), whatever machine builds the image.
COPY --chmod=u=rwX,go=rX . .

# The commit this image was built from (the Makefile passes it). /api/health
# reports it, so you can see which version is live. Empty = "dev".
ARG REVISION=""
RUN printf '%s\n' "$REVISION" > REVISION

# Production settings. docker-compose.yml sets the rest (proxy trust); none of
# these should change on a public server. DEPLOYMENT.md §1 explains each one.
ENV ACADEMY_HOST=0.0.0.0 \
    PORT=8735 \
    ACADEMY_DB=/data/academy.db \
    ACADEMY_DEBUG=0 \
    ACADEMY_CPP=0

USER academy
EXPOSE 8735
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --start-interval=2s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8735/api/health', timeout=4)"]
CMD ["python", "app.py"]
