# Asyra Executable Examples Plan

## Status

Completed on August 10, 2026, through PR #118 as a child of the
[Asyra Framework Website Program](completed/asyra-framework-website-plan.md).
The accepted bundle contains 11 maintained examples, deterministic extraction,
public-package-only boundaries, expected-output checks, and source-linked
documentation integration. Its exact example-flow Inspector, executable
product cases, and bounded Definition of Done all pass.

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

1. a minimal public Core information model using the current supported
   browser-compatible lifecycle and explicit optional-system boundaries;
2. a minimal Preset `2D` consumer;
3. selective Preset defaults, including deterministic dependency expansion;
4. a custom component, property, and schema;
5. one Feature/session with transaction commit, rollback, and one intended Undo
   unit;
6. save/load with app-owned versioned migration and invalid-data handling;
7. a custom render layer or custom render-engine boundary;
8. two in-memory actors with explicitly composed non-durable Collaboration;
9. a deterministic prepared AI action through registered app-owned actions;
10. the canonical model queried through app-owned retrieval/index logic and
    mutated only through registered Feature/API boundaries inside a currently
    supported composition; and
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
so canonical behavior can be tested without relying on pixel output. They must
not label no-canvas or Node-import evidence as a public Headless Core runtime.

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
4. Add the minimal Core, Preset, and extension-foundation examples.
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
- no example claims a Headless/Core Kernel lifecycle or no-Render/UI dependency
  before that future public contract exists;
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
- Visual and machine-facing browser compositions, Preset and custom,
  Collaboration and AI, success and rollback paths are represented without
  domain or future-runtime overclaiming.
- Every supported public guide code flow maps to a stable executable example or
  a generated API-reference contract.
- The deterministic inventory is ready for documentation and website use.
- Clean-consumer and final registry-only gates pass at the prescribed
  checkpoints.
