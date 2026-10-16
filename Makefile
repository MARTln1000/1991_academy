# Development and operations tasks. Run `make` to list them.
#
# DOMAIN in .env selects the Docker target:
#   empty                local: http://localhost:8735 (docker-compose.local.yml)
#   academy.example.com  server: https://academy.example.com behind Caddy

PYTHON := .venv/bin/python
VENV   := .venv/.installed

# Read single keys from .env without sourcing it (values may contain $ or #).
env_value = $(shell sed -n 's/^$(1)=//p' .env 2>/dev/null | tail -n 1 | tr -d '\r"' | sed 's/^ *//; s/ *$$//')
DOMAIN := $(call env_value,DOMAIN)
PROXY  := $(call env_value,PROXY)
# Self-hosted video directory (docs/content.md).
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
    # an existing web server terminates TLS; Caddy is not started
    SERVICES := app
  else
    SERVICES :=
  endif
endif

# Build revision ("-dirty" with uncommitted changes), reported by /api/health.
export REVISION := $(shell sha=$$(git rev-parse HEAD 2>/dev/null) && { git diff --quiet HEAD 2>/dev/null && echo $$sha || echo $$sha-dirty; })

.DEFAULT_GOAL := help
.PHONY: lint disposable-list password video media-upload help install dev test notebooks up down restart restart-caddy prune-images check-caddy refresh logs status shell release admin admin-remove admins update auto-update-on auto-update-off backup nightly-backup restore

help: ## list available targets
	@awk 'BEGIN {FS = ":.*## "} /^##@/ {printf "\n%s\n", substr($$0, 5)} /^[a-z][a-z-]*:.*## / {printf "  make %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo
	@echo "Docker commands currently target: $(WHERE), $(URL)  (DOMAIN in .env)"

##@ Docker

up: .env ## build and start the stack in the background
	@chmod 600 .env
	$(COMPOSE) up -d --build --wait --remove-orphans $(SERVICES)
	@echo
	@echo "==> 1991 Academy is running on $(WHERE): $(URL)"
ifeq ($(DOMAIN),)
	@echo "    Stop with 'make down'. For server deployment see docs/deployment.md."
endif

.env:
	cp .env.example .env
	@chmod 600 .env
	@echo "==> Created .env from .env.example."

down: ## stop the stack (volumes are kept)
	$(COMPOSE) down

# Reload Caddy after deploy/Caddyfile changes (used by update and auto-update).
restart-caddy:
ifeq ($(SERVICES),)
	@echo "==> deploy/Caddyfile changed: restarting Caddy"
	$(COMPOSE) restart caddy
endif

restart: ## recreate the containers (e.g. after editing .env)
	$(COMPOSE) up -d --wait --force-recreate $(SERVICES)

logs: ## follow container logs
	$(COMPOSE) logs -f --tail=100

status: ## container state, health, live revision, auto-update status
	$(COMPOSE) ps
	@curl -fsS http://127.0.0.1:8735/api/health && echo || echo "The app is not answering on 127.0.0.1:8735."
	@echo "Site: $(URL)"
	@if crontab -l 2>/dev/null | grep -qF "$(AUTO_UPDATE_MARK)"; then \
	  echo "Automatic updates: on, following '$$(git symbolic-ref --short HEAD 2>/dev/null || echo '?')'. Latest:"; \
	  tail -n 3 backups/auto-update.log 2>/dev/null | sed 's/^/  /' || true; \
	else echo "Automatic updates: off (make auto-update-on)"; fi

shell: ## shell in the app container (database: sqlite3 /data/academy.db)
	$(COMPOSE) exec app bash

##@ Release and deployment

release: ## test, then push the current branch to dev and master
	@sh tools/release.sh

update: ## (server) pull, rebuild and restart
	@old=$$(git rev-parse HEAD:deploy/Caddyfile 2>/dev/null); \
	git pull --ff-only && \
	if [ "$$old" != "$$(git rev-parse HEAD:deploy/Caddyfile)" ]; then $(MAKE) check-caddy || exit 1; fi && \
	$(MAKE) up && \
	if [ "$$old" != "$$(git rev-parse HEAD:deploy/Caddyfile)" ]; then $(MAKE) restart-caddy; fi
	@$(MAKE) prune-images

refresh: ## rebuild on the latest Caddy and Python base images
ifeq ($(SERVICES),)
	$(COMPOSE) pull --quiet caddy
endif
	$(COMPOSE) build --pull app
	$(MAKE) up
	@$(MAKE) prune-images

# Remove dangling images and cap the build cache at 2 GB.
# (--max-used-space on Docker >= 28, --keep-storage before.)
prune-images:
	docker image prune -f
	@docker builder prune -f --max-used-space 2gb 2>/dev/null \
	  || docker builder prune -f --keep-storage 2gb 2>/dev/null \
	  || docker builder prune -f --filter until=24h

# Validate deploy/Caddyfile before Caddy is restarted with it.
check-caddy:
ifeq ($(SERVICES),)
	$(COMPOSE) run --rm --no-deps -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
endif

# Marker identifying this checkout's cron entries.
AUTO_UPDATE_MARK := \# 1991_academy auto-update $(CURDIR)

