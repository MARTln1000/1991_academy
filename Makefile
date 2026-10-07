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

# make reads only the DOMAIN, PROXY and MEDIA_DIR lines of .env, so a password
# containing $ or # elsewhere in the file can't confuse it.
# (Spaces are trimmed only at the ends: a drive can be called "My Passport".)
env_value = $(shell sed -n 's/^$(1)=//p' .env 2>/dev/null | tail -n 1 | tr -d '\r"' | sed 's/^ *//; s/ *$$//')
DOMAIN := $(call env_value,DOMAIN)
PROXY  := $(call env_value,PROXY)
# Where the lesson videos are (README.md → "Lesson videos"): e.g. a USB drive.
MEDIA  := $(or $(call env_value,MEDIA_DIR),media)

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
.PHONY: password video media-upload help install dev test notebooks up down restart restart-caddy prune-images check-caddy refresh logs status shell release admin admin-remove admins update auto-update-on auto-update-off backup nightly-backup restore

help: ## list these commands
	@awk 'BEGIN {FS = ":.*## "} /^##@/ {printf "\n%s\n", substr($$0, 5)} /^[a-z][a-z-]*:.*## / {printf "  make %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo
	@echo "Docker commands currently target: $(WHERE), $(URL)  (DOMAIN in .env)"

##@ Run the site (Docker)

up: .env ## build and start the site in the background (again after code changes)
	@chmod 600 .env   # it may hold secrets: readable by its owner only
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
	@chmod 600 .env   # it may hold secrets
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
	git pull --ff-only && \
	if [ "$$old" != "$$(git rev-parse HEAD:deploy/Caddyfile)" ]; then $(MAKE) check-caddy || exit 1; fi && \
	$(MAKE) up && \
	if [ "$$old" != "$$(git rev-parse HEAD:deploy/Caddyfile)" ]; then $(MAKE) restart-caddy; fi
	@$(MAKE) prune-images

refresh: ## security updates: the newest Caddy and Python base images, rebuilt and restarted (auto-update-on does it weekly)
ifeq ($(SERVICES),)
	$(COMPOSE) pull --quiet caddy
endif
	$(COMPOSE) build --pull app
	$(MAKE) up
	@$(MAKE) prune-images

# Each rebuild leaves the previous image and a few hundred MB of build cache
# behind. Drop the images and cap the cache at 2 GB (enough for quick
# rebuilds), or a small server's disk fills up. The cap's option is
# --max-used-space from Docker 28, --keep-storage before. (Used by update,
# refresh and deploy/auto-update.sh.)
prune-images:
	docker image prune -f
	@docker builder prune -f --max-used-space 2gb 2>/dev/null \
	  || docker builder prune -f --keep-storage 2gb 2>/dev/null \
	  || docker builder prune -f --filter until=24h

# Is deploy/Caddyfile valid? Checked before Caddy restarts with a changed one:
# a broken one would take the site down. (Nothing to check without Caddy.)
check-caddy:
ifeq ($(SERVICES),)
	$(COMPOSE) run --rm --no-deps -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
endif

# The cron line carries a marker, so on/off find exactly this job of this checkout.
AUTO_UPDATE_MARK := \# 1991_academy auto-update $(CURDIR)

auto-update-on: ## on a server: install every new commit pushed to GitHub by itself (checks every 5 min; backup first, rollback if it fails), and security updates weekly
	@mkdir -p backups
	@line="*/5 * * * * cd '$(CURDIR)' && sh deploy/auto-update.sh >> backups/auto-update.log 2>&1 $(AUTO_UPDATE_MARK)"; \
	weekly="0 4 * * 0 cd '$(CURDIR)' && sh deploy/auto-update.sh --refresh >> backups/auto-update.log 2>&1 $(AUTO_UPDATE_MARK)"; \
	{ crontab -l 2>/dev/null | grep -vF "$(AUTO_UPDATE_MARK)" ; echo "$$line"; echo "$$weekly"; } | crontab - \
	  && echo "==> Automatic updates are on: this server follows '$$(git symbolic-ref --short HEAD)' on GitHub." \
	  && echo "    Every 5 minutes it checks for new commits, and every Sunday at 04:00 it installs" \
	  && echo "    security updates for Caddy and Python (make refresh). Log: backups/auto-update.log" \
	  && echo "    Stop with: make auto-update-off"

auto-update-off: ## stop the automatic updates ('make update' still updates by hand)
	@crontab -l 2>/dev/null | grep -vF "$(AUTO_UPDATE_MARK)" | crontab - ; \
	echo "==> Automatic updates are off. 'make update' installs new commits by hand."

##@ Admin panel

# NAME, not USER: make would quietly use your login name for an unset $(USER).
admin: ## make an account an admin: make admin NAME=<username> [EMAIL=… creates it, with a temporary password], then open /admin.html
	@test -n "$(NAME)" || { echo "usage: make admin NAME=<username> [EMAIL=<email>, if the account doesn't exist yet]"; exit 2; }
	$(COMPOSE) exec -T app python app.py admin add "$(NAME)" $(if $(EMAIL),"$(EMAIL)")

admin-remove: ## take the admin rights away again: make admin-remove NAME=<username>
	@test -n "$(NAME)" || { echo "usage: make admin-remove NAME=<username>"; exit 2; }
	$(COMPOSE) exec -T app python app.py admin remove "$(NAME)"

admins: ## list the admin accounts
	$(COMPOSE) exec -T app python app.py admin list

password: ## a new temporary password for an account (e.g. an admin who forgot theirs): make password NAME=<username>
	@test -n "$(NAME)" || { echo "usage: make password NAME=<username>"; exit 2; }
	$(COMPOSE) exec -T app python app.py password "$(NAME)"

##@ Lesson videos (README.md → "Lesson videos")

video: ## prepare a lecture for the site: make video SRC="Lecture 5.mp4" ID=<its YouTube id>  (into MEDIA_DIR, default media/; needs ffmpeg)
	@test -n "$(SRC)" && test -n "$(ID)" || { echo 'usage: make video SRC="Lecture 5.mp4" ID=<YouTube id>'; exit 2; }
	@sh tools/encode-video.sh "$(SRC)" "$(ID)" "$(MEDIA)"

media-upload: ## copy the videos (MEDIA_DIR, default media/) to a server: make media-upload TO=root@SERVER (resumes, only what's new)
	@test -n "$(TO)" || { echo "usage: make media-upload TO=root@SERVER  [DIR=folder on the server, default 1991_academy/media]"; exit 2; }
	@# --chmod: readable by the containers, whatever the files' modes are here
	rsync -av --partial --progress --exclude '.*' --chmod=D755,F644 "$(MEDIA)/" "$(TO):$(or $(DIR),1991_academy/media)/"

##@ Database (Docker)

backup: ## snapshot the database into backups/ (safe while the site is running)
	$(COMPOSE) exec -T app bash deploy/backup.sh
	@mkdir -p backups
	$(COMPOSE) cp app:/data/backups/. backups/
	@# keep the copies here as long as those in the volume (30 days), or
	@# nightly and per-update backups would slowly fill the disk
	@find backups -maxdepth 1 -name 'academy-*.db.gz' -mtime +30 -delete

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
