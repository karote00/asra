# Generic Preset Composition Plan

## Status and Dependencies

Active after the completed Render-Engine Boundary and Extendable Preset plans.
PR #81 merged both required contracts to `main` at merge commit
`3a43a2d704174252cbf832a51356c8b442bc6ab1`.

This plan does not introduce public `2d`, `3d`, or `hybrid` profile names.
Official render-mode profiles remain trigger-gated in
`preset-2d-3d-init-profile-plan.md`.

## Goal

Make preset startup deterministic and composable without coupling framework
bootstrap to a dimension label, product mode, or concrete render-engine
implementation.

Preset-owned composition stops at:

```text
shared preset defaults
-> concrete-engine bootstrap
-> explicitly selected optional capability bundles
-> completed composition result
```

App-owned startup then continues independently:

```text
applyPreset(core, composition?)
-> app remove/define/unregister/register through ordinary Core APIs
-> app register migration
-> core.start()
```

Preset never executes app customization and never declares the Core runtime
ready.

## Product Contract

### Supported behavior

- `applyPreset(core)` keeps its current compatibility behavior and installs the
  default Pixi-backed startup wiring.
- The second argument remains backward-compatible with the explicit dependency
  and `renderEngineFactory` overloads while gaining typed engine identity and
  capability-bundle selection.
- Preset applies exactly one deterministic layer order: shared defaults,
  concrete-engine bootstrap, selected bundles in caller-declared order, then a
  completed composition result.
- Apps customize registrations only after `applyPreset(...)` returns, through
  ordinary public Core relation/remove/unregister/define/register APIs.
- The first `core.start()` remains the permanent registration-composition
  closure and runtime startup owner.
- Successful diagnostics identify the concrete engine, applied shared groups,
  selected bundles, and exact layer order. They do not infer product mode.

### Unsupported behavior

- preset-owned app customization callbacks, extension objects, targets, or
  apply-back flows;
- public/shared registry `replace`, replace strategies, semantic-equivalence
  inference, or duplicate-registration fallback;
- selecting an official render-mode profile that has no concrete runtime;
- treating engine capabilities as app-domain feature ownership;
- importing concrete engine internals outside the allowed preset selection
  boundary;
- empty/no-op bundles or fallback output that simulates unsupported behavior;
- automatic engine fallback or product-mode inference.

## Public Typed Contract

The public names below are the contract target; implementation may split their
source files inside the Inspector allowlist without changing their meaning.

```ts
interface PresetEngineBootstrap {
  id: string
  factory?: RenderEngineFactory
}

interface PresetCapabilityBundle {
  id: string
  owner: RegistrationOwnerMetadata
  requires: readonly string[]
  install(context: PresetCapabilityBundleContext): PresetCapabilityInstallation
}

interface PresetCapabilityInstallation {
  outputs: readonly string[]
  dispose(): void
}

interface ApplyPresetOptions {
  dependencies?: PresetDependencies
  renderEngineFactory?: RenderEngineFactory // compatibility path
  engine?: PresetEngineBootstrap
  capabilityBundles?: readonly PresetCapabilityBundle[]
}

interface PresetCompositionSuccess {
  ok: true
  state: 'completed'
  engineId: string
  sharedGroups: readonly string[]
  capabilityBundles: readonly string[]
  order: readonly string[]
}

interface PresetApplication {
  readonly result: PresetCompositionSuccess
  dispose(): PresetApplicationDisposeSuccess
}
```

The default engine bootstrap identity is stable and preset-owned. An explicit
custom bootstrap supplies both a non-empty stable `id` and a factory. The
legacy `renderEngineFactory` option remains supported and maps to a stable
compatibility diagnostic identity; supplying both legacy and new engine inputs
is invalid.

A bundle has a package owner, stable identity, explicit selected-bundle
dependencies, installation outputs, and an owned disposer. Bundle dependencies
must appear earlier in the selected list. Preset does not reorder bundles or
copy registry conflict semantics.

### Structured failures

`PresetCompositionError` exposes a stable `code` and structured `result` with
the failed layer, selected engine/bundles known at failure time, completed
layers, cleanup state, pending cleanup keys, and original cause where present.
The stable code set covers:

- `INVALID_COMPOSITION`;
- `DUPLICATE_TARGET`;
- `UNKNOWN_ENGINE_BOOTSTRAP`;
- `MISSING_CAPABILITY_BUNDLE`;
- `ORDERING_CONFLICT`;
- `LAYER_INSTALL_FAILED`;
- `CLEANUP_FAILED`.

Validation failures happen before installation. Installation failure rolls
back installed owned resources in reverse order. Cleanup failure preserves a
deterministic retryable state; completed cleanup is not repeated. A failed
composition never publishes `PresetCompositionSuccess` and never leaves an
accepted partial composition.

## Ownership and Composition Layers

1. Shared preset defaults

- Owner: `@asyra/preset`.
- Contains engine-independent optional defaults and explicit runtime wiring.
- Installs each shared registration group exactly once.

2. Concrete-engine bootstrap

- Selection and stable diagnostic identity owner: `@asyra/preset`.
- Abstract contract owner: `@asyra/render-engine`.
- Provider acceptance and instance/resource lifecycle owner: `@asyra/render`.
- Concrete implementation/cleanup owner: selected engine package, with
  `@asyra/render-engine-pixi` as the default.
- Preset injects a factory; it never owns the resulting engine runtime.

3. Optional capability bundles

- Definition, outputs, dependency declaration, and disposer owner: the package
  that exports the bundle.
