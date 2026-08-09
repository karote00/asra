# Headless Core Runtime Plan

## Status and Authority

Active pre-release blocker on branch
`codex/asyra-public-release-headless-core`, based on the accepted public-release
integration checkpoint. The exact executable architecture contract is
`headless-core-runtime-flow-inspector.data.cjs`.

This child must open a pull request to
`codex/asyra-public-release-program` and pass its complete CI gates. Because it
changes Core and Input System lifecycle architecture, a green pull request is
not merge authority: the product owner must complete direct testing and give
explicit approval before this child may merge.

## Goal

Make non-visual information-model products a first-class supported runtime
mode while preserving the existing browser and Asyra Design paths:

```ts
import { createHeadlessCore } from '@asyra/core/headless'

const core = createHeadlessCore()
await core.startHeadless()
```

The headless path requires no DOM, render engine, canvas, browser input host,
or UI activation. It keeps the same deterministic Core ownership model for
composition, canonical state, validation, transactions, persistence,
collaboration preparation/activation, Features, registered actions, and
readiness publication.

## Product Contract

### Environment-neutral Input System

- Importing `@asyra/input-system`, importing `@asyra/core`, and constructing an
  `InputSystem` perform no DOM lookup and attach no browser listener.
- `InputSystem.attachBrowserHost(host, pointerTarget?)` explicitly activates
  keyboard listeners on the supplied `Window` and pointer/wheel listeners on
  the supplied target, defaulting to that `Window`.
- `switchWatchedElement(element)` derives the element's owning `Window`,
  activates that host when necessary, and moves only pointer/wheel ownership
  to the element. Repeating the same attachment is idempotent.
- Switching documents removes every listener from the previous host and
  pointer target before attaching the new pair.
- `detachBrowserHost()` and `dispose()` remove all attached browser listeners.
  `dispose()` also clears callbacks, timers, key state, combinations, and
  pointer capture state. `reset()` clears transient input state without
  silently discarding an active browser attachment.
- Core's visual startup activates the exact `InputSystem` supplied in its
  dependency composition; it does not route instance setup through the
  module-global singleton.

### Public headless composition

- `@asyra/core/headless` exports `createHeadlessCore()` and no default
  singleton. Importing the subpath is safe in the supported Node.js runtime.
- Each call creates fresh Factory, Props Manager, Scene Tree, Selection,
  System Context, Input System, Render runtime, and data-channel observer
  owners. Process-wide definition registries and event definitions retain
  their existing package ownership and are not advertised as multi-tenant
  isolation.
- The factory applies no Preset and installs no app-domain schema, component,
  Feature, action, render provider, or UI default.
- The composed Render and Input System dependencies stay inert unless an app
  explicitly chooses a visual/browser path before startup. This first release
  does not claim that `@asyra/core`'s npm dependency graph excludes the Render
  or UI packages exposed by the full Core facade.
- Core's System Context APIs must target the composed System Context instance,
  never the module-global singleton.

### Explicit startup modes

- `core.startHeadless()` is the canonical headless entry. It takes no DOM or
  render options, closes composition permanently, validates registration
  relations, and bypasses renderer initialization, canvas append, and input
  host activation.
- After the bypass, Core still prepares the optional collaboration session,
  initializes data-channel observers, loads the collaboration checkpoint or
  configured source, initializes Feature System with System Context but no
  Input System binding, activates collaboration, and publishes the existing
  readiness event.
- A configured render-engine provider or advanced renderer is a startup-mode
  conflict and fails before headless runtime effects. Headless startup never
  ignores configured visual work.
- `core.start(container, renderOptions)` remains the visual/default path. Its
  exact legacy missing-provider normalization remains supported for this
  release, while explicit headless documentation uses `startHeadless()`.
- A Core instance has one startup attempt and one selected mode. A second
  `start()` or `startHeadless()` call fails with a stable Core startup error;
  failure does not reopen composition.
- `destroy()` disposes the optional collaboration session, detaches the
  composed Input System browser host, and destroys the renderer without
  reopening composition.

### Supported headless behavior

The formal Node consumer proof covers:

- package and headless-subpath import without browser globals;
- composition and explicit headless startup;
- declarative property/component registration through public Core APIs;
- canonical model creation, retrieval, update, save, and load;
- transaction commit, rollback, undo, and redo through the composed runtime;
- Feature registration and programmatic action execution without input;
- System Context state owned by the composed Core; and
- no renderer initialization, canvas, listener attachment, or UI activation.

Domain schemas, AI retrieval/index policy, permissions, physical rules,
business rules, backends, and actions remain app-owned.

## Compatibility Contract

- Asyra Design retains its current startup call, Preset composition, canvas,
  keyboard, pointer, wheel, transaction, load, undo/redo, and rendering
  behavior.
- Direct `InputSystem` browser consumers migrate from constructor side effects
  to the explicit host lifecycle. The package README and canonical package
  contract document that change.
- Existing missing-provider Core startup remains a compatibility path; it is
  not the new recommended headless API.
- Design System and Preset catalog semantics are outside this task.

## Product Cases

1. Pure Node imports of `@asyra/input-system`, `@asyra/core`, and
   `@asyra/core/headless` succeed with no `window` or `document`.
2. Input construction causes zero browser listener registrations.
3. Explicit browser attachment routes keyboard to the host and pointer/wheel
   to the selected target exactly once.
4. Switching targets/documents and disposing remove the exact old listeners.
5. `createHeadlessCore()` returns a fresh canonical owner composition with an
   isolated System Context owner.
6. `startHeadless()` completes the non-visual lifecycle without renderer or
   input activation and supports the required information-model operations.
7. A visual provider/renderer conflict and a repeated startup fail before a
   second runtime is activated.
