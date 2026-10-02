"""The scripts that move code from GitHub to the servers:

- deploy/auto-update.sh: run by cron on a server (`make auto-update-on`)
- tools/release.sh: `make release`, which publishes to dev and master
- the Makefile's cron jobs: auto-update and nightly backup leave each other be

Each test builds throwaway git repositories: `origin` (a bare repo standing in
for GitHub), `work` (the developer's checkout) and `server` (a clone, as on a
server). Their Makefile is a stub that records which targets ran, so nothing
here touches Docker, the real repository or the real crontab.
"""
import os
import shutil
import subprocess
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent

ENV = {
    **os.environ,
    "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com",
    "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com",
    "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1",
}

pytestmark = pytest.mark.skipif(not (shutil.which("git") and shutil.which("make")), reason="needs git and make")

STUB_MAKEFILE = """\
up:
\t@echo up >> .calls
\t@test ! -e BROKEN
backup:
\t@echo backup >> .calls
\t@test ! -e .backup-fails
restart-caddy:
\t@echo restart-caddy >> .calls
prune-images:
\t@echo prune-images >> .calls
test:
\t@echo test >> .calls
\t@test ! -e .tests-fail
"""


def run(*args, cwd, check=True):
    return subprocess.run(args, cwd=cwd, env=ENV, capture_output=True, text=True, check=check)


def head(repo, ref="HEAD"):
    return run("git", "rev-parse", ref, cwd=repo).stdout.strip()


def commit(repo, message, files=None, remove=()):
    for name, text in (files or {}).items():
        (repo / name).parent.mkdir(parents=True, exist_ok=True)
        (repo / name).write_text(text)
    for name in remove:
        run("git", "rm", "-q", name, cwd=repo)
    run("git", "add", "-A", cwd=repo)
    run("git", "commit", "-q", "-m", message, cwd=repo)
    return head(repo)


@pytest.fixture
def repos(tmp_path):
    origin, work, server = tmp_path / "origin.git", tmp_path / "work", tmp_path / "server"
    run("git", "init", "-q", "--bare", "-b", "master", str(origin), cwd=tmp_path)
    work.mkdir()
    run("git", "init", "-q", "-b", "master", cwd=work)
    for script in ("deploy/auto-update.sh", "tools/release.sh"):
        (work / script).parent.mkdir(exist_ok=True)
        shutil.copy(ROOT / script, work / script)
    commit(work, "first", {"Makefile": STUB_MAKEFILE, "deploy/Caddyfile": "site\n", "app.txt": "v1\n",
                           ".gitignore": ".calls\n.backup-fails\n.tests-fail\n"})
    run("git", "remote", "add", "origin", str(origin), cwd=work)
    run("git", "push", "-q", "-u", "origin", "master", "master:dev", cwd=work)
    run("git", "clone", "-q", str(origin), str(server), cwd=tmp_path)
    return origin, work, server


def push(work):
    run("git", "push", "-q", "origin", "HEAD:master", cwd=work)


def auto_update(server):
    r = run("sh", "deploy/auto-update.sh", cwd=server, check=False)
    return r.returncode, r.stdout + r.stderr


def calls(repo):
    f = repo / ".calls"
    out = f.read_text().split() if f.exists() else []
    f.unlink(missing_ok=True)
    return out


# ------------------------------------------------------------- auto-update

def test_nothing_new_means_nothing_happens(repos):
    _, _, server = repos
    assert auto_update(server) == (0, "")
    assert calls(server) == []


def test_a_new_commit_is_backed_up_then_installed(repos):
    _, work, server = repos
    new = commit(work, "v2", {"app.txt": "v2\n"})
    push(work)
    code, out = auto_update(server)
    assert code == 0, out
    assert head(server) == new
    assert calls(server) == ["backup", "up", "prune-images"]
    assert "updating master" in out and "done: now running" in out and "v2" in out


def test_caddy_restarts_only_when_its_config_changed(repos):
    _, work, server = repos
    commit(work, "caddy", {"deploy/Caddyfile": "site2\n"})
    push(work)
    assert auto_update(server)[0] == 0
    assert calls(server) == ["backup", "up", "restart-caddy", "prune-images"]


def test_a_broken_version_is_rolled_back_and_not_retried(repos):
    _, work, server = repos
    good = head(server)
    commit(work, "broken", {"BROKEN": "x"})
    push(work)
    code, out = auto_update(server)
    assert code == 1 and "going back" in out and "back on" in out, out
    assert head(server) == good and not (server / "BROKEN").exists()
    assert calls(server) == ["backup", "up", "up"]                    # tried, then rebuilt the old one
    assert auto_update(server) == (0, "") and calls(server) == []     # not retried every 5 minutes
    fixed = commit(work, "fix", remove=["BROKEN"])
    push(work)
    code, out = auto_update(server)
    assert code == 0 and head(server) == fixed, out
    assert not (server / ".git" / "auto-update-failed").exists()


def test_no_backup_no_update(repos):
    _, work, server = repos
    old = head(server)
    (server / ".backup-fails").write_text("")
    commit(work, "v2", {"app.txt": "v2\n"})
    push(work)
    code, out = auto_update(server)
    assert code == 1 and "backup failed" in out
    assert head(server) == old and calls(server) == ["backup"]


