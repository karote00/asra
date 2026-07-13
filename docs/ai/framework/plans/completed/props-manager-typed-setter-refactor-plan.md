# Props Manager Typed Setter Refactor Plan

## Status

Completed on February 22, 2026 (archived branch-backfill reference).

## Context

In `@asyra/props-manager`, some code paths use structural casts like:

- `(existingPoint as { get: (key: string) => unknown })`

This happens because `PropertyComponentInstanceTypes` is currently broad, and TypeScript cannot safely infer key-level `get/set` operations (for example `x`, `y`, `pointType`) without narrowing.

## Current Problem

1. Runtime behavior is correct, but static typing is weak in these paths.
2. Structural casts reduce readability and increase maintenance risk for team members.
3. Shared `Setter` is used by both element and property components, so call sites see union-like behavior and lose specific key safety.

## Agreed Direction (Future Refactor)

1. Keep one shared `Setter` runtime implementation.
2. Split typed usage contracts by domain:
- element component contracts
- property component contracts
3. Use discriminated unions + explicit type guards for builtin property components (for example anchor-point component).
4. Replace structural casts with narrowed typed access:
- narrow by `type`
- then call typed `get/set` on the narrowed component interface

## Why This Direction

- Preserves framework flexibility (single setter engine).
- Improves compile-time safety.
- Makes intent explicit and easier for juniors to follow.
- Avoids ad-hoc casts that hide real type boundaries.

## Not In Scope Now

- No immediate implementation in this pass.
- This is a recorded follow-up for a dedicated typing cleanup refactor.