- Selection order and rollback coordination owner: `@asyra/preset`.
- Bundles are explicit and independently selectable; no dimension label or
  engine capability implies a bundle.

4. App customization

- Owner: app code after `applyPreset(...)` returns.
- Uses ordinary Core relation removal/definition or deterministic owner
  `unregister -> register` composition.
- Is not a preset composition layer and is not invoked by preset.

5. Runtime start

- Owner: `@asyra/core` through `core.start()`.
- Preset success means startup composition completed, not runtime-ready.

## Scope

In scope:

- typed composition input, success diagnostics, and structured failure
  contracts;
- deterministic shared-default, engine-bootstrap, and selected-bundle order;
- backward-compatible default application;
- duplicate, unknown/missing, ordering, partial-failure, cleanup-retry, and
  instance-isolation behavior;
- integration with engine injection and completed Extendable Preset contracts;
- documentation, executable Inspector authority, and formal tests.

Out of scope:

- extracting Pixi or defining a new render engine;
- production 3D or multi-engine runtime;
- official `2d`, `3d`, or `hybrid` profiles or placeholder profile names;
- camera, coordinate-space, hit-test, selection, or input multi-engine
  coordination;
- app-domain feature bundles or product mode inference;
- feature-runtime, property-schema, or completed relation/unregister redesign.

## Architecture Flow

1. App supplies Core plus optional typed preset composition input.
2. Preset resolves the compatibility-safe default when input is omitted and
   validates all engine and bundle identities/dependencies before mutation.
3. Preset applies shared defaults exactly once in their declared group order.
4. Preset passes the selected concrete-engine factory to `@asyra/render`;
   Render accepts the provider without constructing the runtime.
5. Preset invokes explicitly selected package-owned bundles in caller-declared
   order and records each installation output/disposer.
6. Preset publishes an instance-local completed composition result only after
   all selected layers succeed.
7. `applyPreset(...)` returns. App code may now customize through ordinary Core
   APIs and register app migration.
8. App calls `core.start()`. Core closes registration composition permanently
   and owns runtime startup/readiness.

Any failure in steps 3-5 routes to reverse-order cleanup. A cleanup failure
remains structured and retryable; no success result is published.

## Product Cases

- omitted composition preserves current Asyra Design startup behavior;
- explicit default-engine composition produces the same registration/runtime
  wiring and stable engine identity;
- shared defaults apply exactly once and in deterministic order;
- optional bundles install in explicit order with package-owned outputs;
- app customization occurs only after return through ordinary Core APIs;
- the public surface contains no preset-specific app extension object/callback;
- complete implementation change remains `unregister -> define/register` and no
  public/shared replace contract exists;
- duplicate bundle/engine targets fail before mutation;
- unknown engine bootstrap, missing bundle dependency, and ordering conflict
  fail with stable structured errors;
- a failed layer publishes no success and cleans installed resources in reverse
  order;
- cleanup retry runs only pending cleanup and leaves no stale observer, handler,
  subscription, layer, registration, or engine provider/resource;
- separate Core/PresetApplication instances do not share result, selected
  bundles, cleanup state, or diagnostics;
- `core.start()` remains runtime owner and permanent composition closure;
- diagnostics never emit or infer `2d`, `3d`, `hybrid`, or app-domain mode;
- Asyra Design keeps its default startup sequence and public import boundaries.

## Definition of Done

- the compatibility path is behaviorally unchanged;
- composition order, inputs/results/errors, failure ownership, and cleanup are
  executable contracts;
- engine selection uses only the abstract boundary and a reversible Render
  provider configuration before runtime construction;
- bundles have explicit package ownership, dependency, output, and cleanup
  contracts;
- app customization remains outside preset and uses ordinary Core APIs;
- no placeholder render-mode profile or product-mode inference exists;
- affected package, Inspector, and Asyra Design startup tests pass;
- instance-isolation and failure-cleanup tests pass;
- `yarn test:local`, `yarn lint:ci`, `yarn react:build`,
  `yarn deps:validate`, and `git diff --check origin/main...HEAD` pass;
- required live startup verification passes;
- self-review and read-only sub-agent review have no unresolved concrete issue.

## Inspector Authority

- exact flow data:
  `docs/ai/framework/plans/preset-composition-flow-inspector.data.cjs`
- interactive viewer:
  `docs/ai/framework/plans/preset-composition-flow-inspector.html`
- executable contract:
  `docs/ai/framework/plans/preset-composition-flow-inspector.contract.test.cjs`

Implementation advances one Inspector owner step at a time. This plan owns the
public product contract; the Inspector owns exact routes, implementation
allowlists, failure owners, and cleanup owners.

## Implementation Segments

1. [x] Repair plan authority and establish executable Inspector readiness.
2. [ ] Add typed input/result/error contracts and preflight validation
       test-first.
3. [ ] Extract deterministic shared groups without changing compatibility
       behavior, test-first.
4. [ ] Add reversible concrete-engine provider coordination, test-first.
5. [ ] Add deterministic package-owned bundle installation and rollback,
       test-first.
6. [ ] Publish instance-local success/diagnostics and retryable cleanup state,
       test-first.
7. [ ] Prove ordinary post-return app customization, Core startup ownership,
       Asyra Design compatibility, and package/import boundaries.
8. [ ] Synchronize docs and run bounded/root/live gates plus independent review.

Do not move this plan to `completed/` until the user reviews the implementation
and explicitly requests closeout.
