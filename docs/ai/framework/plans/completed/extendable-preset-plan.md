# Extendable Preset Relation and Unregister Plan

## Goal

Make preset defaults composable through ordinary public framework APIs before
the first `Core.start()`:

```text
applyPreset(core)
-> remove an existing relation
-> define a new relation or registration
-> optionally unregister an entire property capability
-> register app-owned load migration
-> core.start()
```

An app developer does not need preset target keys, preset internals, manual
owner metadata, or a preset-specific extension object. Removing a relation does
not claim that the old and new capabilities are equivalent.

## Status and Roadmap Position

Completed on 2026-07-17. The implementation is complete on
`codex/extendable-preset` and published for review in PR #81. This closeout
archives the accepted product contract before merge by explicit owner
direction; it does not claim that PR #81 has merged.

Generic Preset Composition is now the next separate near-term phase. Production
3D, Hybrid runtime composition, render-mode selection, and app-specific
framework policy remain outside this completed plan.

## Completion Record

- Final decision: apps customize preset defaults before first start through
  ordinary public remove, define/register, and graph-aware unregister APIs;
  neither app-facing nor shared registry contracts expose replace semantics.
- Implementation summary: Core coordinates one deterministic registration
  graph; component/property owners rebuild declarative relations; preset
  installs explicit graph-owned defaults; unregister and disposal clean only
  declared dependents and owned lifecycle resources with retryable failure
  state.
- Compatibility summary: `applyPreset(core)`, framework-facing registration
  APIs, Asyra Design startup, render-engine boundaries, and package import
  boundaries remain compatible.
- Exit criteria: all seven implementation segments, affected package/app and
  Inspector tests, root test/lint/build/dependency/diff gates, self-review, and
  read-only sub-agent review completed with no unresolved concrete finding.
- Canonical executable architecture contract:
  `docs/ai/framework/plans/extendable-preset-flow-inspector.data.cjs`.

## Scope

In scope:

- stable registration identity and queryable owner metadata;
- component-property and property-child relations;
- explicit opaque dependency declarations owned by feature, render, UI, or
  custom-constructor definitions;
- deterministic relation removal, definition, traversal, unregister, cleanup,
  results, and errors;
- public Core facades for normal app startup composition;
- compatibility for `applyPreset(core)` and existing framework-facing APIs.

Out of scope:

- runtime graph mutation after startup;
- feature runtime or property schema-model redesign;
- automatic data migration or semantic equivalence inference;
- Generic Preset Composition;
- render-engine selection, 2D/3D/Hybrid profiles, multi-engine composition, or
  product mode inferred from render-engine capabilities;
- app-specific policy in framework packages.

## Product Contract

### Startup composition

- `applyPreset(core)` installs defaults on the supplied Core instance.
- The app may then call ordinary Core `remove`, `define`, `register`, and
  `unregister` APIs.
- The first call to `core.start()` permanently closes composition mutations at
  method entry, even if later renderer initialization fails.
- Before renderer side effects, `start()` validates that every declared
  relation resolves to a registered target.
- Migration stays app-owned. File loading remains `migration -> validation ->
load`; registration mutation does not migrate persisted data.

### Operation semantics

- `remove`: remove exactly one declared relation and preserve both registration
  nodes.
- `define`: add one relation or registration after validating source, target,
  duplicate identity, and composition state.
- `unregister`: remove a registration node, every declared incoming/outgoing
  relation, and all resources owned by registrations actually removed.
- No app-facing or shared registry API accepts a `replace` operation or
  strategy. Apps express non-equivalent changes as explicit remove/unregister
  followed by define/register calls.

### Core app-facing APIs

```ts
core.defineComponentPropertyRelation(componentType, property)
core.removeComponentPropertyRelation(componentType, propertyName)
core.getComponentPropertyRelations(componentType)

core.definePropertyChildRelation(parentPropertyType, relation)
core.removePropertyChildRelation(parentPropertyType, key)

core.unregisterPropertyType(propertyType)
```

