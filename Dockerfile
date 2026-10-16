# syntax=docker/dockerfile:1

# Normalize permissions (files readable, directories traversable) regardless of
# host modes. Done with chmod in a separate stage because BuildKit (<= 0.20)
# ignores the X bit in `COPY --chmod`.
FROM python:3.12-slim AS site
COPY . /app
RUN chmod -R u=rwX,go=rX /app

# Runtime image: app.py serves both the API and the static frontend. The SQLite
# database lives in /data (a named volume). See docs/deployment.md.
FROM python:3.12-slim

# sqlite3 CLI for online backups (deploy/backup.sh) and inspection.
RUN apt-get update \
 && apt-get install -y --no-install-recommends sqlite3 \
 && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore

# Unprivileged runtime user; owns /data only.
RUN groupadd --system --gid 10001 academy \
 && useradd --system --uid 10001 --gid 10001 --home-dir /data --shell /usr/sbin/nologin academy \
 && install -d -o academy -g academy -m 700 /data

WORKDIR /app
# Install dependencies first for layer caching.
COPY requirements.txt requirements.lock ./
RUN pip install -r requirements.txt -c requirements.lock

COPY --from=site /app /app

# Build revision (passed by the Makefile), reported by /api/health.
ARG REVISION=""
RUN printf '%s\n' "$REVISION" > REVISION

# Production defaults; see docs/deployment.md for the full configuration.
ENV ACADEMY_HOST=0.0.0.0 \
    PORT=8735 \
    ACADEMY_DB=/data/academy.db \
    ACADEMY_MEDIA=/media \
    ACADEMY_DEBUG=0

USER academy
EXPOSE 8735
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --start-interval=2s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8735/api/health', timeout=4)"]
CMD ["python", "app.py"]
