#!/usr/bin/env bash
set -e

# -----------------------------
# Configuration
# -----------------------------
LEVEL=${1:-patch}               # patch / minor / major
MAIN_BRANCH=main
PACKAGE_DIR="packages"
TAG_PREFIX="release-"

# -----------------------------
# Step 0: confirm on release branch
# -----------------------------
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" == "$MAIN_BRANCH" ]]; then
  echo "❌ You are on main. Please create a release branch first."
  exit 1
fi

echo "🛠 Running release.sh on branch: $CURRENT_BRANCH"
echo "Release level: $LEVEL"

# -----------------------------
# Step 1: find last release tag
# -----------------------------
LAST_TAG=$(git describe --tags --abbrev=0 || echo "")
if [[ -z "$LAST_TAG" ]]; then
  echo "⚠️ No previous release tag found, using first commit as base"
  BASE_COMMIT=$(git rev-list --max-parents=0 HEAD)
else
  echo "Last release tag found: $LAST_TAG"
  BASE_COMMIT=$LAST_TAG
fi

# -----------------------------
# Step 2: detect changed packages
# -----------------------------
CHANGED_PACKAGES=$(git diff --name-only $BASE_COMMIT...HEAD \
  | grep "^$PACKAGE_DIR/" \
  | cut -d/ -f2 \
  | sort -u)

if [[ -z "$CHANGED_PACKAGES" ]]; then
  echo "✅ No packages changed since $BASE_COMMIT. Nothing to release."
  exit 0
fi

echo "📦 Packages to bump:"
echo "$CHANGED_PACKAGES"
echo

read -p "Continue? (y/N) " CONFIRM
if [[ "$CONFIRM" != "y" ]]; then
  echo "❌ Aborted."
  exit 1
fi

# -----------------------------
# Step 3: bump versions locally
# -----------------------------
for pkg in $CHANGED_PACKAGES; do
  echo "🔧 Bumping $pkg → $LEVEL"
  (
    cd $PACKAGE_DIR/$pkg
    npm version "$LEVEL" --no-git-tag-version
  )
done

# -----------------------------
# Step 4: prepare release commit
# -----------------------------
echo
echo "✅ Version bump complete. Next steps:"
echo "- Review changes: git diff"
echo "- Commit all: git add . && git commit -m 'chore(release): bump versions'"
echo "- Optional: git tag ${TAG_PREFIX}YYYY-MM-DD"
echo "- Open PR → merge into main"
echo "- After merge: git push origin --tags"
echo "- npm publish packages individually"