Core also exposes the existing owner APIs through its instance facade:

```ts
core.defineComponent(...)
core.unregisterComponent(...)

core.defineFeature(...)
core.unregisterFeature(...)

core.registerPropertySchema(...)
core.definePropertyComponent(...)
core.unregisterPropertyRegistration(type, scope)

core.registerRenderStrategy(...)
core.unregisterRenderStrategy(...)
core.unregisterUIProperty(...)
```

`unregisterPropertyRegistration(type, scope)` remains the low-level
schema/runtime cleanup API. `unregisterPropertyType(type)` is the graph-aware
operation that removes the complete property capability.

### Registration identity and owner metadata

The framework-neutral primitive uses small adjacency records:

```ts
interface RegistrationRef {
  kind: string
  key: string
}

interface RegistrationRelationDeclaration {
  name: string
  target: RegistrationRef
  onTargetUnregister: 'detach' | 'unregister-source'
}
```

- A node identity is the stable tuple `(kind, key)`.
- The source is derived from the owning registration definition.
- Component `properties[]` declarations create `detach` relations.
- Property `children.childType` declarations create `detach` relations.
- Opaque feature, render, UI, and custom-constructor dependencies may declare
  optional `registration.relations` on their own definitions.
- App registrations without an explicit package owner receive stable metadata
  `{ packageName: 'app', name: registrationKey }`.
- Preset/package definitions provide their own owner metadata; preset defaults
  use `@asyra/preset/default-preset`.
- Normal app code does not need to provide owner metadata or relation metadata.

### Structured operation contract

Successful relation mutations return `RelationOperationSuccess`. Successful
full unregister returns `UnregisterRegistrationSuccess`. Invalid, missing,
conflicting, closed, dangling, or cleanup states throw
`RegistrationRelationError` with one stable code:

```ts
type RegistrationContractErrorCode =
  | 'COMPOSITION_CLOSED'
  | 'REGISTRATION_NOT_FOUND'
  | 'RELATION_NOT_FOUND'
  | 'DUPLICATE_RELATION'
  | 'RELATION_TARGET_NOT_FOUND'
  | 'REGISTRATION_IN_USE'
  | 'RELATION_REMOVE_FAILED'
  | 'UNREGISTER_FAILED'
  | 'DANGLING_RELATION'
```

An unregister result reports the root registration, removed relations,
detached sources, recursively unregistered sources, removed owned
registrations, and cleanup status. Cleanup failure preserves retryable state:
completed cleanup steps do not run again, pending cleanup remains visible, and
a conflicting definition cannot be registered until cleanup succeeds. Retry
reconciles each pending relation with current adjacency: an edge already
removed through the formal API is complete, while a same-name relation now
pointing to a different target is preserved.

## Owner Contracts

### `@asyra/utils`: shared registration graph

The framework-neutral graph owns:

```text
nodesByRef
outgoingRelationsBySource
incomingRelationsByTarget
```

- Nodes and relations store stable identity, owner, policy, and package-local
  handler/locator only. Package registries remain the definition source of
  truth.
- Queries return detached, deterministically sorted metadata.
- Traversal uses sorted keys, a queue, and a visited set.
- Target unregister preflights composition state and owner handlers, handles
  incoming relations, removes outgoing relations without inferring target
  ownership, cleans owned resources in reverse order, then removes the node.
- `detach` asks the source owner to rebuild and preserve its registration.
- `unregister-source` removes the source and queues it so its formal relations
  and resources are processed recursively.
- The graph never analyzes arbitrary feature/render/custom code and never
  invents undeclared dependencies.
- If retained for package authors, `ExtensionRegistry` supports additive
  `before`, `after`, and `append` ordering only.

### `@asyra/scene-tree`: component relation owner

- `defineComponent` retains a declarative definition and automatically records
  one relation per property slot.
