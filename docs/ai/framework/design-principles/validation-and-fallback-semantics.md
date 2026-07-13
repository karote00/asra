# Principle: Validation and Fallback Semantics

## Intent

Keep runtime data integrity strict while making load behavior resilient.

## Why

- runtime invalid writes should not corrupt active state
- persisted data may include old or invalid values after upgrades
- migration and validation need clear ownership boundaries

## Decisions Implied

- runtime set/update:
  - valid -> write
  - invalid -> reject
- load:
  - valid -> write
  - invalid with default -> fallback
  - invalid without default -> keep initialized safe value
- app owns document version migration
- framework packages own validation/fallback execution

## Anti-Patterns

- trusting UI parser/formatter as correctness authority
- embedding app-specific migration branching in package internals
- accepting invalid runtime values and fixing them later

## Design Check

Before merging:
1. Is runtime invalid data always rejected?
2. Is load-time invalid data handled with deterministic fallback?
3. Is migration ownership still app-level?
