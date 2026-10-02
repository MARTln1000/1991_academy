#!/bin/sh
# make release: publish the current branch's commits to dev and master on GitHub.
#
# master is what servers run: with `make auto-update-on` they install a new
# master within 5 minutes; others run `make update`. After a release dev and
# master both equal your branch, so all three are up to date. Day-to-day work
# happens on your own branch (e.g. martin).
#
# Changes nothing, and says why, when there are uncommitted changes, when dev
# or master has commits your branch doesn't (merge them first), or when the
# tests fail. The three branches are pushed all at once or not at all.

set -eu
cd "$(dirname "$0")/.."

here=$(git symbolic-ref --quiet --short HEAD) || {
    echo "Check out your branch first (e.g. git checkout martin)."
    exit 1
}
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "You have changes that aren't committed yet. Commit them first:"
    git status --short --untracked-files=no
    exit 1
fi
untracked=$(git status --porcelain | grep '^??' || true)
if [ -n "$untracked" ]; then
    echo "Note: these new files aren't committed, so they won't be released (git add them to include them):"
    echo "$untracked" | sed 's/^?? /    /'
fi

echo "==> Checking GitHub"
git fetch --quiet origin
for b in dev master; do
    for ref in "origin/$b" "$b"; do
        if git rev-parse --verify --quiet "$ref" >/dev/null && ! git merge-base --is-ancestor "$ref" HEAD; then
            echo "$ref has commits that '$here' doesn't have. Bring them in first, then release again:"
            echo "    git merge $ref"
            exit 1
        fi
    done
done
if [ "$(git rev-parse HEAD)" = "$(git rev-parse --verify --quiet origin/master || true)" ] &&
   [ "$(git rev-parse HEAD)" = "$(git rev-parse --verify --quiet origin/dev || true)" ]; then
    echo "Nothing new: dev and master on GitHub are already at $(git log -1 --format='%h %s')."
    exit 0
fi

echo "==> Running the tests"
make test

echo "==> Pushing $(git log -1 --format='%h %s') to $here, dev and master"
git push --atomic origin "HEAD:refs/heads/$here" "HEAD:refs/heads/dev" "HEAD:refs/heads/master"
for b in dev master; do
    [ "$b" = "$here" ] || git branch --force "$b" HEAD >/dev/null
done

repo=$(git remote get-url origin | sed -e 's#^git@github.com:#https://github.com/#' -e 's#\.git$##')
echo "==> Released."
echo "    Servers with automatic updates install it within 5 minutes; others run 'make update'."
echo "    CI checks it too: $repo/actions"
