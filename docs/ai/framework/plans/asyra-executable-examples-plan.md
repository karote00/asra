# Asyra Executable Examples Plan

## Status

Superseded on August 11, 2026, by maintainer product review on the dedicated
website review branch. The previously completed 11-example runner, public
inventory, source-linked website route, and generated-app extension fixture
were removed from the current product surface.

The original implementation remains part of Git history. It is not a current
documentation, release, website, or learning contract.

## Supersession decision

Asyra no longer teaches Framework behavior through repository commands that
print validation evidence. The knowledge those validations protected is now
owned by task-focused advanced documentation:

- copyable public-API code;
- the app or composition module where the code runs;
- the caller and owner sequence;
- the observable product result;
- rejected, failed, disabled, and replacement behavior; and
- product tests an advanced user should create for their own domain.

Runtime Atlas retains six real, browser-operated Framework owner flows. It
links to the corresponding advanced guides rather than to example ids. New
users who want a complete working product start with
`create-asyra-design-app` or open Asyra Design with a non-empty `fileId`.

## Replacement owners

| Retired subject | Current learning owner |
| --- | --- |
| Core information model | `docs/public/learn/information-models.md` |
| Complete and selective Preset | `docs/public/start/preset-2d.md` |
| Custom component/schema | `docs/public/build/custom-schema.md` |
| Feature session, rollback, Undo/Redo | `docs/public/build/feature-session.md` |
| App-owned load migration | `docs/public/build/persistence-migration.md` |
| Custom render-engine boundary | `docs/public/build/render-boundary.md` |
| Two-actor collaboration | `docs/public/build/collaboration.md` |
| Registered AI action | `docs/public/build/ai-actions.md` |
| App retrieval and mutation | `docs/public/build/app-retrieval-action.md` |
| Generated Asyra Design extension | `docs/public/start/create-design-app.md` |

## Verification boundary

Package and app behavior remains protected by package-owned unit, integration,
type, clean-consumer, release, E2E, and visual gates. Those tests are internal
quality evidence; the official website presents what a user can build and how
the public owner flow works, not raw test-runner output.

The current exact supersession contract is retained in
[`asyra-executable-examples-flow-inspector.data.cjs`](asyra-executable-examples-flow-inspector.data.cjs)
and its contract test.

## Exclusions

- Do not restore `/examples` as a public route.
- Do not restore root `examples:*` commands or a public example inventory.
- Do not place generated validation output on the website.
- Do not remove package-owned formal tests merely because public examples were
  retired.
- Do not claim the future Headless Core or Core Kernel as current support.
