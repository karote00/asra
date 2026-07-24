# Canvas Pipeline Debugger Plan

## Status and Authority

Completed on 2026-07-18. PR #83 merged the optional Canvas Pipeline Debugger
to `main` at merge commit
`77026a8d79a22bcb8ed22d3ff8f6a99f660343ec`.

The debugger remains a development-runtime diagnostic surface only. It stops
at deterministic, engine-neutral pre-handoff evidence and does not claim pixel,
hit-test, concrete-engine, or product-data authority.

The exact owner flow remains defined by
`docs/ai/framework/plans/canvas-pipeline-debugger-flow-inspector.data.cjs`.

## Completion Record

- Final decision: keep one optional, disabled-by-default Core facade for app
  developers to inspect canonical Render inputs, layer evaluation, bounded
  trace data, and focused expected-geometry projection during DEV runtime.
- Implementation summary: Render owns instance-bound observation and detached
  pre-engine evidence; the optional Render subpath owns deterministic trace and
  non-interactive overlay projection; Core owns session lifecycle; Asyra Design
  owns DEV-only loading, console exposure, HMR disposal, and production bypass.
- Compatibility summary: the Core and Render roots remain free of debugger
  exports, engine boundaries remain unchanged, and no debugger data enters
  persistence, undo/redo, collaboration, export, hit testing, or canonical
  product rendering.
- Exit criteria: PR #83 validation passed; package, app, root, lint, build,
  dependency, Inspector, production-exclusion, and diff gates passed; bounded
  reviews found no unresolved concrete issue; synchronized live-app review
  confirmed an observed focused projection and readable debugger-only overlay
  with no retained fault.
- Canonical executable architecture contract:
  `docs/ai/framework/plans/canvas-pipeline-debugger-flow-inspector.data.cjs`.

## Product Contract

Canvas Pipeline Debugger is an optional framework diagnostic surface for app
developers during development runtime. It reports whether canonical render
input reached `@asyra/render`, how registered layers were evaluated, and which
engine-neutral values were handed to a render engine. It does not prove that
pixels appeared or that a concrete engine behaved correctly.

The debugger is not an E2E harness, a product authoring feature, a document
authority, or a render-engine debugger. Its trace and overlay are transient,
instance-bound, deterministic projections that no canonical product path may
consume.

## Supported Runtime Behavior

- Observe canonical element add, update, and remove input at the Render owner.
- Observe Render-owned viewport pan, zoom, zoom-center, and resize input.
- Observe registered layer order and whether each layer was bypassed,
  unchanged, or changed in a Render frame.
- Observe normalized engine-neutral command data immediately before the engine
  handoff, without exposing opaque handles or engine results.
- Keep a bounded trace and immutable snapshot for the active debugger session.
- Expose frame, layer, handoff, and dropped-count HUD data through the runtime
  snapshot/console handle, and draw optional expected geometry for
  developer-focused elements through a non-interactive Render layer.

Unsupported behavior:

- pixel, GPU, native surface, or concrete-engine inspection;
- hit testing, pointer targeting, or interaction validation;
- Pixi objects, engine handles, engine queries, or engine results;
- Scene Tree or Props Manager reads used to reconstruct missing render data;
- fallback or debug geometry used in place of missing canonical output;
- persistence, undo/redo, collaboration, export, or product-state mutation.

## Public Contract

Apps import only `@asyra/core/canvas-pipeline-debugger` and call
`createCanvasPipelineDebugger(core, options)`. The root Core and Render entries
do not re-export or import the optional debugger implementation.

Options:

- `enabled?: boolean`, default `false`;
- `traceCapacity?: number`, default `256`, and required to be a positive integer;
- `overlay.visible?: boolean`, default `true`;
- `overlay.focusedElementIds?: readonly string[]`, default empty.

The returned `CanvasPipelineDebugger` exposes:

- `enable()`, `disable()`, and `isEnabled()`;
- `setOverlayVisible(visible)`;
- `setFocusedElementIds(ids)`;
- `getSnapshot()` and `getTrace()`;
- `clearTrace()`;
- idempotent `dispose()`.

Trace entries form an exported discriminated union with `element-input`,
`viewport-input`, `layer-evaluation`, `engine-handoff`, and `frame` kinds. Every
entry has a monotonically increasing session sequence and applicable Render
frame id. Trace data contains no wall-clock time, random identity, opaque engine
handle, hit-test data, or engine result.

