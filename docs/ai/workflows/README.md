# Workflow Commands

This folder defines command entrypoints. These files should stay lightweight and reference-driven.

## Commands

- `/feature <description>`
- `/refactor <description>`
- `/bugfix <description>`
- `/docs <task>`
- `/framework-api-change <scope>`
- `/app-feature <feature-name>`
- `/runtime-refactor <area>`
- `/deprecate-package <package>`
- `/golden-path-enforcement <scope>`
- `/docs-reality-check <scope>`

## Authoring Rule

Workflow files should:
- define intent and routing
- reference source-of-truth docs
- define minimal output contract

Workflow files should not:
- duplicate detailed architecture/business rules
- hardcode fast-changing implementation details

## Shared Reference Order

1. Route scope: framework / app / cross-cutting
2. Load source-of-truth docs by scope:
- framework: `docs/ai/framework/*`
- app: `docs/ai/apps/asyra-design/*`
3. Follow scope workflow:
- framework: `docs/ai/framework/WORKFLOW.md`
- app: `docs/ai/apps/asyra-design/WORKFLOW.md`

## Shared Output Contract

All workflows should return:

1. Scope and ownership
2. Contracts referenced
3. Changes made
4. Validation run and outcomes
5. Docs updated
6. Open risks/follow-ups