auto-update-on: ## (server) deploy new commits every 5 min, refresh base images weekly
	@mkdir -p backups
	@line="*/5 * * * * cd '$(CURDIR)' && sh deploy/auto-update.sh >> backups/auto-update.log 2>&1 $(AUTO_UPDATE_MARK)"; \
	weekly="0 4 * * 0 cd '$(CURDIR)' && sh deploy/auto-update.sh --refresh >> backups/auto-update.log 2>&1 $(AUTO_UPDATE_MARK)"; \
	{ crontab -l 2>/dev/null | grep -vF "$(AUTO_UPDATE_MARK)" ; echo "$$line"; echo "$$weekly"; } | crontab - \
	  && echo "==> Automatic updates are on: this server follows '$$(git symbolic-ref --short HEAD)' on GitHub." \
	  && echo "    Every 5 minutes it checks for new commits, and every Sunday at 04:00 it installs" \
	  && echo "    security updates for Caddy and Python (make refresh). Log: backups/auto-update.log" \
	  && echo "    Stop with: make auto-update-off"

auto-update-off: ## (server) disable automatic deployment
	@crontab -l 2>/dev/null | grep -vF "$(AUTO_UPDATE_MARK)" | crontab - ; \
	echo "==> Automatic updates are off. 'make update' installs new commits by hand."

DISPOSABLE_URL := https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf
disposable-list: ## refresh the disposable-email domain list
	@curl -fsSL "$(DISPOSABLE_URL)" -o .disposable.tmp
	@test "$$(wc -l < .disposable.tmp)" -gt 1000 || { rm -f .disposable.tmp; echo "The download looks wrong; the list is unchanged."; exit 1; }
	@{ head -4 disposable_email_domains.txt; cat .disposable.tmp; } > .disposable.new && rm .disposable.tmp && mv .disposable.new disposable_email_domains.txt
	@echo "==> $$(grep -vc '^#' disposable_email_domains.txt) temporary-email domains. 'make release' publishes the new list."

##@ Administration

# NAME rather than USER, which make inherits from the environment.
admin: ## grant admin: NAME=<username> [EMAIL=<email> to create the account]
	@test -n "$(NAME)" || { echo "usage: make admin NAME=<username> [EMAIL=<email>, if the account doesn't exist yet]"; exit 2; }
	$(COMPOSE) exec -T app python app.py admin add "$(NAME)" $(if $(EMAIL),"$(EMAIL)")

admin-remove: ## revoke admin: NAME=<username>
	@test -n "$(NAME)" || { echo "usage: make admin-remove NAME=<username>"; exit 2; }
	$(COMPOSE) exec -T app python app.py admin remove "$(NAME)"

admins: ## list admin accounts
	$(COMPOSE) exec -T app python app.py admin list

password: ## issue a temporary password: NAME=<username>
	@test -n "$(NAME)" || { echo "usage: make password NAME=<username>"; exit 2; }
	$(COMPOSE) exec -T app python app.py password "$(NAME)"

##@ Media

video: ## encode a lecture: SRC=<file> ID=<YouTube id> (requires ffmpeg)
	@test -n "$(SRC)" && test -n "$(ID)" || { echo 'usage: make video SRC="Lecture 5.mp4" ID=<YouTube id>'; exit 2; }
	@sh tools/encode-video.sh "$(SRC)" "$(ID)" "$(MEDIA)"

media-upload: ## rsync media to a server: TO=root@SERVER [DIR=<path>]
	@test -n "$(TO)" || { echo "usage: make media-upload TO=root@SERVER  [DIR=folder on the server, default 1991_academy/media]"; exit 2; }
	rsync -av --partial --progress --exclude '.*' --chmod=D755,F644 "$(MEDIA)/" "$(TO):$(or $(DIR),1991_academy/media)/"

##@ Database

backup: ## online backup to backups/
	$(COMPOSE) exec -T app bash deploy/backup.sh
	@mkdir -p backups
	$(COMPOSE) cp app:/data/backups/. backups/
	@# same 30-day retention as in the volume
	@find backups -maxdepth 1 -name 'academy-*.db.gz' -mtime +30 -delete

nightly-backup: ## (server) schedule a daily backup at 03:30
	@line="30 3 * * * cd '$(CURDIR)' && mkdir -p backups && make backup >> backups/cron.log 2>&1"; \
	{ crontab -l 2>/dev/null | grep -vF "cd '$(CURDIR)' && mkdir -p backups && make backup" ; echo "$$line"; } | crontab - \
	  && echo "==> Nightly backup scheduled (see: crontab -l):" && echo "    $$line"

restore: ## restore a backup: FILE=backups/academy-<time>.db.gz
	@[ -n "$(FILE)" ] || { echo "usage: make restore FILE=backups/academy-<time>.db.gz"; exit 1; }
	gzip -t "$(FILE)"
	$(COMPOSE) stop app
	@echo "==> Backing up the current database first"
	$(COMPOSE) run --rm -T --no-deps app bash deploy/backup.sh \
	  || { $(COMPOSE) start app; echo "That backup failed, so nothing was restored."; exit 1; }
	gunzip -c "$(FILE)" | $(COMPOSE) run --rm -T --no-deps app sh -c 'rm -f /data/academy.db-wal /data/academy.db-shm && cat > /data/academy.db'
	$(COMPOSE) up -d --wait app
	@echo "==> Restored $(FILE)"

##@ Development

install: $(VENV) ## create .venv with runtime and dev dependencies

dev: $(VENV) ## run the dev server on http://localhost:8735
	$(PYTHON) app.py

test: $(VENV) ## run the test suite
	$(PYTHON) -m pytest -q

lint: $(VENV) ## static analysis (ruff)
	.venv/bin/ruff check .

notebooks: ## regenerate Colab notebooks from js/data (requires Node.js)
	python3 tools/build_notebooks.py

$(VENV): requirements.txt requirements-dev.txt requirements.lock
	[ -x $(PYTHON) ] || python3 -m venv .venv
	$(PYTHON) -m pip install -q -r requirements-dev.txt -c requirements.lock
	touch $@