`CanvasPipelineSnapshot.fault` is `null` before a debugger failure and otherwise
contains the latest debugger-session failure message from observation,
normalization, subscriber, or overlay projection failure. Re-enabling
observation clears the retained fault. The field is diagnostic-only and never
captures a concrete engine failure or result.

Focused ids are deduplicated while preserving first-seen input order. A focused
id without observed canonical render data is reported as `not-observed`; the
debugger must not infer geometry from another package.

## Package Ownership And Boundaries

- `@asyra/render` owns per-instance layer registration, canonical observation
  points, frame ids, layer outcomes, and normalization of pre-engine handoff
  evidence. With no observer, the hook returns before allocating a diagnostic
  payload.
- `@asyra/render/canvas-pipeline-debugger` owns the bounded trace, immutable
  snapshot/HUD model, focused projection, debugger-owned Render objects, and
  overlay update/disposal behavior. The overlay uses existing graphics
  primitives only; the debugger does not add a text primitive to the engine
  contract or create a DOM/Pixi fallback HUD.
- `@asyra/core/canvas-pipeline-debugger` owns the app-facing session facade. It
  binds one explicit Core instance to the Render debugger and supplies
  `core.registerRenderLayer()` / `core.unregisterRenderLayer()` callbacks.
- Asyra Design owns DEV-only dynamic import, the console handle, and HMR
  cleanup. Production app wiring bypasses the debugger entirely.
- `@asyra/render-engine` and `@asyra/render-engine-pixi` are unchanged. Pixi may
  exist only in `@asyra/render-engine-pixi`.

One debugger session may be active for a Render instance. Independent Render
instances have independent layer registries, observers, traces, and overlays.
After disposal, the same Render instance may create another session.

## Runtime And Cleanup Lifecycle

Creation validates options but performs no observation or layer registration
when disabled. `enable()` subscribes to the instance-bound observation hook and,
when visible, creates and registers the debugger-owned overlay through the Core
facade. Repeated enable and disable calls are idempotent.

`disable()` unsubscribes observation, unregisters and destroys the owned overlay,
and preserves the latest trace and snapshot for inspection. Changing overlay
visibility while disabled applies on the next enable. `dispose()` performs the
same cleanup, clears trace/snapshot/focus data, and releases the active-session
slot. Calls other than `dispose()` after disposal throw a stable disposed error.

Diagnostic subscriber or overlay projection failure is owned by the debugger:
it is recorded in `snapshot.fault` before cleanup, contained, disables that
session, and must not block, rewrite, retry, or provide fallback output for
canonical rendering. A concrete engine handoff failure remains owned by the
existing render-engine boundary.

## Product Cases

1. Disabled baseline: creating the debugger produces no trace, observer, layer,
   or overlay.
2. Runtime trace: enable records deterministic element, viewport, layer, frame,
   and pre-engine handoff evidence in order.
3. Focused projection: observed bounds and transforms project through the
   observed viewport; unknown ids remain `not-observed` with no geometry.
4. Capacity boundary: the oldest entry is dropped and the dropped count
   increments when capacity is exceeded.
5. Lifecycle: disable removes the overlay and stops new records while preserving
   reads; dispose clears all session data; recreation succeeds.
6. Isolation: two Render instances cannot observe or register each other's data;
   duplicate sessions on one instance fail deterministically.
7. Fault containment: observation and overlay projection failures are retained
   in `snapshot.fault`, disable only the debugger, and canonical rendering
   continues without diagnostic fallback.
8. Production bypass: Asyra Design production output contains no optional
   debugger implementation or overlay chunk.

## Definition Of Done

- The public contract is available only through the Core optional subpath.
- The dedicated Canvas Pipeline Inspector maps every owner and route exactly.
- Formal Render, debugger, Core, and app integration tests cover the product
  cases; no debugger E2E harness is introduced.
- Overlay source-space tests prove expected projection. Visual review verifies
  overlay readability only and does not claim engine pixel correctness.
- Inspector, affected package/app tests, root tests, lint, build, dependency
  boundary, production exclusion, and focused diff gates pass.

## Inspector Authority

- Inspector data:
  `docs/ai/framework/plans/canvas-pipeline-debugger-flow-inspector.data.cjs`
- Direct-open Inspector:
  `docs/ai/framework/plans/canvas-pipeline-debugger-flow-inspector.html`
- Contract gate:
  `docs/ai/framework/plans/__tests__/canvas-pipeline-debugger-flow-inspector.contract.test.cjs`

The product contract owns runtime behavior and public semantics. The Inspector
owns package and data-flow boundaries. Tests own executable evidence.
