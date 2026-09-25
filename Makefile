# 1991 Academy: common commands. Run `make` on its own to list them.
#
# There is one program to run: app.py serves the API *and* the frontend (the
# HTML/CSS/JS files), and the database is a SQLite file it creates on first
# start. README.md → "Run with Docker" has the full walkthrough.
#
# DOMAIN in .env decides where the Docker commands run the site:
#   empty (the default)  this computer: http://localhost:8735, no HTTPS
#   academy.example.com  a server: https://academy.example.com via Caddy
# Every command below works the same way in both.

PYTHON := .venv/bin/python
VENV   := .venv/.installed

# make reads only the DOMAIN and PROXY lines of .env, so an SMTP password
# containing $ or # elsewhere in the file can't confuse it.
env_value = $(shell sed -n 's/^$(1)=//p' .env 2>/dev/null | tail -n 1 | tr -d '\r" ')
DOMAIN := $(call env_value,DOMAIN)
PROXY  := $(call env_value,PROXY)

ifeq ($(DOMAIN),)
  WHERE    := this computer
  URL      := http://localhost:8735
  COMPOSE  := docker compose -f docker-compose.yml -f docker-compose.local.yml
  SERVICES := app
else
  WHERE    := server
  URL      := https://$(DOMAIN)
  COMPOSE  := docker compose
  ifeq ($(PROXY),external)
    # the server's own web server (nginx, Apache...) handles HTTPS: no Caddy
    SERVICES := app
  else
    SERVICES :=
  endif
endif

# The commit being built, with "-dirty" if tracked files have uncommitted
# changes. Baked into the image; /api/health reports it as "revision".
export REVISION := $(shell sha=$$(git rev-parse HEAD 2>/dev/null) && { git diff --quiet HEAD 2>/dev/null && echo $$sha || echo $$sha-dirty; })

.DEFAULT_GOAL := help
.PHONY: help install dev test up down restart logs status shell update backup restore

help: ## list these commands
	@awk 'BEGIN {FS = ":.*## "} /^##@/ {printf "\n%s\n", substr($$0, 5)} /^[a-z][a-z-]*:.*## / {printf "  make %-8s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo
	@echo "Docker commands currently target: $(WHERE), $(URL)  (DOMAIN in .env)"

##@ Run the site (Docker)

up: .env ## build and start the site in the background (again after code changes)
	$(COMPOSE) up -d --build --wait $(SERVICES)
	@echo
	@echo "==> 1991 Academy is running on $(WHERE): $(URL)"
ifeq ($(DOMAIN),)
	@echo "    It keeps running in the background until 'make down'."
	@echo "    To publish it on a server, set DOMAIN in .env there (README.md → Run with Docker)."
endif

down: ## stop the site (the database is kept)
	$(COMPOSE) down

restart: ## restart the site, e.g. after editing .env
	$(COMPOSE) up -d --wait --force-recreate $(SERVICES)

logs: ## follow the log: requests, sign-ins, errors (Ctrl-C to stop watching)
	$(COMPOSE) logs -f --tail=100

status: ## is it running, and which version
	$(COMPOSE) ps
	@curl -fsS http://127.0.0.1:8735/api/health && echo || echo "The app is not answering on 127.0.0.1:8735."
	@echo "Site: $(URL)"

shell: ## open a shell inside the app container (sqlite3 /data/academy.db opens the database)
	$(COMPOSE) exec app bash

update: ## on a server: pull the latest code from git, rebuild and restart
	git pull --ff-only
	$(MAKE) up
	@# Each rebuild leaves the previous image behind; drop the unused ones so a
	@# small server's disk doesn't slowly fill up.
	docker image prune -f

.env:
	cp .env.example .env
	@echo "==> Created .env from .env.example."

##@ Database (Docker)

backup: ## snapshot the database into backups/ (safe while the site is running)
	$(COMPOSE) exec -T app bash deploy/backup.sh
	@mkdir -p backups
	$(COMPOSE) cp app:/data/backups/. backups/

restore: ## put a backup back: make restore FILE=backups/academy-<time>.db.gz
	@[ -n "$(FILE)" ] || { echo "usage: make restore FILE=backups/academy-<time>.db.gz"; exit 1; }
	gzip -t "$(FILE)"
	$(COMPOSE) stop app
	@echo "==> Snapshotting the current database first, just in case"
	$(COMPOSE) run --rm -T --no-deps app bash deploy/backup.sh \
	  || { $(COMPOSE) start app; echo "That backup failed, so nothing was restored."; exit 1; }
	gunzip -c "$(FILE)" | $(COMPOSE) run --rm -T --no-deps app sh -c 'rm -f /data/academy.db-wal /data/academy.db-shm && cat > /data/academy.db'
	$(COMPOSE) up -d --wait app
	@echo "==> Restored $(FILE)"

##@ Develop without Docker

install: $(VENV) ## create .venv and install the dependencies and test tools

dev: $(VENV) ## run app.py directly in dev mode at http://localhost:8735 (stop 'make up' first)
	$(PYTHON) app.py

test: $(VENV) ## run the API tests
	$(PYTHON) -m pytest -q

# Reinstalls whenever a requirements file changes.
$(VENV): requirements.txt requirements-dev.txt requirements.lock
	[ -x $(PYTHON) ] || python3 -m venv .venv
	$(PYTHON) -m pip install -q -r requirements-dev.txt -c requirements.lock
	touch $@
