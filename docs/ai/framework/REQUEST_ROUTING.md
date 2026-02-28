# Framework Request Routing

Use this file to route a new framework request to the right docs first.

## Fast Route

1. classify request type
2. open mapped docs below
3. verify against package owner doc
4. implement in owner package only

## Request Type -> Primary Docs

- startup/lifecycle/persistence flow
  - `ARCHITECTURE.md`
  - `packages/core.md`
  - `rules/load-validation-and-migration.md`

- feature execution/session/cancel behavior
  - `packages/feature-system.md`
  - `rules/data-flow-and-transactions.md`

- transaction/undo grouping and mutation boundaries
  - `rules/data-flow-and-transactions.md`
  - `packages/core.md`
  - `packages/scene-tree.md`
  - `packages/props-manager.md`

- component/property/schema registration
  - `packages/core.md`
  - `packages/props-manager.md`
  - `rules/extension-patterns.md`

- render engine abstraction and custom render layers
  - `packages/render.md`
  - `packages/core.md`
  - `rules/extension-patterns.md`

- ui-context derived-state behavior
  - `packages/ui-context.md`
  - `rules/data-flow-and-transactions.md`

- package boundary/import violations
  - `CODING_STANDARDS.md`
  - `rules/import-boundaries.md`

- load fallback/reject and migration strategy
  - `rules/load-validation-and-migration.md`
  - `packages/props-manager.md`
  - `PLANS.md`
  - `plans/completed/*` (for completed migration/validation history)
  - `decisions/releases/*` (for release-scoped rationale history)

- deprecated package behavior/removal timeline
  - `rules/deprecation-lifecycle.md`
  - deprecated package doc in `packages/*`

## Escalation Rule

If a request touches more than one owner package, treat it as cross-cutting:
- update all affected package docs in the same work
- update `ARCHITECTURE.md` if ownership or runtime flow changes
- add follow-up items to `PLANS.md` for deferred work
- move completed items into `plans/completed/*` by category
- append rationale changes to `decisions/releases/unreleased.md`
- if scope includes app impact, also append `docs/ai/decisions/releases/unreleased.md`
