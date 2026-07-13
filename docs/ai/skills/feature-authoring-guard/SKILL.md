---
name: feature-authoring-guard
description: Author or refactor features with explicit priority/exclusive/session semantics and boundary-safe common-API usage. Use when requests add/fix feature behavior or session flow.
---


# Skill: feature-authoring-guard

## Trigger Signals

Use this skill when requests include:
- "add feature"
- "refactor feature"
- "priority/exclusive"
- "session behavior"
- "input event -> feature behavior"

## Do Not Use When

- Request is only docs updates without feature code changes.
- Request is only visual styling in UI components.

## Required Inputs

- Feature intent and user-visible behavior.
- Trigger event(s).
- Related docs:
  - `docs/ai/framework/packages/feature-system.md`
  - `docs/ai/apps/asyra-design/rules/feature-authoring.md`
  - `docs/ai/apps/asyra-design/API_SURFACES.md`

## Preflight

1. Locate existing feature(s) in `apps/asyra-design/src/features`.
2. Identify shared logic candidates in `apps/asyra-design/src/common-apis`.
3. Confirm constants source:
- events from `InputSystemEvents`
- feature ids from `FeatureNames`

## Deterministic Procedure

1. Define mode:
- `execution` for one-shot actions
- `session` for start/update/end lifecycle

2. Set explicit feature metadata:
- `priority`
- `exclusive`

3. Keep ownership clean:
- feature orchestrates
- common-apis mutate/query
- no deep package internals in feature file

4. Implement cancellation semantics:
- explicit end/cancel result
- deterministic conflict behavior with other features

5. Update contracts when behavior changes:
- feature doc
- PRD/BDD snippets if behavior contract changed

## Validation Matrix

- Deterministic ordering under competing features.
- Session lifecycle is coherent (`onStart/onUpdate/onEnd`).
- No mutation path bypasses common-apis boundary.

## Required Output Format

1. `Behavior Contract`
- what changed for user-visible behavior

2. `Implementation`
- affected features and APIs

3. `Validation`
- commands and manual checks

4. `Docs Sync`
- updated docs and why

## Guardrails

- Do not embed business rules in input mapping files.
- Do not use ad-hoc string literals for feature ids/events.
- Do not commit/push unless user explicitly asks.

## Failure Policy

If feature ownership is unclear:
- provide one conservative implementation and one alternative
- ask for owner choice before broad refactor
