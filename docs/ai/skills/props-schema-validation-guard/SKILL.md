---
name: props-schema-validation-guard
description: Enforce schema-based runtime/load validation with valid-write and invalid-fallback semantics for props data. Use when requests mention invalid property values, schema typing, or load safety.
---


# Skill: props-schema-validation-guard

## Trigger Signals

Use this skill when requests include:
- "property validation"
- "invalid input accepted"
- "load fallback"
- "schema register"

## Do Not Use When

- Request is only UI formatting/placeholder updates.
- No props/property schema changes are involved.

## Required Inputs

- Target property/component definitions.
- Invalid value examples (if bugfix).
- Rules:
  - `docs/ai/framework/design-principles/validation-and-fallback-semantics.md`

## Preflight

1. Identify set/update/load entry points.
2. Identify current property type contracts.
3. Capture existing fallback/default behavior.

## Deterministic Procedure

1. Define/confirm type contract for each property.
2. Implement runtime write guard:
- valid -> write
- invalid -> reject/fallback

3. Implement load guard:
- invalid persisted value -> fallback initialized/default value

4. Keep UI parser/formatter optional; system remains final validator.
5. Update docs when schema rules or fallback semantics change.

## Validation Matrix

- Invalid input cannot corrupt persisted runtime state.
- Loading bad data results in deterministic fallback.
- Valid input path remains unchanged.

## Required Output Format

1. `Schema/Type Changes`
2. `Runtime Validation Changes`
3. `Load Fallback Changes`
4. `Validation`

## Guardrails

- Do not rely only on UI validation.
- Do not silently coerce invalid values without contract note.
- Do not commit/push unless user explicitly asks.

## Failure Policy

If migration is required but out of scope:
- keep backward-compatible loader
- add explicit migration follow-up note
