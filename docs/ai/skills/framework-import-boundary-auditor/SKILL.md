---
name: framework-import-boundary-auditor
description: Audit and fix import-boundary violations with deterministic facade-first rewrites and explicit exceptions. Use when requests mention deep imports, boundary cleanup, or core-facade migration.
---

# Skill: framework-import-boundary-auditor

## Trigger Signals

Use this skill when requests include:

- "import boundary"
- "deep import"
- "move import to core"
- "scan for boundary violations"
- "facade-first"

## Do Not Use When

- Request is only UI copy/style changes.
- Request is only runtime behavior debugging with no import churn.

## Required Inputs

- Scope: file list, folder, package, or full repo.
- Rules:
  - `docs/ai/framework/rules/import-boundaries.md`
  - `docs/ai/framework/CODING_STANDARDS.md`
- Current architecture references in:
  - `docs/ai/framework/API_SURFACES.md`
  - `docs/ai/framework/packages/core.md`

## Preflight

1. Capture current dirty state: `git status --short`
2. Scan imports in scope using `rg`.
3. Build a short mapping of allowed facade exports vs package exports.

## Deterministic Procedure

1. Find violations:

- deep package internal paths (`@asyra/*/src/*`)
- relative cross-package imports
- app-level direct imports where core facade already exists

2. Classify each finding:

- `must_fix_to_core_facade`
- `allowed_direct_package_import`
- `blocked_missing_facade_export`

3. Apply minimal edits:

- rewrite imports only
- avoid behavior changes unless required by typing

4. If blocked by missing core export:

- add curated export in `@asyra/core`
- avoid wildcard/bulk re-export patterns

5. Re-run targeted checks for touched packages/apps:

- lint/type/build commands for affected scope

## Validation Matrix

- Boundary scan: no `@asyra/*/src/*` in target scope.
- Build/type checks: pass for impacted package(s).
- Runtime behavior: unchanged unless explicitly requested.

## Required Output Format

Return results with these sections:

1. `Findings`

- list each violation category and count

2. `Changes`

- list import rewrites and any new facade exports

3. `Validation`

- commands run + pass/fail

4. `Open Items`

- allowed exceptions or blocked items

## Guardrails

- Do not introduce new deep imports while fixing others.
- Do not move app domain logic into core.
- Local commits may close completed, validated steps/stages; never push unless
  the user explicitly requests the remote operation. Follow
  `docs/ai/workflows/git-commit-push-policy.md`.

## Failure Policy

If facade ownership is ambiguous:

- do not guess
- keep current behavior
- output two concrete options with tradeoffs
