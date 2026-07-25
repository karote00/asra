# Completed Framework Plans

This directory stores completed framework plans by category so `PLANS.md` stays focused on active and deferred work.

## Categories

1. `architecture-and-bootstrap.md`
- Framework composition, bootstrapping, and preset/builtin ownership changes.

2. `property-runtime.md`
- Property component/model/runtime structure and behavior changes.

3. `events-and-registry.md`
- Event registration/ownership, reactive-events updates, and shared registry contract work.

4. `load-and-migration.md`
- Core-orchestrated load validation pipeline and migration-related completion records.

5. Repository-wide maintenance
- Completed documentation-contract, duplicate-ownership, and readability
  review records:
  - `project-wide-documentation-contract-audit-plan.md`
  - `project-wide-duplicate-contract-and-ownership-consolidation-plan.md`
  - `project-wide-code-readability-analysis-and-refactor-plan.md`

6. Framework release gates
- Completed network collaboration transport foundation:
  - `network-collaboration-transport-plan.md`
- Completed Group component and hierarchy behaviors:
  - `group-component-and-hierarchy-behaviors-plan.md`
- Completed optional AI agent runtime:
  - `ai-agent-runtime-plan.md`

## Update Rule

- When a plan is completed, remove it from `docs/ai/framework/PLANS.md` and
  preserve its detailed record in the appropriate category file or standalone
  completed-plan file in this directory.
- Keep completion date, result summary, and reference links.
- Also add/update a corresponding rationale entry in `docs/ai/framework/decisions/releases/unreleased.md`.
- If completion impacts app contracts too, also add/update `docs/ai/decisions/releases/unreleased.md`.