8. Existing visual Core startup and Asyra Design behavior remain unchanged.

## Bounded Mutation Scope

### Authorized

- `packages/input-system/**` for browser-host lifecycle, tests, README, and
  Changeset metadata;
- `packages/core/**` for default-instance separation, dependency-correct APIs,
  headless composition/startup, tests, README, exports, and Changeset metadata;
- `packages/system-context/**` only for the constructor dependency export
  required by headless composition plus tests/docs/Changeset metadata;
- directly affected canonical Framework contracts, this plan/Inspector, the
  public-release umbrella plan, Framework plan index, and unreleased decision
  history;
- directly affected Asyra Design startup/interaction tests and generated-app
  proof only when required to preserve the compatibility contract.

### Excluded

- Design System architecture or tokens;
- Preset catalog/default semantics;
- UI Context registry isolation or a new multi-tenant registry architecture;
- canonical model, property, scene-tree, transaction, collaboration, or
  persistence semantic redesign;
- app-domain Features, AI policy, schemas, backends, or visual output changes;
- package publication, deployment, unrelated website implementation, or new
  third-party dependencies.

### Fixed discovery and closure

Before the first implementation edit, discovery is limited to public
Core/Input/System Context exports, startup/listener lifecycle, direct package
and app consumers, current headless contracts, and existing clean-consumer
gates. After implementation begins, review is limited to the task diff, direct
consumers, regressions caused by the diff, and the gates below.

Stop if the contract requires a separate headless package, UI registry
isolation, canonical-owner redesign, or a new dependency. Return that decision
to the product owner instead of expanding this child.

## Implementation Segments

1. [x] Freeze this product contract, Inspector, product cases, bounded DoD,
       umbrella dependency, and active-blocker record.
2. [ ] Add formal failing Node-import, listener-lifecycle, headless-startup,
       composed-System-Context, and visual-compatibility regressions.
3. [ ] Make Input System construction inert and browser-host lifecycle
       explicit, instance-owned, idempotent, and disposable.
4. [ ] Separate the default Core singleton, inject composed dependencies into
       public APIs, add `@asyra/core/headless`, and implement explicit startup-mode
       ownership.
5. [ ] Synchronize public/canonical docs and ordinary scoped Changesets.
6. [ ] Run focused, package, root, clean-consumer, app, build/lint/dependency,
       and PR CI gates; then prepare the manual-test handoff.
7. [ ] Wait for the product owner's direct test and explicit merge approval.

## Step Execution Cards

Each segment must re-read the Inspector before editing.

### Segment 2 — Formal regressions

- Inspector owners: `construct-input-system`, `attach-browser-host`,
  `compose-headless-core`, `start-headless-core`, `start-visual-core`.
- Inputs: current public source, Node environment, current browser tests.
- Expected outputs: formal tests that fail on the current eager-window and
  missing-headless-entry behavior.
- Allowed boundary: test paths listed by those Inspector steps only.
- Stop: do not change production code before the failures are observed.

### Segment 3 — Input lifecycle

- Inspector owners: `construct-input-system`, `attach-browser-host`.
- Inputs: the failing listener and Node-import regressions.
- Expected outputs: inert construction plus explicit, exact browser lifecycle.
- Allowed boundary: `packages/input-system/src/**` and direct Core input facade
  tests/API only.
- Stop: do not alter key-combination or pointer semantics.

### Segment 4 — Core composition and startup

- Inspector owners: `compose-headless-core`, `start-headless-core`,
  `start-visual-core`.
- Inputs: the failing headless/startup/System Context regressions and accepted
  Input lifecycle.
- Expected outputs: public headless subpath, fresh owner composition, explicit
  mode, and preserved visual route.
- Allowed boundary: exact Core/System Context paths in the Inspector.
- Stop: do not refactor UI registry ownership or canonical semantics.

### Segment 5 — Contract synchronization

- Inspector owner: `publish-headless-contract`.
- Inputs: accepted runtime behavior and public exports.
- Expected outputs: truthful package, architecture, API, routing, runtime,
  support, decision, and Changeset records.
- Allowed boundary: exact docs/manifests/Changeset paths in the Inspector.
- Stop: no unverified claim that npm dependencies exclude Render/UI packages.

### Segment 6 — Verification and handoff

- Inspector owners: `verify-visual-compatibility`, `accept-headless-runtime`.
- Inputs: one reviewed candidate commit.
- Expected outputs: complete gate/CI evidence and reproducible manual steps.
- Allowed boundary: tests/configuration already owned by this plan; no product
  patching from visual evidence.
- Stop: never merge before explicit product-owner approval.

## Validation Gates

- Inspector contract test;
- `@asyra/input-system`, `@asyra/system-context`, and `@asyra/core` focused
  tests and builds;
- pure Node public-source and built-artifact import/start proofs;
- transaction/persistence/Feature/System Context headless product cases;
- existing Core visual startup and Input System interaction suites;
- Asyra Design focused startup/input tests, production build, and applicable
  E2E/visual gates;
- root `test:local`, `lint:ci`, build, dependency, diff, Changeset, and clean
  consumer gates applicable to the changed public packages;
- child PR CI green against `codex/asyra-public-release-program`;
- product-owner direct manual test and explicit approval.

## Definition of Done

- the three public imports are DOM-safe in Node;
- explicit headless startup proves the required information-model lifecycle
  without renderer/input/UI activation;
- browser input activation and cleanup are exact and instance-owned;
- the visual/default compatibility path and Asyra Design pass formal and
  direct verification;
- all public contracts and scoped Changesets match implementation;
- child PR CI is green; and
- the product owner has personally tested and explicitly approved the merge.
