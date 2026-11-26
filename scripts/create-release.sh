#!/bin/bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

VERSION="${1:-}"
MESSAGE="${2:-}"
NOTES="${NOTES:-}"

usage() {
  echo "Usage:   make release <x.x.x | major | minor | patch> \"release notes\""
  echo "         make release <x.x.x | major | minor | patch> NOTES=notes.md"
  echo "Example: make release 0.1.0 \"First release\""
  echo "         make release patch \"Fix sync status\"   (bumps the latest tag's patch)"
}

if [ -z "$VERSION" ]; then
  echo "Error: VERSION is required."
  usage
  exit 1
fi

if [ -n "$NOTES" ] && [ -n "$MESSAGE" ]; then
  echo "Error: pass either a message or NOTES=<file>, not both."
  usage
  exit 1
fi

if [ -z "$NOTES" ] && [ -z "$MESSAGE" ]; then
  echo "Error: a message or NOTES=<file> is required."
  usage
  exit 1
fi

if [ -n "$NOTES" ] && [ ! -f "$NOTES" ]; then
  echo "Error: notes file '$NOTES' does not exist."
  exit 1
fi

if ! command -v gh &> /dev/null; then
  echo "Error: gh (GitHub CLI) is not installed."
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  echo "Error: releases are cut from main (currently on '$BRANCH')."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Error: the working tree is not clean. Commit or stash first."
  exit 1
fi

git fetch --tags --quiet origin
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "Error: local main and origin/main differ. Push or pull first."
  exit 1
fi

BUMP="$(printf '%s' "$VERSION" | tr '[:upper:]' '[:lower:]')"
if [ "$BUMP" = major ] || [ "$BUMP" = minor ] || [ "$BUMP" = patch ]; then
  # version sort, so 0.10.0 ranks above 0.9.0
  LATEST="$(git tag -l --sort=-v:refname | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | head -n1 || true)"
  if [ -z "$LATEST" ]; then
    LATEST="0.0.0"
  fi

  IFS='.' read -r MAJ MIN PAT <<< "$LATEST"
  case "$BUMP" in
    major)
      MAJ=$((MAJ + 1))
      MIN=0
      PAT=0
      ;;
    minor)
      MIN=$((MIN + 1))
      PAT=0
      ;;
    patch)
      PAT=$((PAT + 1))
      ;;
  esac
  VERSION="${MAJ}.${MIN}.${PAT}"
  echo "Bumping ${BUMP}: ${LATEST} -> ${VERSION}"
fi

# bare x.x.x without `v`, the CI tag trigger matches that shape only
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: '$VERSION' is not a version (x.x.x) or a bump keyword (major|minor|patch)."
  usage
  exit 1
fi

if git rev-parse -q --verify "refs/tags/$VERSION" >/dev/null 2>&1; then
  echo "Error: tag '$VERSION' already exists."
  exit 1
fi

# --no-git-tag-version, npm's own tag would be `v`-prefixed and miss the CI trigger
echo "Bumping package version to $VERSION ..."
npm version "$VERSION" --no-git-tag-version >/dev/null
git add package.json package-lock.json
git commit -m "Release $VERSION"

echo "Pushing main ..."
git push origin main

echo "Tagging $VERSION ..."
if [ -n "$NOTES" ]; then
  git tag -a "$VERSION" -F "$NOTES"
else
  git tag -a "$VERSION" -m "$MESSAGE"
fi

echo "Pushing tag to origin ..."
git push origin "$VERSION"

echo "Creating GitHub release $VERSION ..."
git tag -l --format='%(contents)' "$VERSION" | gh release create "$VERSION" --title "$VERSION" --notes-file -

if [ "${VERSION%%.*}" = "0" ]; then
  TAGS="$VERSION, ${VERSION%.*} and latest"
else
  TAGS="$VERSION, ${VERSION%.*}, ${VERSION%%.*} and latest"
fi
echo "Release $VERSION created. The tag build publishes the image tags $TAGS."
