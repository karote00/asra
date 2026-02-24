# Rule: Extension Patterns

## Use Registration Over Branching

- components
- properties
- schemas
- features
- render layers

Prefer:
- register new behavior in one place
- compose behavior with existing runtime contracts

Avoid:
- adding type-specific if/else chains across multiple packages
- coupling app feature behavior directly into framework internals

## Builtin vs App Logic

- Builtins provide defaults.
- App-level defines domain behavior.
- Keep builtins portable/movable for future package extraction.

## Naming Rules

- Use ownership-accurate names.
- Avoid UI-prefixed naming in data/domain packages.
- Deprecated modules should include status in package doc title/body.