def test_changes_made_on_the_server_are_never_overwritten(repos):
    _, work, server = repos
    old = head(server)
    (server / "app.txt").write_text("edited on the server\n")
    commit(work, "v2", {"app.txt": "v2\n"})
    push(work)
    code, out = auto_update(server)
    assert code == 1 and "changed on this server" in out
    assert head(server) == old and (server / "app.txt").read_text() == "edited on the server\n"
    assert calls(server) == []


def test_a_rewritten_history_is_not_followed(repos):
    _, work, server = repos
    old = head(server)
    run("git", "commit", "-q", "--amend", "-m", "rewritten", cwd=work)
    run("git", "push", "-q", "--force", "origin", "HEAD:master", cwd=work)
    code, out = auto_update(server)
    assert code == 1 and "history was rewritten" in out
    assert head(server) == old and calls(server) == []


def test_a_detached_checkout_is_left_alone(repos):
    _, work, server = repos
    run("git", "checkout", "-q", "--detach", cwd=server)
    commit(work, "v2", {"app.txt": "v2\n"})
    push(work)
    code, out = auto_update(server)
    assert code == 0 and "not on a branch" in out and calls(server) == []


def test_one_run_at_a_time(repos):
    _, work, server = repos
    lock = server / ".git" / "auto-update.lock"
    lock.mkdir()                                   # another run is busy
    commit(work, "v2", {"app.txt": "v2\n"})
    push(work)
    assert auto_update(server) == (0, "") and calls(server) == []
    old = time.time() - 2 * 3600
    os.utime(lock, (old, old))                     # ...unless its lock is hours old
    assert auto_update(server)[0] == 0
    assert calls(server) == ["backup", "up", "prune-images"] and not lock.exists()


# ------------------------------------------------------------------ release

def release(work):
    r = run("sh", "tools/release.sh", cwd=work, check=False)
    return r.returncode, r.stdout + r.stderr


def test_release_pushes_the_branch_to_dev_and_master(repos):
    origin, work, _ = repos
    run("git", "checkout", "-q", "-b", "martin", cwd=work)
    new = commit(work, "feature", {"app.txt": "v2\n"})
    code, out = release(work)
    assert code == 0, out
    for branch in ("martin", "dev", "master"):
        assert head(origin, branch) == new, branch
    assert head(work, "dev") == new and head(work, "master") == new   # local copies too
    assert calls(work) == ["test"]
    assert "Released" in out
    assert release(work)[1].startswith("==> Checking GitHub\nNothing new")


def test_release_refuses_uncommitted_work(repos):
    origin, work, _ = repos
    before = head(origin, "master")
    (work / "app.txt").write_text("not committed\n")
    code, out = release(work)
    assert code == 1 and "aren't committed" in out
    assert head(origin, "master") == before and calls(work) == []


def test_release_refuses_when_github_is_ahead(repos, tmp_path):
    origin, work, _ = repos
    other = tmp_path / "other"
    run("git", "clone", "-q", "-b", "dev", str(origin), str(other), cwd=tmp_path)
    commit(other, "someone else's", {"other.txt": "x\n"})
    run("git", "push", "-q", "origin", "dev", cwd=other)
    commit(work, "mine", {"app.txt": "v2\n"})
    code, out = release(work)
    assert code == 1 and "git merge origin/dev" in out
    assert run("git", "log", "-1", "--format=%s", "master", cwd=origin).stdout.strip() == "first"


def test_release_stops_when_the_tests_fail(repos):
    origin, work, _ = repos
    before = head(origin, "master")
    commit(work, "v2", {"app.txt": "v2\n"})
    (work / ".tests-fail").write_text("")
    code, _ = release(work)
    assert code != 0 and head(origin, "master") == before and head(origin, "dev") == before


# --------------------------------------------------------- the cron jobs

def test_cron_jobs_leave_each_other_and_other_jobs_alone(tmp_path):
    """auto-update-on/off and nightly-backup each manage only their own line."""
    table = tmp_path / "crontab"
    table.write_text("0 1 * * * echo someone-else's-job\n")
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    (bin_dir / "crontab").write_text(
        # like the real one: read all of the new table, then replace the old one
        '#!/bin/sh\nif [ "$1" = "-l" ]; then cat "$CRONTAB_FILE"; else t=$(mktemp); cat > "$t"; mv "$t" "$CRONTAB_FILE"; fi\n')
    (bin_dir / "crontab").chmod(0o755)
    env = {**ENV, "PATH": f"{bin_dir}:{os.environ['PATH']}", "CRONTAB_FILE": str(table)}

    def make(target):
        subprocess.run(["make", "-s", "-C", str(ROOT), target], env=env, capture_output=True, text=True, check=True)
        return table.read_text().splitlines()

    for target in ("nightly-backup", "auto-update-on", "nightly-backup", "auto-update-on"):
        lines = make(target)
    assert len(lines) == 3
    assert lines[0] == "0 1 * * * echo someone-else's-job"
    assert sum("make backup" in line for line in lines) == 1
    auto = [line for line in lines if "auto-update.sh" in line]
    assert auto == [f"*/5 * * * * cd '{ROOT}' && sh deploy/auto-update.sh >> backups/auto-update.log 2>&1 "
                    f"# 1991_academy auto-update {ROOT}"]
    lines = make("auto-update-off")
    assert len(lines) == 2 and not any("auto-update" in line for line in lines)
