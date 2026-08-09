# Asyra Executable Examples Plan

## Status

Queued child plan of the
[Asyra Framework Website Program](asyra-framework-website-plan.md). Existing
examples under `docs/examples/*` remain the initial repository owner and must
be inventoried before new structures are introduced.

Implementation requires an exact example-flow Inspector, executable product
cases, approved public-package inputs, and a bounded Definition of Done.

## Goal

Provide small, maintained, executable examples that teach Framework mechanics
and prove that public documentation remains valid. Examples are product
evidence, not decorative website snippets and not substitutes for package
behavior tests.

## Ownership Boundary

This plan owns example code, fixtures, example-specific tests, expected output,
and the deterministic extraction interface used by documentation and the site.
It does not own:

- package implementation or package-owned unit tests;
- public documentation prose;
- website route or component implementation;
- the Runtime Atlas UI or its observation model;
- release README files, package versions, or publication; or
- Asyra Design production behavior.

Examples may import only package roots or explicitly exported public subpaths.
No example may rely on workspace-private imports, unpublished source, fake
fallback output, or local package aliasing that a clean consumer cannot use.

## Required Example Suite

The first maintained suite must cover:

1. a minimal headless Core information model with no Render or UI dependency;
2. a minimal Preset `2D` consumer;
3. selective Preset defaults, including deterministic dependency expansion;
4. a custom component, property, and schema;
5. one Feature/session with transaction commit, rollback, and one intended Undo
   unit;
6. save/load with app-owned versioned migration and invalid-data handling;
7. a custom render layer or custom render-engine boundary;
8. two in-memory actors with explicitly composed non-durable Collaboration;
9. a deterministic prepared AI action through registered app-owned actions;
10. a headless model queried through app-owned retrieval/index logic and
    mutated only through registered Feature/API boundaries; and
11. one bounded extension of a generated Asyra Design app.

These are composition-flow examples. They may demonstrate multiple packages
together and must not fabricate 19 disconnected samples merely to mirror the
package count.

## Example Contract

Each example must include:

- learning objective and package ownership map;
- exact prerequisites and public package versions supplied by the release
  inventory;
- runnable command and deterministic expected result;
- assertions for canonical state, transaction, failure, or output semantics;
- explanation of optional and app-owned behavior;
- source locations safe for documentation extraction;
- clean-consumer execution when the flow is publicly supported; and
- a canonical public-documentation page that explains the example.

Browser-dependent examples must separate runtime mechanics from presentation
so headless validation remains possible where the product contract permits it.

## Website Handoff

The workstream publishes a deterministic example inventory containing stable
IDs, titles, source files, public package requirements, supported environment,
run commands, extractable regions, and result contracts. The website may
render, embed, or link this inventory but may not fork code into an untested
variant.

Interactive website execution must use the same example owner or a formally
verified adapter. If browser constraints require a variant, that variant is a
new maintained example with its own tests.

## Implementation Stages

1. Inventory and classify existing `docs/examples/*` assets.
2. Freeze the example schema, stable IDs, extraction interface, and Inspector.
3. Prove package-root-only execution against approved local artifacts.
4. Add the minimal headless, Preset, and extension-foundation examples.
5. Add transaction, migration, render, Collaboration, and AI examples.
6. Add the generated-app bounded extension example.
7. Add deterministic inventory generation and documentation extraction checks.
8. Run focused, clean-consumer, registry-only, and stale-version gates at their
   defined release checkpoints.

## Quality Gates

- every example executes through public APIs and asserts meaningful behavior;
- package-private, relative cross-package, and unpublished artifact imports are
  absent;
- expected failures prove no partial canonical state or unintended commit;
- disabled optional systems remain inert;
- the headless examples prove no Render/UI dependency;
- local artifact and final registry-only clean-consumer runs agree;
- extracted snippets are identical to tested source;
- public documentation links resolve to stable example IDs; and
- example inventory versions derive from the verified release inventory.

## Stop Conditions

- A required public behavior is not represented by a stable exported API.
- The example can pass only through a private import, fixture-specific patch,
  fake runtime output, or unverified local package alias.
- Example behavior conflicts with an active package contract or formal test.
- The task requires package behavior repair outside its frozen scope.
- The browser/site would need to maintain a divergent code copy.

## Definition of Done

- The required suite executes and asserts the intended public behavior.
- Visual and headless, Preset and custom, Collaboration and AI, success and
  rollback paths are represented without domain overclaiming.
- Every supported public guide code flow maps to a stable executable example or
  a generated API-reference contract.
- The deterministic inventory is ready for documentation and website use.
- Clean-consumer and final registry-only gates pass at the prescribed
  checkpoints.