- Relation definition rejects pending source or target cleanup; removal rejects
  a pending source but remains available to detach from a pending target. It
  then builds the complete next definition/class and atomically updates
  component and element-property ownership indexes.
- Removing one slot preserves component identity, counters, unrelated
  properties, render ownership, and other resources.
- Adding one slot validates component existence, property runtime existence,
  and duplicate slot identity.
- Active component instances reject relation mutation before partial work.
- Component-local property maps and reverse indexes preserve the exact
  definition when different components use the same property name.

### `@asyra/props-manager`: property relation owner

- Config-mode property components retain their definition. Child relation
  definition rejects pending source or target cleanup; removal rejects a
  pending source but may detach from a pending target before rebuilding the
  runtime constructor without stale child subscriptions.
- Constructor-mode opaque dependencies are declared through local
  `registration.relations`; hard dependencies use `unregister-source`.
- Unknown property types no longer silently fall back to `CUSTOM` during the
  canonical creation/load path.
- After app migration, load validation produces a diagnostic and safely skips
  an unregistered property type.
- Active and replay-retained property instances reject unsafe relation mutation
  or unregister before partial work.

### `@asyra/core`: composition coordinator

- Core owns one graph/coordinator for its injected runtimes.
- Core routes shared-channel and data-channel observer APIs through its injected
  Factory; observer registration identity is isolated per Core instance.
- Standalone helpers continue to target the default Core compatibility
  instance by sharing its explicitly injected default observer registry; custom
  Core instances receive distinct registries, and preset installers always use
  the supplied Core facade.
- Graph-aware `unregisterPropertyType` detaches structural dependents, follows
  hard dependency policies, and cleans property schema/runtime/metadata and
  lifecycle resources.
- Only nodes actually unregistered enter recursive cleanup. For
  `Component X -> Parent P -> B`, unregistering `B` detaches `P -> B` while
  preserving `P` and `X -> P`.
- Aggregate `FILLS` and child `FILL` are separate nodes; the framework does not
  infer that both should be unregistered.

### `@asyra/preset`: explicit defaults

- `applyPreset(core)`, the dependency overload, and render-engine factory
  overload remain compatible.
- Preset exposes definitions, not app-specific extension targets.
- Rectangle, Oval, Vector, Frame, and Group are exported definitions installed
  explicitly by `applyPreset`; importing preset modules has no registration
  side effect.
- Property, component, render, feature, and UI defaults write automatic owner
  metadata and declared dependencies into the supplied Core graph.
- The compatible `defineComponent(... renderStrategy)` form creates an explicit
  render-strategy node with an `unregister-source` ownership relation to that
  component. A strategy registered separately through
  `core.registerRenderStrategy` remains independent.
- `PresetApplication.dispose()` uses the same canonical graph. Registrations
  already removed through Core are completed and are not cleaned twice. Its
  application lifetime also owns the events, selections, shared channels,
  system subscriptions, data-channel observers, and render layers installed by
  that call. Cleanup failures remain retryable and completed cleanup is not
  repeated. Graph disposal is preflighted before runtime teardown so a closed
  composition cannot partially dismantle active wiring. Shared channels and
  data-channel observers use the supplied Core/Factory instance. If apply
  rollback cleanup fails, that Core retains the pending lifetime and its next
  `applyPreset` retries cleanup before installing defaults.

### App composition

- The app selects defaults and customization sequence only.
- New features use `core.defineFeature(...)` directly.
- A relation-only customization removes old component/property relations and
  defines new relations while leaving reusable capability registrations alive.
- An app that needs no capability calls the graph-aware unregister API.
- Render/UI behavior is not inferred from structural property relations; an app
  explicitly unregisters and registers its own render/UI registrations.

Example:

```ts
applyPreset(core)

core.removeComponentPropertyRelation('rect', 'fills')
core.removeComponentPropertyRelation('oval', 'fills')

core.unregisterRenderStrategy('rect')
core.unregisterRenderStrategy('oval')
core.registerRenderStrategy('rect', whiteboardRectangleStrategy)
core.registerRenderStrategy('oval', whiteboardOvalStrategy)

core.start(...)
```

