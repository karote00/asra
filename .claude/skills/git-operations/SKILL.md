---
name: git-operations
description: Enforce git/gh CLI separation rule for version control operations
license: MIT
compatibility: opencode
metadata:
  category: version-control
  workflow: git
---

## Git/gh CLI Separation Rule

**Core Principle**: Use `git` CLI for local operations, `gh` CLI only for GitHub PR operations

### When to use `git` CLI

- `git add` - Stage changes
- `git commit` - Create commits
- `git checkout` / `git switch` - Branch operations
- `git push` / `git pull` - Remote synchronization
- `git status` / `git log` - Status and history
- `git merge` / `git rebase` - Integration operations
- `git diff` - View changes

### When to use `gh` CLI

- `gh pr create` - Create pull requests
- `gh pr list` - List pull requests
- `gh pr view` - View pull request details
- `gh pr merge` - Merge pull requests
- `gh pr checkout` - Checkout PR branch
- `gh issue create` / `gh issue list` - Issue operations

## Enforcement Guidelines

1. **Never use `gh` for**: commits, staging, branching, pushing/pulling
2. **Never use `git` for**: PR creation, PR management, issue operations
3. **Always prefer `git`** for core version control operations
4. **Use `gh` only** for GitHub-specific web UI operations

## Commit and Push Authority

- On a non-main feature branch, local commits may be created when they close a
  completed, validated, independently reviewable step or stage.
- Review branch, status, staged files, bounded staged diff, and scoped gates
  before every commit.
- A commit never authorizes a push.
- Never push unless the user explicitly requests a remote action. Pull-request
  creation authorizes only its minimum required source-branch push unless the
  user says not to push.
- Never rewrite shared history without explicit user authorization.
- Follow `docs/ai/workflows/git-commit-push-policy.md` as the project-wide
  source of truth.

## Examples

✅ **Correct:**

```bash
git add .
git commit -m "feat: add new feature"
git push origin feature-branch
gh pr create --title "Add new feature" --body "Description here"
```

❌ **Incorrect:**

```bash
gh repo clone owner/repo  # Use git clone instead
gh release create         # Use git tag + gh release create is fine
```

## Validation

Before executing any git/gh command, verify:

- Is this a local operation? → Use `git`
- Is this a PR/web operation? → Use `gh`
- Am I unsure? → Default to `git` for core operations
- Is this a local commit? → Confirm a completed validated step/stage and review
  the staged diff
- Is this a push or another remote mutation? → Require explicit user authority
