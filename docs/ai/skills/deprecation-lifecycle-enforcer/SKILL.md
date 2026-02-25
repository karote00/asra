# Skill: deprecation-lifecycle-enforcer

## Trigger Signals

Use this skill when requests include:
- "deprecate package"
- "compatibility mode"
- "retire old runtime"
- "mark as deprecated"

## Do Not Use When

- Request is introducing brand new package behavior.
- Replacement path is not identified at all.

## Required Inputs

- Target package/API.
- Replacement owner/surface.
- Rules:
  - `docs/ai/framework/rules/deprecation-lifecycle.md`

## Preflight

1. Confirm current runtime owner vs deprecated owner.
2. List public exports for target package.
3. Identify app/framework docs that mention the package.

## Deterministic Procedure

1. Add deprecation markers:
- JSDoc `@deprecated`
- runtime warning (if applicable and already pattern-matched)

2. Keep compatibility path stable for existing callers.
3. Block new work from landing in deprecated owner.
4. Update docs:
- package doc
- API surfaces
- constraints/architecture references

5. If requested, add migration checklist entry.

## Validation Matrix

- Deprecated status visible at API surface.
- Replacement path documented and callable.
- No new runtime ownership added to deprecated package.

## Required Output Format

1. `Deprecated Surface`
2. `Compatibility Guarantees`
3. `Replacement Path`
4. `Validation`

## Guardrails

- Do not hard-remove compatibility path unless explicitly requested.
- Do not silently change behavior under same API.
- Do not commit/push unless user explicitly asks.

## Failure Policy

If replacement is incomplete:
- mark deprecated but keep behavior
- output explicit blockers and migration prerequisites
