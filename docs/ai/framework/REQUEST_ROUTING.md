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
  - `packages/factory.md`
  - `packages/scene-tree.md`
  - `packages/props-manager.md`

- transaction failure/rollback/cancel/commit/persist semantics
  - `rules/data-flow-and-transactions.md`
  - `packages/factory.md`
  - `packages/feature-system.md`
  - `plans/completed/transaction-atomicity-and-rollback-plan.md`

- shared publications/network collaboration/presence/app-owned policy
  - `packages/factory.md`
  - `CONSTRAINTS.md`
  - `plans/completed/network-collaboration-transport-plan.md`

- group/ungroup/reparent/reorder/subtree hierarchy behavior
  - `packages/scene-tree.md`
  - `packages/preset.md`
  - `packages/factory.md`
  - `plans/completed/group-component-and-hierarchy-behaviors-plan.md`

- AI intent/action planning/provider/permission/transaction execution
  - `FRAMEWORK_ESSENTIALS.md`
  - `packages/ai-agent-runtime.md`
  - `packages/feature-system.md`
  - `packages/factory.md`
  - `plans/completed/ai-agent-runtime-plan.md`

- auto-layout/unit-aware layout/UI aggregation Roadmap
  - `CONSTRAINTS.md`
  - `plans/auto-layout-behavior-engine-plan.md`
  - `plans/unit-conversion-and-ui-aggregation-plan.md`

- component/property/schema registration
  - `packages/core.md`
  - `packages/props-manager.md`
  - `rules/extension-patterns.md`
  - config-mode field customization:
    `plans/completed/property-type-redefinition-plan.md`

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
  - `plans/completed/props-manager-app-level-migration-plan.md`
  - `plans/completed/*` (for completed migration/validation history)
  - `decisions/releases/*` (for release-scoped rationale history)

- framework release readiness/package publication closeout
  - `PLANS.md`
  - `plans/completed/framework-release-readiness-and-closeout-plan.md`
  - `plans/framework-release-readiness-flow-inspector.data.cjs`
  - `plans/node-24-runtime-upgrade-and-vercel-validation-plan.md`
  - `plans/completed/local-versioned-package-install-research-plan.md`
  - `plans/framework-package-patch-release-plan.md`
  - `plans/create-asyra-design-app-release-plan.md`
  - `plans/asyra-framework-website-plan.md`
  - `rules/generated-artifacts.md`
  - `rules/pre-release-legacy-removal.md`
  - `decisions/releases/README.md`

- public Framework docs/examples/website/Runtime Atlas
  - `plans/asyra-framework-website-plan.md`
  - `plans/asyra-public-package-documentation-plan.md`
  - `plans/asyra-executable-examples-plan.md`
  - `plans/asyra-website-visual-reimagine-plan.md`
  - `plans/asyra-website-platform-and-docs-plan.md`
  - `plans/asyra-website-landing-page-plan.md`
  - `plans/asyra-runtime-atlas-plan.md`
  - `plans/asyra-website-launch-and-operations-plan.md`

- repository-wide documentation contract, owner, or reality audit
  - `design-principles/docs-as-contract.md`
  - `docs/ai/workflows/docs-reality-check.md`
  - `plans/completed/project-wide-documentation-contract-audit-plan.md`
  - affected framework/app source-of-truth documents

- repository-wide duplicate contract, misplaced owner, or readability refactor
  - `PLANS.md`
  - `plans/completed/project-wide-duplicate-contract-and-ownership-consolidation-plan.md`
  - `plans/completed/project-wide-code-readability-analysis-and-refactor-plan.md`
  - `CODING_STANDARDS.md`
  - affected framework/app/package owner documents

- deprecated package behavior/removal timeline
  - `rules/deprecation-lifecycle.md`
  - deprecated package doc in `packages/*`

- pre-release legacy branch, fallback, or stale internal behavior cleanup
  - `rules/pre-release-legacy-removal.md`
  - `WORKFLOW.md`
  - affected owner package doc in `packages/*`

## Escalation Rule

If a request touches more than one owner package, treat it as cross-cutting:
- update all affected package docs in the same work
- update `ARCHITECTURE.md` if ownership or runtime flow changes
- add follow-up items to `PLANS.md` for deferred work
- move completed items into `plans/completed/*` by category
- append rationale changes to `decisions/releases/unreleased.md`
- if scope includes app impact, also append `docs/ai/decisions/releases/unreleased.md`
