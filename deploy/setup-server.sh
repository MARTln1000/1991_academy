#!/usr/bin/env bash
# Prepares a fresh Ubuntu 24.04+ (or Debian 12+) server for 1991 Academy.
# Run once as root from a copy of this deploy/ directory:
#
#   scp -r deploy ~/.ssh/academy_deploy.pub root@SERVER:
#   ssh root@SERVER bash deploy/setup-server.sh academy.example.com academy_deploy.pub
#
# (Logging in as a sudo user instead of root? Use `sudo bash deploy/...`.)
#
# It is safe to re-run, e.g. after changing a file in deploy/. It never touches
# the database and never overwrites an existing /etc/academy/academy.env.
#
# What it sets up (README.md → "Deploy" walks through the whole workflow):
#   * packages: python3 + venv, rsync, sqlite3, and Caddy from Caddy's own repo
#   * user `academy`: runs the app, owns the database and nothing else
#   * user `deploy`: GitHub Actions logs in as it (key-only, `restrict`ed) to
#     upload releases; it may stop/start the app and take a backup, nothing else
#   * /opt/academy/releases, /etc/academy/academy.env, /var/lib/academy,
#     /var/backups/academy
#   * academy.service and the nightly academy-backup.timer
#   * Caddy serving https://DOMAIN
#   * ufw allowing only SSH, HTTP and HTTPS (skip: ACADEMY_SKIP_FIREWALL=1)
set -euo pipefail

usage="usage: setup-server.sh DOMAIN DEPLOY_PUBLIC_KEY_FILE"
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
step() { printf '\n==> %s\n' "$*"; }

