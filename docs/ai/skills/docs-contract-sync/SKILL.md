---
name: docs-contract-sync
description: Synchronize implementation changes with framework/app docs contracts across API surfaces, behavior specs, and constraints. Use when code changes must be reflected in docs.
---


# Skill: docs-contract-sync

## Trigger Signals

Use this skill when requests include:
- "update docs with changes"
- "docs drift"
- "implementation vs docs"
- "sync contracts"

## Do Not Use When

- Request explicitly asks to avoid docs updates.
- Behavior/API is intentionally experimental and not yet contract-ready.

## Required Inputs

- Code changes in scope.
- Relevant doc sets:
  - framework docs (`docs/ai/framework/*`)
  - app docs (`docs/ai/apps/asyra-design/*`)

## Preflight

1. Build list of changed code files.
2. Map each changed area to contract type:
- API surface
- runtime behavior
- boundary/rule
- PRD/BDD behavior

3. Find docs currently describing each contract.

## Deterministic Procedure

1. Update minimum required docs in same change.
2. Remove or rewrite stale statements that conflict with code.
3. Keep path references exact after file moves/renames.
4. Keep cross-doc consistency (feature doc vs PRD vs API surfaces).
5. Do not add future plan items unless explicitly requested.

## Validation Matrix

- No known contradictions between implementation and touched docs.
- Referenced file paths exist.
- Behavior statements match current runtime behavior.

## Required Output Format

1. `Contract Changes Detected`
2. `Docs Updated`
3. `Validation`
4. `Deferred Drift`

## Guardrails

- Do not mention deprecated/old doc trees in new docs unless explicitly required.
- Avoid vague wording; prefer concrete behavior contracts.
- Do not commit/push unless user explicitly asks.

## Failure Policy

If behavior is still evolving:
- mark section as pending explicitly
- avoid pretending final behavior is settled
