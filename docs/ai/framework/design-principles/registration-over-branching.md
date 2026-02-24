# Principle: Registration Over Branching

## Intent

Prefer extension through registration surfaces instead of type-specific
branching across packages.

## Why

- keeps builtins movable and optional
- reduces coupling between framework core and app domain logic
- improves composability for custom components/features/render layers

## Decisions Implied

- new behavior should enter via:
  - component registration
  - property/schema registration
  - feature registration
  - render layer/strategy registration
- avoid scattering `if (type === ...)` changes across unrelated packages

## Anti-Patterns

- hardcoding app-specific behavior in framework internals
- duplicating registration logic in multiple runtime locations
- importing engine-specific details outside render package

## Design Check

Before merging:
1. Can this be added as a registration instead of special-case branching?
2. Does this keep builtins extractable to future packages?
3. Is extension behavior discoverable from one registration point?
