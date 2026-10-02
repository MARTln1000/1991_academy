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
.PHONY: help install dev test notebooks up down restart restart-caddy prune-images logs status shell release admin admin-remove admins update auto-update-on auto-update-off backup nightly-backup restore

help: ## list these commands
	@awk 'BEGIN {FS = ":.*## "} /^##@/ {printf "\n%s\n", substr($$0, 5)} /^[a-z][a-z-]*:.*## / {printf "  make %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo
	@echo "Docker commands currently target: $(WHERE), $(URL)  (DOMAIN in .env)"

##@ Run the site (Docker)

up: .env ## build and start the site in the background (again after code changes)
	@# --remove-orphans: containers of services no longer in docker-compose.yml go too
	$(COMPOSE) up -d --build --wait --remove-orphans $(SERVICES)
	@echo
	@echo "==> 1991 Academy is running on $(WHERE): $(URL)"
ifeq ($(DOMAIN),)
	@echo "    It keeps running in the background until 'make down'."
	@echo "    To publish it on a server, set DOMAIN in .env there (README.md → Run with Docker)."
endif

.env:
	cp .env.example .env
	@echo "==> Created .env from .env.example."

down: ## stop the site (the database is kept)
	$(COMPOSE) down

# Caddy reads deploy/Caddyfile only when it starts: restart it (a few seconds;
# the certificates are kept) when an update changed that file. (Used by update
# and deploy/auto-update.sh; nothing to do without Caddy.)
restart-caddy:
ifeq ($(SERVICES),)
	@echo "==> deploy/Caddyfile changed: restarting Caddy"
	$(COMPOSE) restart caddy
endif

restart: ## restart the site, e.g. after editing .env
	$(COMPOSE) up -d --wait --force-recreate $(SERVICES)

logs: ## follow the log: requests, sign-ins, errors (Ctrl-C to stop watching)
	$(COMPOSE) logs -f --tail=100

status: ## is it running, and which version
	$(COMPOSE) ps
	@curl -fsS http://127.0.0.1:8735/api/health && echo || echo "The app is not answering on 127.0.0.1:8735."
	@echo "Site: $(URL)"
	@if crontab -l 2>/dev/null | grep -qF "$(AUTO_UPDATE_MARK)"; then \
	  echo "Automatic updates: on, following '$$(git symbolic-ref --short HEAD 2>/dev/null || echo '?')'. Latest:"; \
	  tail -n 3 backups/auto-update.log 2>/dev/null | sed 's/^/  /' || true; \
	else echo "Automatic updates: off (make auto-update-on)"; fi

shell: ## open a shell inside the app container (sqlite3 /data/academy.db opens the database)
	$(COMPOSE) exec app bash

##@ Updating the site

release: ## publish your work: run the tests, then push your branch to GitHub's dev and master (servers follow master)
	@sh tools/release.sh

update: ## on a server: pull the latest code from git, rebuild and restart
	@old=$$(git rev-parse HEAD:deploy/Caddyfile 2>/dev/null); \
	git pull --ff-only && $(MAKE) up && \
	if [ "$$old" != "$$(git rev-parse HEAD:deploy/Caddyfile)" ]; then $(MAKE) restart-caddy; fi
	@$(MAKE) prune-images

# Each rebuild leaves the previous image behind; drop the unused ones so a
# small server's disk doesn't slowly fill up. (Used by update and auto-update.sh.)
prune-images:
	docker image prune -f

# The cron line carries a marker, so on/off find exactly this job of this checkout.
AUTO_UPDATE_MARK := \# 1991_academy auto-update $(CURDIR)

auto-update-on: ## on a server: install every new commit pushed to GitHub by itself (checks every 5 min; backup first, rollback if it fails)
	@mkdir -p backups
	@line="*/5 * * * * cd '$(CURDIR)' && sh deploy/auto-update.sh >> backups/auto-update.log 2>&1 $(AUTO_UPDATE_MARK)"; \
	{ crontab -l 2>/dev/null | grep -vF "$(AUTO_UPDATE_MARK)" ; echo "$$line"; } | crontab - \
	  && echo "==> Automatic updates are on: this server follows '$$(git symbolic-ref --short HEAD)' on GitHub." \
	  && echo "    Every 5 minutes it checks for new commits; the log is backups/auto-update.log." \
	  && echo "    Stop with: make auto-update-off"

auto-update-off: ## stop the automatic updates ('make update' still updates by hand)
	@crontab -l 2>/dev/null | grep -vF "$(AUTO_UPDATE_MARK)" | crontab - ; \
	echo "==> Automatic updates are off. 'make update' installs new commits by hand."

##@ Admin panel

# NAME, not USER: make would quietly use your login name for an unset $(USER).
admin: ## make an account an admin: make admin NAME=<username>, then sign in and open /admin.html
	@test -n "$(NAME)" || { echo "usage: make admin NAME=<username>  (the account must exist on the site)"; exit 2; }
	$(COMPOSE) exec -T app python app.py admin add "$(NAME)"

admin-remove: ## take the admin rights away again: make admin-remove NAME=<username>
	@test -n "$(NAME)" || { echo "usage: make admin-remove NAME=<username>"; exit 2; }
	$(COMPOSE) exec -T app python app.py admin remove "$(NAME)"

admins: ## list the admin accounts
	$(COMPOSE) exec -T app python app.py admin list

##@ Database (Docker)

backup: ## snapshot the database into backups/ (safe while the site is running)
	$(COMPOSE) exec -T app bash deploy/backup.sh
	@mkdir -p backups
	$(COMPOSE) cp app:/data/backups/. backups/

nightly-backup: ## on a server: add a cron job that runs 'make backup' every night at 03:30
	@line="30 3 * * * cd '$(CURDIR)' && mkdir -p backups && make backup >> backups/cron.log 2>&1"; \
	{ crontab -l 2>/dev/null | grep -vF "cd '$(CURDIR)' && mkdir -p backups && make backup" ; echo "$$line"; } | crontab - \
	  && echo "==> Nightly backup scheduled (see: crontab -l):" && echo "    $$line"

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

test: $(VENV) ## run the tests (the API, and every Colab notebook)
	$(PYTHON) -m pytest -q

notebooks: ## rebuild the Google Colab notebooks after changing an exercise in js/data/ (needs Node.js)
	python3 tools/build_notebooks.py

# Reinstalls whenever a requirements file changes.
$(VENV): requirements.txt requirements-dev.txt requirements.lock
	[ -x $(PYTHON) ] || python3 -m venv .venv
	$(PYTHON) -m pip install -q -r requirements-dev.txt -c requirements.lock
	touch $@
