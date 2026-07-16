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
- `ExtensionRegistry<Context>` is the framework-neutral primitive for bounded
  registration extension:
  - target metadata uses a stable key, name, kind, owner, and explicit supported
    strategy list
  - supported strategies are `before`, `after`, `append`, and `replace`
  - resolution is deterministic: `before -> default or replace -> after ->
append`, preserving input order inside each bucket
  - duplicate targets/extensions, missing targets, invalid/unsupported
    strategies, replacement conflicts, apply failures, and cleanup failures use
    `ExtensionContractError` with stable `EXTENSION_ERROR_CODES` and a structured
    result payload
  - installers return cleanup functions; apply rollback, target unregister, and
    application disposal invoke owned cleanup in reverse order
  - metadata queries return detached values and do not expose registry authority

## Extension Points

- shared type modules for new domain contracts
- reusable utility primitives for package implementers
- application-scoped extension target registries for preset/package authors

## Validation Checklist

- Adding utility APIs does not introduce package coupling back to higher layers.
- Shared types are consumed via `@asyra/utils` imports across packages.
- Extension registry tests cover ordering, explicit replacement, structured
  failure, apply rollback, unregister fallback, and cleanup behavior.