If the app has no fills capability:

```ts
core.unregisterPropertyType(PropertyTypes.FILLS)
```

## Product Cases

1. An app adds a feature through `core.defineFeature` without a preset-specific
   extension path.
2. Importing preset modules has no component-registration side effect;
   `applyPreset(core)` installs defaults in deterministic order.
3. Removing Rectangle/Oval `fills` relations preserves both components,
   Position/Dimension/Strokes relations, and the Fills capability; new
   instances no longer create fills.
4. Defining a Stroke relation after removal creates new instances from exactly
   the new relation set.
5. `unregisterPropertyType(FILLS)` removes all Fills relations and Fills-owned
   registrations while preserving structurally detached components.
6. `Component X -> Parent P -> B` detaches `P -> B` and preserves `P` plus
   `X -> P`; a hard relation recursively unregisters its source and resources.
7. Parent-child remove/define rebuilds config runtime without stale child
   subscriptions.
8. Missing registrations/relations, duplicate relations, dangling targets,
   closed composition, active usage, and cleanup failures have stable
   structured errors and retry semantics.
9. Feature unregister removes queued handlers, sessions, listeners, and
   subscriptions without stale behavior.
10. Direct Core unregister followed by `PresetApplication.dispose()` does not
    perform owned cleanup twice; late apply failure and disposal remove runtime
    events, selections, channels, subscriptions, observers, and layers without
    stale callbacks, and retry only pending cleanup. If apply rollback cleanup
    itself fails, the next apply on that Core first resumes the old pending
    cleanup.
11. Migration runs before validation; migrated data loads, while an unknown
    unregistered property type is diagnosed and skipped instead of becoming
    `CUSTOM`.
12. Existing `applyPreset(core)`, Asyra Design startup, engine boundaries, and
    monorepo import boundaries remain compatible; inline component render
    strategy ownership cleans deterministically while separately registered
    strategies remain independent, and no path infers product mode.

## Definition of Done

- Public relation/unregister APIs, metadata, results, errors, ownership, and
  startup lock are documented and covered by formal tests.
- Each production segment first proves that current behavior lacks its product
  case, then implements only the matching Inspector owner step.
- Ordering and recursive traversal are deterministic across repeated runs.
- Unregister, partial cleanup retry, direct Core cleanup, and preset disposal
  leave no observers, handlers, subscriptions, registrations, or stale effects.
- Affected utils/core/scene-tree/props-manager/ui-context/render/
  feature-system/preset tests, Inspector tests, and Asyra Design tests pass.
- `yarn test:local`, `yarn lint:ci`, `yarn react:build`, `yarn deps:validate`,
  and `git diff --check origin/main...HEAD` pass.
- Self-review and a read-only sub-agent review find no unresolved concrete
  defect.

## Inspector Authority

- exact flow data:
  `docs/ai/framework/plans/extendable-preset-flow-inspector.data.cjs`
- interactive viewer:
  `docs/ai/framework/plans/extendable-preset-flow-inspector.html`
- executable contract:
  `docs/ai/framework/plans/extendable-preset-flow-inspector.contract.test.cjs`

Implementation advances one Inspector owner step at a time. The Inspector owns
exact execution routes and implementation allowlists; this plan owns bounded
product behavior.

## Implementation Segments

1. [x] Repair this plan and Inspector authority.
2. [x] Add the shared registration graph and structured contract test-first.
3. [x] Add component-property and property-child owner mutations test-first.
4. [x] Add Core coordination, recursive unregister, dangling validation, and
       permanent startup closure test-first.
5. [x] Convert preset defaults to explicit installation and remove preset-specific
       app extension surfaces test-first.
6. [x] Synchronize app/framework/package docs and migration guidance.
7. [x] Run bounded and root gates, then self-review and read-only sub-agent
       review.
