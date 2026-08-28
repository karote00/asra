# Input System Environment Neutrality Plan

## Status and Authority

Completed on August 10, 2026, through PR #116 and the integrated release train.
The DOM-neutral import/construction contract, explicit browser listener
lifecycle, existing visual input route, formal tests, and required CI gates are
accepted. Its retained executable architecture contract is
[`input-system-environment-neutrality-flow-inspector.data.cjs`](../input-system-environment-neutrality-flow-inspector.data.cjs).

## Goal

Make `@asyra/input-system` safe to import and construct without browser globals,
while preserving the existing browser/Core/Asyra Design interaction path through
explicit, symmetric listener ownership.

This task does not add a Headless Core runtime. That architecture is an
unscheduled future target documented in
[`headless-core-and-core-kernel-future-plan.md`](headless-core-and-core-kernel-future-plan.md)
and indexed by
[`../../research/headless-core-and-core-kernel-architecture-research.md`](../../research/headless-core-and-core-kernel-architecture-research.md).

## Product Contract

### Environment-neutral construction

- Importing `@asyra/input-system`, importing `@asyra/core`, and constructing an
  `InputSystem` perform no DOM lookup and register no browser listener.
- Construction initializes only instance-owned registry, callback, timer, key,
  and pointer state.
- Node-safe import is an environment-safety contract, not a claim that the
  initial release provides a public Headless Core or Core Kernel.

### Explicit browser listener lifecycle

- `attachBrowserHost(host, pointerTarget?)` binds keyboard listeners to the
  supplied `Window` and pointer/wheel listeners to the supplied target, which
  defaults to that `Window`.
- Repeating an identical attachment is idempotent.
- `switchWatchedElement(element)` derives `element.ownerDocument.defaultView`
  and transfers pointer ownership. A cross-document transfer also transfers
  keyboard ownership.
- Every transfer removes the exact previous listeners before registering the
  next listeners.
- `detachBrowserHost()` removes all browser listeners owned by the instance.
- `reset()` clears transient input state but preserves the active attachment.
  `dispose()` detaches and clears transient state.

### Existing visual integration

- Core retains its existing typed reactive-event facade for
  `setupInputSystem(canvas)`; this task does not introduce a direct Core-to-input
  package call.
- The default Input System subscriber receives the existing watched-element
  event and activates the default singleton against the canvas and its owning
  window.
- Pointer, wheel, keyboard, Feature, transaction, canvas, and rendering
  semantics are not redesigned.

## Product Cases

1. `@asyra/input-system` imports and an `InputSystem` constructs in Node without
   `window` or `document`.
2. `@asyra/core` imports in Node without eager Input System DOM access.
3. Construction registers zero browser listeners.
4. Explicit host/target attachment is exact and idempotent; same-document and
   cross-document transfers clean up prior ownership.
5. `reset()` preserves an attachment and `dispose()` removes it.
6. Existing Core startup and Asyra Design interaction behavior remain intact.

## Bounded Mutation Scope

### Authorized

- `packages/input-system/**` for listener lifecycle, formal tests, README, and
  Changeset metadata;
- `packages/core/src/__tests__/node-import.test.ts` for the direct downstream
  Node-import regression;
- Core input facade only to preserve its pre-existing event boundary;
- directly affected Framework contracts, this plan/Inspector, release-program
  plan/index, unreleased decision history, and the deferred architecture
  research/future-plan records;
- focused Asyra Design verification needed to prove compatibility.

### Excluded

- public Headless Core entrypoints, `startHeadless()`, or a Core Kernel package;
- canonical owner, transaction, registry, Feature, Render, UI, Preset, or app
  domain redesign;
- Design System behavior;
- package publication, website implementation, or deployment;
- dependencies, runtime upgrades, and unrelated README rewriting.

### Fixed discovery and stop conditions

Discovery is limited to Input listener ownership, the existing watched-element
event route, direct Node imports, directly affected docs, and visual-app
consumers. After implementation, review is limited to this diff, those direct
consumers, and the gates below.

Stop if compatibility would require a new Core composition model, instance
isolation across package-global registries, a public Headless API, or a new
dependency. Record that work in the future plan rather than expanding this
child.

## Implementation Segments

1. [x] Freeze the Input-only contract, product cases, Inspector, scope, and
       continuous-execution acceptance boundary.
2. [x] Add formal Node-import and listener-lifecycle regressions before the
       production change.
3. [x] Make construction inert and add explicit, idempotent, symmetric browser
       listener ownership.
4. [x] Synchronize the public/canonical contracts, ordinary scoped Changeset,
       release-program wording, future plan, and research index.
5. [ ] Run focused Input/Core tests, builds, app compatibility gates, lint, and
       child PR CI.
6. [ ] Merge the green candidate into the release program without pausing for
       an intermediate product-owner checkpoint.

## Validation Gates

- `yarn workspace @asyra/input-system test:local`
- `yarn workspace @asyra/input-system build:input-system`
- focused Core Node-import regression and Core package gates
- focused Asyra Design input/startup tests followed by its applicable build/E2E
  compatibility gate
- Inspector contract test, documentation-reference checks, root lint, and PR CI
- synchronized live-app visual review plus keyboard, pointer, wheel, canvas,
  Undo, and Redo E2E evidence

## Definition of Done

- public Input/Core imports no longer fail solely because browser globals are
  absent;
- browser listeners have exact, instance-owned activation and cleanup;
- the existing Core reactive-event integration remains the visual owner route;
- current docs distinguish Node-safe imports from a future Headless/Core Kernel
  product contract;
- public behavior has a scoped patch Changeset;
- all required automated and PR checks pass for the current head; and
- the user-authorized continuous execution proceeds without an intermediate
  product-owner checkpoint, while final acceptance remains at the integrated
  release-goal boundary.

## References

- [`../../packages/input-system.md`](../../packages/input-system.md)
- [`../../API_SURFACES.md`](../../API_SURFACES.md)
- [`../../RELEASE_SUPPORT.md`](../../RELEASE_SUPPORT.md)
- [`headless-core-and-core-kernel-future-plan.md`](headless-core-and-core-kernel-future-plan.md)
- [`../../research/headless-core-and-core-kernel-architecture-research.md`](../../research/headless-core-and-core-kernel-architecture-research.md)
