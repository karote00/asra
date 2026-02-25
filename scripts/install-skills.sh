#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$ROOT_DIR/docs/ai/skills"
DEST_DIR="${CODEX_HOME:-$HOME/.codex}/skills"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "Skills source folder not found: $SRC_DIR"
  exit 1
fi

mkdir -p "$DEST_DIR"

installed_count=0

for skill_dir in "$SRC_DIR"/*; do
  [[ -d "$skill_dir" ]] || continue
  [[ -f "$skill_dir/SKILL.md" ]] || continue

  skill_name="$(basename "$skill_dir")"
  mkdir -p "$DEST_DIR/$skill_name"
  cp "$skill_dir/SKILL.md" "$DEST_DIR/$skill_name/SKILL.md"

  installed_count=$((installed_count + 1))
  echo "Installed: $skill_name"
done

echo "Installed $installed_count skill(s) to $DEST_DIR"
