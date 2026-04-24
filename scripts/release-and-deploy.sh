#!/usr/bin/env bash
# release-and-deploy.sh — Cut a new paged-editor version, publish to the
# GitHub Packages registry, and refresh the ao-analyser installation.
#
# Usage:
#   ./scripts/release-and-deploy.sh                    # auto-bump patch (1.8.6 → 1.8.7)
#   ./scripts/release-and-deploy.sh 1.9.0              # explicit version
#   SKIP_AOANALYSER=1 ./scripts/release-and-deploy.sh  # publish only, skip consumer install
#   DRY_RUN=1 ./scripts/release-and-deploy.sh          # show the plan, touch nothing
#   LOCAL_ONLY=1 ./scripts/release-and-deploy.sh       # build + npm pack + extract into
#                                                      # ao-analyser/node_modules. NO git,
#                                                      # NO npm publish, NO version bump.
#                                                      # Use when SSH/registry is blocked
#                                                      # or for fast iteration cycles.
#
# What it does (in order):
#   1. Resolve the new version (arg or auto-bump patch of packages/base).
#   2. Bump `version` in all 5 package.json files (root + base + web + react + server).
#   3. Rebuild:
#        - packages/base        → tsc → dist/src → rsync to dist/js (runtime path).
#        - packages/web         → vite build + tsc declarations.
#        - packages/react       → vite build + tsc declarations.
#   4. Git commit + tag + push (main + tag).
#   5. npm publish all 5 packages in dependency order.
#   6. cd ao-analyser → npm install @benjaminbini/paged-editor-{base,server}@NEW.
#
# Prerequisites:
#   - ~/.npmrc holds //npm.pkg.github.com/:_authToken=<ghp_…>
#   - ao-analyser/.npmrc holds @benjaminbini:registry=https://npm.pkg.github.com
#   - Working tree clean (or DRY_RUN=1).

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AO_ANALYSER_DIR="${AO_ANALYSER_DIR:-$HOME/dev/projects/ao-analyser}"
SKIP_AOANALYSER="${SKIP_AOANALYSER:-0}"
DRY_RUN="${DRY_RUN:-0}"
LOCAL_ONLY="${LOCAL_ONLY:-0}"

# Packages ordered so that any package depending on another is listed after it.
# Format: "relative/dir"
PACKAGES=(
  "packages/base"
  "server"
  "packages/web"
  "packages/react"
  "."          # root (@benjaminbini/paged-editor-electron) — depends on base
)

# ── Helpers ───────────────────────────────────────────────────────────────
c_blue()  { printf "\033[1;34m%s\033[0m\n" "$*"; }
c_green() { printf "\033[1;32m%s\033[0m\n" "$*"; }
c_red()   { printf "\033[1;31m%s\033[0m\n" "$*" >&2; }
c_dim()   { printf "\033[2m%s\033[0m\n" "$*"; }

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    c_dim "  [dry-run] $*"
  else
    eval "$@"
  fi
}

bump_patch() {
  # "1.8.6" → "1.8.7"
  local v=$1
  local major minor patch
  IFS='.' read -r major minor patch <<<"$v"
  echo "${major}.${minor}.$((patch + 1))"
}

# ── 1. Resolve new version ────────────────────────────────────────────────
cd "$REPO_ROOT"

CURRENT_VERSION=$(node -p "require('./packages/base/package.json').version")
NEW_VERSION="${1:-$(bump_patch "$CURRENT_VERSION")}"

c_blue "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
c_blue "  paged-editor release & deploy"
c_blue "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Current version : $CURRENT_VERSION"
echo "  New version     : $NEW_VERSION"
echo "  Consumer target : $AO_ANALYSER_DIR"
[[ "$SKIP_AOANALYSER" == "1" ]] && echo "  (skipping consumer install)"
[[ "$DRY_RUN"         == "1" ]] && echo "  (DRY RUN — no filesystem or network changes)"
echo ""

# ── Sanity checks ─────────────────────────────────────────────────────────
if [[ "$DRY_RUN" != "1" ]] && [[ "$LOCAL_ONLY" != "1" ]] && [[ -n "$(git status --porcelain)" ]]; then
  c_red "✗ Working tree not clean. Commit or stash first, then retry."
  c_dim "  (Tip: LOCAL_ONLY=1 bypasses this check — no git operations run.)"
  git status --short
  exit 1
fi

if [[ "$SKIP_AOANALYSER" != "1" ]] && [[ ! -d "$AO_ANALYSER_DIR" ]]; then
  c_red "✗ ao-analyser directory not found: $AO_ANALYSER_DIR"
  exit 1
fi

