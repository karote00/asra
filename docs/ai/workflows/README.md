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

## Shared Retrieval and Search Policy (Global)

Use this policy for all workflow entrypoints.

1. Use `context-rag` first for routing (which files/sections to inspect), not as final truth.
2. Start with small `top-k` (`6-10`), then read only targeted sections (`rg -n` + line-range reads).
3. If retrieval is insufficient, run 2-3 rewritten queries using exact contract terms (phase/module/feature names).
4. Increase `top-k` gradually (`10 -> 20`) only when needed.
5. Run an exact-match completeness pass with `rg` before editing when coverage confidence is low.
6. Treat semantic retrieval as non-exhaustive; source docs/code remain source-of-truth.

## Shared Output Contract

All workflows should return:

1. Scope and ownership
2. Contracts referenced
3. Changes made
4. Validation run and outcomes
5. Docs updated
6. Open risks/follow-ups
