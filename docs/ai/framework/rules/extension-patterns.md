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
- Preset defaults must stay optional and replaceable by product owners.
- If a preset capability has no direct extension hook, use an explicit replacement path (`unregister -> redefine` or an approved override flow) rather than patching package internals.
- Extension and replacement must use stable registration keys, names, or metadata instead of importing implementation-local preset details.
- Bounded extension targets use the shared `ExtensionRegistry` contract:
  `before`, then default or one explicit `replace`, then `after`, then `append`.
  Multiple entries within one bucket preserve the caller's declared order.
- Every extension installer returns its owned cleanup function. Apply rollback,
  target unregister, and full application disposal run cleanup in reverse order;
  cleanup failure remains a structured failure and blocks replacement. A target
  with a failed cleanup stays applied and retryable; cleanup handles that already
  completed successfully are not invoked again.
- Explicit `replace` bypasses the target default and must not be implemented as
  duplicate-registration tolerance.

## Feature and Capability Isolation

- New app behavior should enter through feature, component, property, schema, render layer, or event registration.
- Features should prove their own behavior through app/common APIs or core facade APIs.
- A feature must not require direct knowledge of unrelated package internals to remain correct.

## Naming Rules

- Use ownership-accurate names.
- Avoid UI-prefixed naming in data/domain packages.
- Deprecated modules should include status in package doc title/body.