# ── LOCAL_ONLY fast path ──────────────────────────────────────────────────
# Build, pack, extract into ao-analyser/node_modules. No git, no publish,
# no version bump. Uses the version currently in each package.json.
if [[ "$LOCAL_ONLY" == "1" ]]; then
  c_blue "LOCAL_ONLY mode: build → pack → extract, no git, no registry."
  echo ""

  c_blue "[1/3] Building packages/base (tsc → dist/js)"
  run "rm -rf '$REPO_ROOT/packages/base/dist/src' '$REPO_ROOT/packages/base/dist/js'"
  run "cd '$REPO_ROOT/packages/base' && npx tsc"
  run "cd '$REPO_ROOT/packages/base' && node scripts/emit-markdown-features.mjs"
  # web/react skipped — ao-analyser consumes only base + server
  c_green "  ✓ base built"
  echo ""

  c_blue "[2/3] Packing tarballs"
  TMP_DIR=$(mktemp -d)
  trap 'rm -rf "$TMP_DIR"' EXIT
  for pkg in "packages/base" "server"; do
    pkg_abs="$REPO_ROOT/$pkg"
    pkg_name=$(node -p "require('$pkg_abs/package.json').name")
    pkg_ver=$(node -p  "require('$pkg_abs/package.json').version")
    echo "  • packing $pkg_name@$pkg_ver"
    run "cd '$pkg_abs' && npm pack --pack-destination='$TMP_DIR' >/dev/null"
  done
  c_green "  ✓ tarballs in $TMP_DIR"
  echo ""

  c_blue "[3/3] Extracting into ao-analyser/node_modules"
  for pkg_dir in "packages/base" "server"; do
    pkg_abs="$REPO_ROOT/$pkg_dir"
    pkg_name=$(node -p "require('$pkg_abs/package.json').name")
    pkg_ver=$(node -p  "require('$pkg_abs/package.json').version")
    # npm pack names tarballs as `<scope>-<name>-<version>.tgz` with @ stripped.
    tarball_name="${pkg_name/@/}"
    tarball_name="${tarball_name/\//-}-${pkg_ver}.tgz"
    tarball="$TMP_DIR/$tarball_name"
    target="$AO_ANALYSER_DIR/node_modules/$pkg_name"
    echo "  • $pkg_name → $target"
    if [[ ! -f "$tarball" ]]; then
      c_red "    ✗ tarball not found: $tarball"
      exit 1
    fi
    run "rm -rf '$target'"
    run "mkdir -p '$target'"
    # npm's pack tarball wraps content under a top-level `package/` dir.
    run "tar -xzf '$tarball' -C '$target' --strip-components=1"
  done
  c_green "  ✓ ao-analyser now runs from your local build"
  echo ""

  c_blue "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  c_green "✔ Local deploy complete."
  c_dim  "  ao-analyser's package-lock.json is unchanged."
  c_dim  "  Next 'npm install' in ao-analyser will revert to registry version."
  c_blue "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
fi

# ── 2. Bump all 5 package.json files ──────────────────────────────────────
c_blue "[2/6] Bumping package versions → $NEW_VERSION"
for pkg in "${PACKAGES[@]}"; do
  pkg_path="$REPO_ROOT/$pkg/package.json"
  pkg_name=$(node -p "require('$pkg_path').name")
  echo "  • $pkg_name ($pkg)"
  run "cd '$REPO_ROOT/$pkg' && npm pkg set version='$NEW_VERSION' >/dev/null"
done
c_green "  ✓ versions bumped"
echo ""

# ── 3. Rebuild ────────────────────────────────────────────────────────────
c_blue "[3/6] Building packages"

echo "  • packages/base (tsc → dist/js)"
run "rm -rf '$REPO_ROOT/packages/base/dist/src' '$REPO_ROOT/packages/base/dist/js'"
run "cd '$REPO_ROOT/packages/base' && npx tsc"
run "cd '$REPO_ROOT/packages/base' && node scripts/emit-markdown-features.mjs"

echo "  • packages/web (vite + tsc)"
run "cd '$REPO_ROOT/packages/web' && npm run build --silent"

echo "  • packages/react (vite + tsc)"
run "cd '$REPO_ROOT/packages/react' && npm run build --silent"

c_green "  ✓ build complete"
echo ""

# ── 4. Git commit + tag + push ────────────────────────────────────────────
c_blue "[4/6] Commit, tag, and push"
COMMIT_MSG="chore: bump all packages to v${NEW_VERSION}"
run "cd '$REPO_ROOT' && git add -A"
run "cd '$REPO_ROOT' && git commit -m '$COMMIT_MSG'"
run "cd '$REPO_ROOT' && git tag 'v${NEW_VERSION}'"
run "cd '$REPO_ROOT' && git push origin main"
run "cd '$REPO_ROOT' && git push origin 'v${NEW_VERSION}'"
c_green "  ✓ pushed v${NEW_VERSION} to origin"
echo ""

# ── 5. npm publish (in dependency order) ──────────────────────────────────
c_blue "[5/6] Publishing to GitHub Packages registry"
for pkg in "${PACKAGES[@]}"; do
  pkg_path="$REPO_ROOT/$pkg/package.json"
  pkg_name=$(node -p "require('$pkg_path').name")
  echo "  • publishing $pkg_name@$NEW_VERSION"
  run "cd '$REPO_ROOT/$pkg' && npm publish --access=restricted"
done
c_green "  ✓ all 5 packages published"
echo ""

# ── 6. Refresh ao-analyser ────────────────────────────────────────────────
if [[ "$SKIP_AOANALYSER" == "1" ]]; then
  c_blue "[6/6] Skipping ao-analyser install (SKIP_AOANALYSER=1)"
else
  c_blue "[6/6] Installing new version in ao-analyser"
  # Small delay: GitHub Packages can take a few seconds to index a fresh upload.
  if [[ "$DRY_RUN" != "1" ]]; then
    echo "  • waiting 5s for registry to settle…"
    sleep 5
  fi
  run "cd '$AO_ANALYSER_DIR' && npm install \
    '@benjaminbini/paged-editor-base@${NEW_VERSION}' \
    '@benjaminbini/paged-editor-server@${NEW_VERSION}'"
  c_green "  ✓ ao-analyser now on paged-editor v${NEW_VERSION}"
  echo ""
fi

c_blue "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
c_green "✔ Release v${NEW_VERSION} complete."
c_blue "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