[[ $# -eq 2 ]] || die "$usage"
domain=$1
keyfile=$2
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

[[ $EUID -eq 0 ]] || die "run this as root (or with sudo)"
[[ $domain =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || die "not a domain name: $domain"
[[ -r $keyfile ]] || die "cannot read $keyfile"
pubkey=$(head -n 1 "$keyfile" | tr -d '\r')
[[ $pubkey =~ ^(ssh-|ecdsa-|sk-) ]] || die "$keyfile is not an SSH public key (it should be the .pub file)"
for f in academy.service academy-backup.service academy-backup.timer backup.sh Caddyfile academy.env.example; do
  [[ -f $here/$f ]] || die "missing $here/$f; copy the whole deploy/ directory"
done

step "Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
# dbus: lets the unprivileged deploy user query systemd (activate.sh reads the
# service's restart count). Already present on regular Ubuntu/Debian servers.
apt-get install -y -q python3 python3-venv rsync curl sqlite3 gnupg ufw sudo dbus
if ! command -v caddy >/dev/null; then
  # Caddy's official apt repository: https://caddyserver.com/docs/install
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi
python3 -c 'import sys; sys.exit(sys.version_info < (3, 10))' \
  || die "Python 3.10+ is required; this server has $(python3 --version)"

step "Creating users"
id -u academy >/dev/null 2>&1 \
  || useradd --system --user-group --no-create-home --home-dir /var/lib/academy --shell /usr/sbin/nologin academy
if ! id -u deploy >/dev/null 2>&1; then
  useradd --create-home --user-group --shell /bin/bash deploy
  usermod -p '*' deploy   # no password: key login only, but not "locked" (which can block keys too)
fi

step "Creating directories"
install -d -o deploy -g deploy -m 755 /opt/academy /opt/academy/releases
install -d -o academy -g academy -m 700 /var/lib/academy /var/backups/academy
install -d -o root -g academy -m 750 /etc/academy
if [[ -e /etc/academy/academy.env ]]; then
  echo "keeping the existing /etc/academy/academy.env"
else
  (umask 027 && sed "/^#/! s/academy\.example\.com/$domain/g" "$here/academy.env.example" > /etc/academy/academy.env)
  chown root:academy /etc/academy/academy.env
  echo "created /etc/academy/academy.env"
fi

step "Authorizing the deploy key"
ssh_dir="$(getent passwd deploy | cut -d: -f6)/.ssh"
install -d -o deploy -g deploy -m 700 "$ssh_dir"
touch "$ssh_dir/authorized_keys"
# `restrict`: no port/agent/X11 forwarding and no PTY; plain commands and rsync still work.
entry="restrict $pubkey"
grep -qxF "$entry" "$ssh_dir/authorized_keys" || printf '%s\n' "$entry" >> "$ssh_dir/authorized_keys"
chown deploy:deploy "$ssh_dir/authorized_keys"
chmod 600 "$ssh_dir/authorized_keys"

step "Granting deploy its sudo commands"
systemctl=$(command -v systemctl)
journalctl=$(command -v journalctl)
# sudo ignores files in sudoers.d whose name contains a dot, so the .tmp file is
# inert until it has passed visudo and been renamed.
cat > /etc/sudoers.d/academy-deploy.tmp <<EOF
# Installed by deploy/setup-server.sh. The commands deploy/activate.sh needs, nothing more.
deploy ALL=(root) NOPASSWD: $systemctl stop academy.service, $systemctl start academy.service, $systemctl start academy-backup.service, $journalctl -u academy.service -n 60 --no-pager, $journalctl -u academy-backup.service -n 20 --no-pager
EOF
chmod 440 /etc/sudoers.d/academy-deploy.tmp
visudo -cqf /etc/sudoers.d/academy-deploy.tmp || die "generated sudoers file is invalid"
mv /etc/sudoers.d/academy-deploy.tmp /etc/sudoers.d/academy-deploy

step "Installing the systemd units"
install -m 644 "$here/academy.service" "$here/academy-backup.service" "$here/academy-backup.timer" /etc/systemd/system/
install -m 755 "$here/backup.sh" /usr/local/sbin/academy-backup
systemctl daemon-reload
systemctl enable academy.service   # starts at boot; the first deploy starts it now
systemctl enable --now academy-backup.timer
systemctl try-restart academy.service   # on a re-run, pick up unit changes

step "Configuring Caddy for https://$domain"
sed "/^#/! s/academy\.example\.com/$domain/g" "$here/Caddyfile" > /etc/caddy/Caddyfile.new
caddy validate --config /etc/caddy/Caddyfile.new --adapter caddyfile >/dev/null 2>&1 \
  || { caddy validate --config /etc/caddy/Caddyfile.new --adapter caddyfile; die "Caddyfile is invalid"; }
if [[ -f /etc/caddy/Caddyfile ]] && ! cmp -s /etc/caddy/Caddyfile /etc/caddy/Caddyfile.new; then
  backup="/etc/caddy/Caddyfile.bak-$(date +%Y%m%d%H%M%S)"
  cp /etc/caddy/Caddyfile "$backup"
  echo "previous Caddyfile saved as $backup"
fi
mv /etc/caddy/Caddyfile.new /etc/caddy/Caddyfile
systemctl enable caddy
systemctl reload-or-restart caddy

if [[ ${ACADEMY_SKIP_FIREWALL:-0} == 1 ]]; then
  step "Skipping the firewall (ACADEMY_SKIP_FIREWALL=1)"
else
  step "Firewall: allow SSH, HTTP and HTTPS only"
  # Keep every port sshd listens on, and the one this session came in on, so
  # enabling the firewall can't lock you out.
  ssh_ports=$( { sshd -T 2>/dev/null | awk '$1 == "port" {print $2}'; echo "${SSH_CONNECTION:-} " | awk '{print $4}'; } | sort -u)
  for port in ${ssh_ports:-22}; do ufw allow "$port/tcp" >/dev/null; done
  ufw allow 80/tcp >/dev/null
  ufw allow 443 >/dev/null   # tcp + udp (HTTP/3)
  ufw --force enable
fi

step "Done: $(hostname) is ready for deploys"
cat <<EOF

Next (README.md → Deploy → One-time setup has the details):

  1. DNS: point $domain (A/AAAA records) at this server if you haven't yet.
     Caddy fetches the HTTPS certificate as soon as the name resolves.
  2. Optional: fill in the ACADEMY_SMTP_* lines in /etc/academy/academy.env
     so password-reset emails are actually sent.
  3. GitHub → Settings → Secrets and variables → Actions
       Variables:  DEPLOY_HOST         this server's address
                   ACADEMY_URL         https://$domain
       Secrets:    DEPLOY_SSH_KEY      the private key belonging to $keyfile
                   DEPLOY_KNOWN_HOSTS  the output of: ssh-keyscan <DEPLOY_HOST>
     Check ssh-keyscan's keys against this server's own fingerprints:
$(for k in /etc/ssh/ssh_host_*_key.pub; do printf '       %s\n' "$(ssh-keygen -lf "$k")"; done)
  4. Push to master, or run the "Test & Deploy" workflow by hand.
EOF
