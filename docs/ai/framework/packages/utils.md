# Package: @asyra/utils

## Responsibility

Provide shared types, ids, registry primitives, and low-level helpers.

## Owns

- shared type definitions used across packages
- id generation and id loading helpers
- common registry utility primitives
- framework-safe helper functions/constants

## Must Not Own

- runtime business policies
- package startup side effects
- app-specific behavior

## Rules

- Utils should stay pure and reusable across framework and apps.
- Shared types should be canonical (avoid duplicated shape definitions across packages).
- When a type is part of framework contract, define it here once.
- `MapRegistry.register(key, value)` is the base registration primitive for map-like registries:
  - duplicate keys are rejected by default (throws)
  - optional duplicate hooks/messages are configured at call sites

## Extension Points

- shared type modules for new domain contracts
- reusable utility primitives for package implementers

## Validation Checklist

- Adding utility APIs does not introduce package coupling back to higher layers.
- Shared types are consumed via `@asyra/utils` imports across packages.
