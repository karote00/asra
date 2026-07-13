---
name: constants-registry-manager
description: Centralize and refactor constants/events/feature IDs, replace ad-hoc string literals, and maintain grouped+flattened constants contracts. Use when requests mention adding events/tools/features or reorganizing constants.
---


# Skill: constants-registry-manager

## Trigger Signals

Use this skill when requests include:
- "add event constant"
- "add feature name"
- "replace string literals"
- "reorganize constants"

## Do Not Use When

- Request is unrelated to identifiers/constants.
- Request is pure runtime bugfix with stable constants.

## Required Inputs

- New/changed identifier list.
- Affected runtime areas (features, controllers, key mapping).
- Rules:
  - `docs/ai/apps/asyra-design/CODING_STANDARDS.md`
  - `docs/ai/apps/asyra-design/modules/input-mapping.md`

## Preflight

1. Locate current constants modules in `apps/asyra-design/src/constants`.
2. Scan for duplicate literals in affected scope with `rg`.
3. Confirm naming follows domain grouping and flattened usage contracts.

## Deterministic Procedure

1. Add identifier to proper source module:
- input events -> `input-events.ts`
- tools -> `tools.ts`
- feature ids -> `feature-names.ts`
- layout/shared values -> `layout.ts`

2. If feature names changed:
- keep grouped sources
- keep flattened `FeatureNames` usage object
- preserve overlap checks

3. Replace direct string literals in runtime code.
4. Ensure `constants/index.ts` exports new entries.
5. Update docs paths/names if structure changed.

## Validation Matrix

- No stray string literals for centralized ids in touched scope.
- Imports compile via `../constants` or `../../constants` barrel.
- Feature registration/import names resolve from `FeatureNames`.

## Required Output Format

1. `Identifiers Added/Changed`
2. `Usage Rewrites`
3. `Validation`
4. `Docs Updated`

## Guardrails

- Do not create duplicate constant sources for same domain.
- Do not remove old constants without updating all references.
- Do not commit/push unless user explicitly asks.

## Failure Policy

If naming is disputed:
- provide naming options
- apply only non-controversial wiring changes
