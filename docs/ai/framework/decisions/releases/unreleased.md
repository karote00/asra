# Unreleased Decision History

Decision log for branch-level and post-release work not yet shipped in a tagged framework release.

Append-only rule: only append new entries at the end; do not edit/delete or insert in the middle. Add a superseding entry when decisions change.
Backfilled entries use decision dates inferred from related commit dates/ranges.

## 2026-01-29..2026-02-02 - Branch backfill: app-layer owns interaction policy

- Context:
  - Early branch work moved interaction/event behavior away from framework-internal policy logic.
- Decision:
  - Keep interaction-core/framework runtime utilities available, but move workflow/decision policy to app/common API layers.
- Consequences:
  - Framework packages became more infra-oriented.
  - App-level composition became the expected place for behavior decisions.
- Related Plan:
  - `docs/ai/framework/PLANS.md`
- Related Commit(s):
  - `6da4419` (`feat(interaction-core): extract interaction registry and expose via core`)
  - `4251bb8` (`refactor(interaction-core): move interaction initialization to app level`)
  - `1cace83` (`feat: transform @asyra from library to extensible framework`)
  - `98092a1` (`refactor: move all rules and behaviors from framework to app`)

## 2026-02-03..2026-02-07 - Branch backfill: feature-system became primary runtime flow

- Context:
  - Branch introduced staged feature-system implementation and migration of tool flows.
- Decision:
  - Use feature-system execution/session model as primary path for feature behavior.
  - Remove backward-compat builder/workflow patterns during migration cleanup.
- Consequences:
  - Feature behavior became more explicit (priority/exclusive/session contracts).
  - Legacy paths were reduced to lower maintenance/ambiguity.
- Related Plan:
  - `docs/ai/framework/PLANS.md` (interaction-core retirement)
- Related Commit(s):
  - `b9c58e3` (`impl: Phase 1 - Core Feature System (foundation)`)
  - `fa14376` (`impl: Phase 2 - Core Integration`)
  - `4e034d4` (`impl: Phase 3-4 - Micro-Features and Templates`)
  - `5a44013` (`impl: Phase 5 - Migration Examples and Proof-of-Concept Features`)
  - `468c0c1` (`refactor: remove deprecated feature-builder module`)

## 2026-02-08..2026-02-09 - Branch backfill: renderer/input events integrated for feature runtime

- Context:
  - Feature execution required richer input/render event coverage and cleaner event mapping.
- Decision:
  - Add renderer event channels and adapter paths for pointer-driven interactions.
  - Continue deprecating older interaction-event coupling paths.
- Consequences:
  - Feature-system received stronger event inputs for hover/pointer workflows.
  - Event routing became less tied to older interaction-core assumptions.
- Related Plan:
  - `docs/ai/framework/plans/completed/events-and-registry.md`
- Related Commit(s):
  - `3ffd083` (`feat: add renderer events to reactive-events`)
  - `5312b41` (`feat: implement renderer adapter for Pixi pointer events`)
  - `5aef7d7` (`feat: add renderer event support for feature-system and split leave-element`)
  - `1e8af34` (`refactor: remove deprecated create-element events from interaction events`)

## 2026-02-09..2026-02-11 - Branch backfill: transaction and persistence plumbing hardened

- Context:
  - Transaction commit wiring and persistence boundaries needed clearer infrastructure contracts.
- Decision:
  - Tighten transaction publish/start/end usage across runtime flows.
  - Adopt renderer/persistence provider integration patterns and simplify persistence hooks structure.
- Consequences:
  - Undo/redo and change tracking paths became more consistent.
  - Persistence integration moved toward replaceable provider architecture.
- Related Plan:
- `docs/ai/framework/plans/completed/undoable-option-support-plan.md`
- Related Commit(s):
  - `4aa7a6d` (`fix: transactionApis should call startTransaction/endTransaction, not subscribe`)
  - `9fd9fbe` (`fix: add transaction publishing to interaction-core for proper undo stack`)
  - `286246a` (`fix: use nested transactions in create-element (updateTransaction pattern)`)
  - `01ff1db` (`feat: implement render swappable and persistence provider pattern`)
  - `73dfc1e` (`refactor: improve persistence architecture and fix transaction tracking`)
  - `5bce234` (`refactor: simplify persistence package build and restructure hooks`)

## 2026-02-14..2026-02-15 - Branch backfill: component system generalized via registries + defineComponent

- Context:
  - Framework needed extensible component registration and dynamic props scaffolding beyond fixed built-ins.
- Decision:
  - Build component/property/render registration infrastructure and integrate through core-facing define APIs.
- Consequences:
  - New component types became framework-extensible with registry-driven contracts.
  - Built-ins could migrate onto shared define/registry pathways.
- Related Plan:
  - `docs/ai/framework/plans/completed/architecture-and-bootstrap.md`
- Related Commit(s):
  - `8951550` (`refactor(utils): Phase 1 - convert enums to string types for framework extensibility`)
  - `c01c569` (`feat(props-manager): Phase 2 - property registration system`)
  - `afbd4c7` (`feat(scene-tree): Phase 3 & 4 - component registry and dynamic props`)
  - `3d2a37b` (`Phase 5: Implement Render Strategy Registry`)
  - `82e6aa6` (`Phase 6: Core Integration - defineComponent API`)
  - `40b170b` (`Complete: Custom Component System Refactoring`)
  - `7e53981` (`refactor: migrate built-in components to defineComponent API`)

## 2026-02-19..2026-02-20 - Branch backfill: pen/vector stack formalized with render-layer integration

- Context:
  - Pen/vector capability required coordinated component model, render-layer behavior, and feature/tool flow.
- Decision:
  - Implement vector/pen phases and then route render-layer registration through core/render abstraction paths.
- Consequences:
  - Vector editing became a first-class workflow with clearer render-layer ownership boundaries.
  - Non-core callers rely more on core/render registration surfaces instead of engine-coupled paths.
- Related Plan:
- `docs/ai/framework/plans/completed/framework-enhancement-custom-graphics.md`
- Related Commit(s):
  - `de58ee6` (`feat(Phase 2): Add Vector (Pen Tool) component with support for anchor points and bezier curves`)
  - `760baa5` (`feat(Phase 3): Implement full Pen Tool feature with E2E tests`)
  - `be5b162` (`refactor: stabilize pen/vector workflow and rendering`)
  - `5c3ea9f` (`refactor: unify render-layer API through core and decouple pixi usage`)
  - `9249af8` (`refactor: route render-layer registration through render`)

## 2026-02-20..2026-02-22 - Branch backfill: vector/path-editing model evolved around props and multi-path flows

- Context:
  - Vector editing required stronger state modeling for anchor points and path-session behavior.
- Decision:
  - Move anchor-point data modeling further into props-oriented components and extend editing behavior to multi-path flows.
- Consequences:
  - Vector/path-editing runtime gained more explicit data/state paths for feature logic and rendering.
- Related Plan:
- `docs/ai/framework/plans/completed/props-manager-typed-setter-refactor-plan.md`
- Related Commit(s):
  - `d1e4653` (`refactor(vector): move anchor points to props components`)
  - `5d7af5d` (`feat: multi-path vector editing`)

## 2026-02-20..2026-02-22 - Branch backfill: selection/hover and numeric property edits hardened

- Context:
  - Editing/selection UX paths had correctness gaps (hover hit-test behavior, numeric edit validation/load robustness).
- Decision:
  - Use bounds/container API path for hover hit-test and harden numeric property edit/load validation paths.
- Consequences:
  - Reduced ambiguous hover/selection behavior and improved safety for numeric property writes/loads.
- Related Plan:
- `docs/ai/framework/plans/completed/hover-hit-test-performance-plan.md`
- Related Commit(s):
  - `9dfbf54` (`fix: hover hit-test via bounds and core container api`)
  - `ae79c0c` (`fix(props): validate numeric edits and harden component loads`)

## 2026-02-23..2026-02-28 - Branch backfill: registry infrastructure centralized in utils

- Context:
  - Multiple packages had repeated map-like registry patterns.
- Decision:
  - Use shared registry infrastructure from `@asyra/utils` as the common base for map-like registries.
- Consequences:
  - Registry behavior and extension points are easier to keep consistent across packages.
- Related Plan:
  - `docs/ai/framework/plans/completed/events-and-registry.md`
- Related Commit(s):
  - `c14326a` (`refactor(registry): extract shared map registry utility`)
  - `960e663` (`refactor(registry): enforce strict duplicate-key registration`)

## 2026-02-24 - Branch backfill: framework docs are source-of-truth contracts

- Context:
  - Branch introduced and expanded framework-level docs, routing, and rule contracts.
- Decision:
  - Treat `docs/ai/framework/*` as implementation contracts (not optional notes).
  - Keep explicit routing across essentials, workflow, package docs, and rules.
- Consequences:
  - Framework changes are expected to ship with synchronized docs.
  - Request handling and ownership decisions are more deterministic.
- Related Plan:
  - `docs/ai/framework/PLANS.md`
- Related Commit(s):
  - `0f4d081` (`docs(framework): establish framework source-of-truth context`)

## 2026-02-24 - Branch backfill: interaction-core is compatibility-only

- Context:
  - Runtime ownership needed clear deprecation signaling to avoid parallel interaction runtimes.
- Decision:
  - Keep `@asyra/interaction-core` available for compatibility, but mark it as deprecated and non-owner for new runtime flow.
- Consequences:
  - New interaction/runtime work should target `@asyra/feature-system`.
  - Retirement path for interaction-core remains active but controlled.
- Related Plan:
  - `docs/ai/framework/PLANS.md` (interaction-core retirement)
- Related Commit(s):
  - `0931cdb` (`chore(interaction-core): formalize deprecation signals`)

## 2026-02-25 - Branch backfill: mutation options flow through full mutation pipeline

- Context:
  - Undoability and mutation semantics needed end-to-end propagation from app/common APIs into framework packages.
- Decision:
  - Propagate mutation options through core APIs, events, and downstream managers/handlers.
- Consequences:
  - Transaction/undo behavior can be controlled consistently at API call boundaries.
- Related Plan:
- `docs/ai/framework/plans/completed/undoable-option-support-plan.md`
- Related Commit(s):
  - `3628d3e` (`feat(framework): propagate mutation options through mutation pipeline`)

## 2026-02-26 - Branch backfill: load diagnostics became first-class hook pipeline

- Context:
  - Load validation needed non-blocking diagnostics visibility for apps.
- Decision:
  - Add load diagnostics hook pipeline in core and wire app-level reporting path.
- Consequences:
  - Load safety remains validator-owned while app receives actionable diagnostics after apply.
- Related Plan:
- `docs/ai/framework/plans/completed/props-manager-file-load-validation-plan.md`
- Related Commit(s):
  - `449cb77` (`feat(framework): add load diagnostics pipeline and app-level reporting hook`)

## 2026-02-27 - Branch backfill: framework defaults moved to explicit preset apply

- Context:
  - Implicit framework defaults in core made ownership and startup behavior less explicit.
- Decision:
  - Move default builtins/registrations into preset and require explicit preset application.
- Consequences:
  - Core stays more orchestration-focused and app startup contracts are clearer.
- Related Plan:
  - `docs/ai/framework/plans/completed/architecture-and-bootstrap.md`
- Related Commit(s):
  - `c68c27b` (`refactor framework defaults into preset and finalize plan cleanup`)

## 2026-02-27 - Branch backfill: property runtime shifted to declarative config and ID-first patterns

- Context:
  - Property-component runtime had higher complexity and mixed registration patterns.
- Decision:
  - Favor declarative property-component definitions and ID-first property relationships/access paths.
- Consequences:
  - Property runtime behavior is more standardized and easier to evolve across components/features.
- Related Plan:
  - `docs/ai/framework/plans/completed/property-runtime.md`
- Related Commit(s):
  - `d9b9df0` (`refactor property component runtime to declarative config and id-first APIs`)

## 2026-02-27 - Branch backfill: preset event registration moved to typed-definition flow

- Context:
  - Event registration needed consistent typed definitions and preset-owned event namespaces.
- Decision:
  - Use preset event registration flow through typed definitions and core registration surface.
- Consequences:
  - Event contracts are easier to audit and safer to evolve without reactive-events taking domain ownership.
- Related Plan:
  - `docs/ai/framework/plans/completed/events-and-registry.md`
- Related Commit(s):
  - `901fccd` (`feat(preset): add preset event registration flow`)
  - `13ffaa7` (`feat(events): register preset events via typed definitions`)

## 2026-02-27 - Preset-owned event contract clarified

- Context:
  - Event ownership and registration responsibilities needed explicit boundaries between preset and reactive-events.
- Decision:
  - Preset owns event names/definitions.
  - `@asyra/reactive-events` remains infrastructure-only (registry + publish/subscribe machinery).
  - Core keeps `registerEvent(event: string | EventDefinition)` API.
- Consequences:
  - Event naming remains domain-owned and migration-safe.
  - Reactive-events avoids policy/domain ownership drift.
- Related Plan:
  - `docs/ai/framework/plans/completed/events-and-registry.md`
- Related Commit(s):
  - `266e42e` (`docs(framework): align event registration contracts`)

## 2026-02-28 - Registry duplicate-key policy is strict fail-fast

- Context:
  - Registry behavior diverged across packages (`override`, `return-existing`, custom checks).
  - This created hidden replacement semantics and unpredictable registration outcomes.
- Decision:
  - Shared registry register path rejects duplicate keys (throws).
  - Package registries use explicit duplicate error messages.
- Consequences:
  - Duplicate registration bugs fail early and are easier to detect.
  - Callers must explicitly unregister before re-registering.
- Related Plan:
  - `docs/ai/framework/plans/completed/events-and-registry.md`
- Related Commit(s):
  - `960e663` (`refactor(registry): enforce strict duplicate-key registration`)

## 2026-02-28 - Add post-action completion event plan

- Context:
  - Apps need a deterministic hook after one user action unit is finalized in transaction/undo pipeline.
- Decision:
  - Plan to publish a "user action done" event after `DataTransact.commitUndo()` finalizes an action unit.
  - Expose subscribe path through core API.
- Consequences:
  - Enables deterministic post-action side effects from app layer.
  - Keeps runtime transaction boundary semantics explicit.
- Related Plan:
- `docs/ai/framework/plans/completed/user-action-completion-event-plan.md`
- Related Commit(s):
  - `6843da6` (`docs(plans): add user-action completion event plan`)

## 2026-02-28 - Adopt global decision-history model (framework scope alignment)

- Context:
  - Decision history needs a common model across framework and app docs.
- Decision:
  - Keep framework decision log in `docs/ai/framework/decisions/releases/*`.
  - Align framework decision rules with global governance in `docs/ai/decisions/README.md`.
  - Use cross-cutting stream `docs/ai/decisions/releases/*` for framework+app decisions.
- Consequences:
  - Framework rationale remains locally discoverable while following one repo-wide process.
  - Cross-scope decisions no longer need to be forced into framework-only logs.
- Related Plan:
  - `docs/ai/framework/PLANS.md`
- Related Commit(s):
  - pending

## 2026-02-28 - Reprioritize app-level migration plan to lowest priority

- Context:
  - App-level migration formalization is valuable but currently lower urgency than remaining near-term runtime contract work.
- Decision:
  - Move "App-level migration pipeline formalization" from near-term to deferred as the lowest-priority item.
  - Set current pickup to "Unit-aware property model" after verification it is not fully implemented.
- Consequences:
  - Near-term focus stays on unfinished runtime/data semantics work.
  - Migration formalization remains tracked without blocking higher-priority delivery.
- Related Plan:
  - `docs/ai/framework/PLANS.md`
- Related Commit(s):
  - pending

## 2026-02-28 - Reprioritize unit-aware property model to lowest priority

- Context:
  - Unit-aware model work is closely tied to future auto-layout evolution and is lower urgency for current branch priorities.
- Decision:
  - Move "Unit-aware property model" from near-term to deferred as the lowest-priority item.
  - Set current pickup to "UI aggregate helpers" as the next verified not-fully-implemented plan.
- Consequences:
  - Near-term plan queue focuses on non-auto-layout immediate UX/runtime hooks.
  - Unit-aware work remains explicitly tracked for later auto-layout-aligned phase.
- Related Plan:
  - `docs/ai/framework/PLANS.md`
- Related Commit(s):
  - pending

## 2026-02-28 - Reprioritize UI aggregate helpers to lowest priority and switch pickup

- Context:
  - UI aggregate helper expansion (especially mixed-unit handling) is also tied to auto-layout-related behavior and can wait behind immediate event/runtime hooks.
- Decision:
  - Move "UI aggregate helpers" from near-term to deferred as the lowest-priority item.
  - Set current pickup to "User-action completion event after transaction undo-commit."
- Consequences:
  - Immediate focus shifts to deterministic post-action event signaling.
  - Auto-layout-adjacent aggregation work remains tracked but deprioritized.
- Related Plan:
  - `docs/ai/framework/PLANS.md`
- Related Commit(s):
  - pending

## 2026-02-28 - Global decision-history standard established across framework/apps

- Context:
  - Decision history process needed one shared model spanning framework, app, and cross-cutting scopes.
- Decision:
  - Establish global governance docs in `docs/ai/decisions/*` and wire framework/app docs to this standard.
- Consequences:
  - Decision recording is consistent across scopes and scales with future framework-based products.
- Related Plan:
  - `docs/ai/framework/PLANS.md`
- Related Commit(s):
  - `4d0e3a3` (`docs(decisions): establish global decision-history standard`)

## 2026-02-28 - Reprioritize auto-layout-related plan items

- Context:
  - Auto-layout-adjacent work needed lower urgency than immediate runtime/event boundary work.
- Decision:
  - Move auto-layout-related items to deferred lowest-priority positions.
- Consequences:
  - Near-term planning shifted toward event/runtime behavior that unblocks app-side integration.
- Related Plan:
  - `docs/ai/framework/PLANS.md`
- Related Commit(s):
  - `7a0237a` (`docs(plans): reprioritize auto-layout-related items`)

## 2026-02-28 - User-action completion event shipped through reactive-events

- Context:
  - Apps needed deterministic post-action hooks when undo-commit finalizes one action unit.
- Decision:
  - Publish `userActionCompleted` from `DataTransact.commitUndo()` via `@asyra/reactive-events`.
  - Keep app-facing subscription through core event APIs.
- Consequences:
  - Post-action integrations can subscribe without coupling to factory internals.
  - Undo/redo transaction boundaries remain intact while exposing completion timing.
- Related Plan:
- `docs/ai/framework/plans/completed/user-action-completion-event-plan.md`
- Related Commit(s):
  - `8ef6935` (`feat(events): publish user-action completion via reactive-events`)

## 2026-02-28 - Event boundary updated: reactive-events is canonical for common events

- Context:
  - Event ownership split between preset and reactive-events became inconsistent and hard to reason about.
- Decision:
  - Treat `@asyra/reactive-events` `EventTypes` as canonical names for common framework events.
  - Keep `preset` registration-only and remove duplicated event-name declarations.
  - Remove stale commented-out event placeholders.
- Consequences:
  - Event boundaries are clearer: shared contracts in reactive-events, bootstrap defaults in preset.
  - Maintenance burden drops by avoiding duplicate event catalogs.
- Related Plan:
  - `docs/ai/framework/plans/completed/events-and-registry.md`
- Related Commit(s):
  - `bc9b68e` (`refactor(events): align preset registration with reactive event types`)

## 2026-02-28 - Core cascade unregister flow is declarative and owner-safe

- Context:
  - Unregistering components and dependent registrations needed deterministic ordering and stricter ownership boundaries to avoid partial cleanup drift.
- Decision:
  - Adopt declarative cascade unregister orchestration in core registration flow.
  - Keep unregister responsibilities explicit per owner registry path instead of ad-hoc cross-calls.
- Consequences:
  - Component/property cleanup order is predictable and easier to reason about.
  - Duplicate/stale registration cleanup regressions are less likely during refactors.
- Related Plan:
  - `docs/ai/framework/plans/completed/cascade-unregister-plan.md`
- Related Commit(s):
  - `2ee5fdd` (`refactor(core): add declarative cascade unregister orchestration`)

## 2026-03-02 - Vector topology persistence formalized as typed children properties

- Context:
  - Topology runtime data (`points/segments/networks`) was being stored as generic custom blobs, which bypassed typed property-component validation/load behavior.
  - App topology refactor required stable id-type tracking and consistent load-safe behavior for child geometry records.
- Decision:
  - Add dedicated property types for vector topology (`vectorPoint(s)`, `vectorSegment(s)`, `vectorNetwork(s)`).
  - Register schemas for these property types in preset property schema registration.
  - Introduce a reusable children-map property-component base and use it for vector topology collection properties.
  - Export shared topology id types from core (`tp`/`ts`/`tn`) and use them in property component id handling.
- Consequences:
  - Vector topology data is now schema-validated and load-safe through first-class property components.
  - Framework has a reusable pattern for other map-of-child property structures.
  - App/vector code can rely on shared compact topology id contracts.
- Related Commit(s):
  - `2a8a8e8` (`refactor(vector): formalize topology props and feature-scoped drag thresholds`)

## 2026-03-02 - Input-system drag move button detection now uses `event.buttons`

- Context:
  - Pointer move handling could lose active button identity during drag when relying only on `event.button`, causing inconsistent move-key matching.
- Decision:
  - Resolve move button from `event.buttons` bitmask first, with fallback to `event.button`.
- Consequences:
  - Drag move key matching is more consistent across browsers/events while preserving fallback behavior.
- Related Commit(s):
  - `2a8a8e8` (`refactor(vector): formalize topology props and feature-scoped drag thresholds`)

## 2026-03-02 - Preset vector editing overlay shows localized handle controls

- Context:
  - The preset vector path-editing overlay previously rendered all handle controls for all anchors, which reduced editing clarity on dense vectors.
- Decision:
  - Restrict overlay handle rendering to selected-anchor neighborhood (`n-1`, `n`, `n+1`) within the same subpath.
  - Keep anchor/segment/preview rendering behavior unchanged.
- Consequences:
  - Preset overlay behavior is more focused for active point editing while preserving existing curve draw semantics.
- Related Commit(s):
  - `5933af4` (`feat(pen): show curve handles only around selected anchor neighborhood`)

## 2026-03-02 - Props-manager pending change buffer is cleaned at transaction end

- Context:
  - Property updates can enqueue `propsManager.changes` even when scene-tree transaction commits are the active write path for the same action.
  - Without boundary cleanup, stale pending changes can leak into later actions.
- Decision:
  - Clean `propsManager.changes` on `endTransaction` in props-manager subscribe initialization.
  - Route add/remove property subscribe commit path through `propsManager.commitChanges(options)` to keep commit + cleanup behavior consistent.
- Consequences:
  - Pending property change buffers no longer persist across action boundaries.
  - Transaction history remains single-source without duplicate write emission.

## 2026-03-02 - Scene-tree removal contract moved to parentId-driven internal routing

- Context:
  - Element deletion flow required app-side parent/index lookup, which leaked tree-structure details outside scene-tree and increased stale-index risk.
  - Undo/delete regressions exposed coupling between app preflight checks and scene-tree structural operations.
- Decision:
  - Persist `parentId` on scene-tree elements as part of element attrs/raw data contract.
  - Move remove routing ownership into scene-tree:
    - remove API resolves parent/container internally
    - validates membership internally
    - no longer requires caller-provided `index`
  - Update remove event payload contract to drop `index` and keep `data` + optional `parent`.
  - Remove load-time parent resync pass and trust persisted `parentId` during load.
- Consequences:
  - App/common APIs no longer compute parent index for removal.
  - Remove flow is less error-prone and easier to maintain across undo/redo paths.
  - Scene-tree load path remains deterministic without post-load parent mutation side effects.
- Related Commit(s):
  - `5e3296d` (`feat(asyra-design): finalize delete flow and scene-tree remove contracts`)

## 2026-03-03 - Selection runtime generalized to channel-first vector point/segment ownership

- Context:
  - Selection runtime was still element-biased while vector selection needs independent channels with concurrent selection support.
  - Legacy `VertexSelection` naming/contract no longer matched current vector point/segment architecture.
- Decision:
  - Extend framework selection contracts/events/core APIs to first-class `VECTOR_POINT` and `VECTOR_SEGMENT` channels.
  - Implement dedicated selection classes/subscribes for point/segment channels in `@asyra/selection`.
  - Remove legacy `VertexSelection` path with no backward-compat compatibility layer.
  - Keep channel updates independent so element/point/segment can coexist for future multi-selection behavior.
- Consequences:
  - SelectionManager now scales as a true multi-channel owner instead of element-only specialization.
  - App/ui/render integrations consume the same channelized selection event model.
  - Legacy vertex naming is eliminated, reducing contract ambiguity.

## 2026-03-03 - Render subscription ownership moved out of `@asyra/render` into preset defaults

- Context:
  - Render-side YJS/system subscriptions were hardcoded in render package internals.
  - This reduced user ability to customize observer flow without editing framework package code.
- Decision:
  - Remove render package `subscribes` initialization ownership.
  - Move render YJS observer registration lifecycle to core (`define/register/unregister` observer APIs).
  - Move default scene-tree/selection YJS observer definitions and default render system subscriptions (`zoom`, `viewportPosition`) into preset initialization.
  - Keep render package focused on rendering/stores and expose store-level update surfaces for external registration wiring.
- Consequences:
  - Users can redefine render subscription flow through preset/core registration APIs without touching render internals.
  - Preset remains the default-settings layer for quick-start behavior while preserving override paths.

## 2026-03-03 - Shared data-channel routing standardized to explicit `options.shared`

- Context:
  - Transaction shared-write routing previously depended on payload `owner`, which coupled shared behavior to event payload internals.
  - Render observers needed channel-name registration without direct YJS instance usage.
- Decision:
  - Treat transaction writes as local by default.
  - Append shared YJS changes only when `updateTransaction` options provide `shared` channel name.
  - Register built-in shared channels in factory (`sceneTree`, `selection`, `props`) and route default scene-tree/selection/props commits with explicit shared channel metadata.
  - Move render observer binding to channel-based contract (`name + channel + onChange`) so preset/app code registers handlers by channel name only.
  - No backward-compat owner-based shared routing path.
- Consequences:
  - Shared/local behavior is explicit and configurable through channel registration.
  - Render/preset integrations no longer require direct YJS array access.
  - Unknown shared channel names safely remain local-only.

## 2026-03-03 - Default shared data-channel registration ownership moved to preset

- Context:
  - Initial shared-channel implementation registered default channels inside factory constructor.
  - This blurred ownership between runtime registry infra and default initialization policy.
- Decision:
  - Keep factory as shared-channel registry/runtime owner only.
  - Move default channel registration (`sceneTree`, `selection`, `props`) to preset initialization.
- Consequences:
  - Preset cleanly owns default startup wiring.
  - Framework users can choose preset defaults or register channels explicitly without constructor side effects.

## 2026-03-03 - Shared channel access moved to import/get APIs (no direct YJS instance exports)

- Context:
  - Directly exporting built-in YJS instances from factory made ownership and access boundaries too implicit.
- Decision:
  - Remove direct built-in channel instance exports.
  - Expose accessor APIs instead:
    - strict `getSharedDataChannelStrict(name)`
    - safe `getSharedDataChannel(name)`
    - channel-instance accessor `getYjsDataChannel(name)` for preset/default wiring
- Consequences:
  - Channel access follows explicit getter intent similar to feature API access patterns.
  - Preset/ui-context can retrieve channels without raw instance export surface.

## 2026-03-03 - Render strategy registry naming clarified against render-layer registry

- Context:
  - `renderRegistry` name was ambiguous next to `renderLayerRegistry` and did not clearly express that it stores component render strategies.
- Decision:
  - Rename strategy registry surface to `renderStrategyRegistry`.
  - Rename implementation file from `render-registry.ts` to `render-strategy-registry.ts`.
  - Keep `render-layer-registry` naming unchanged for layer registration semantics.
- Consequences:
  - Framework extension points are easier to understand (`strategy` vs `layer` registration roles).
  - No runtime behavior change; this is an API/documentation clarity improvement.
- Related Plan:
  - `docs/ai/framework/plans/completed/render-strategy-registry-naming.md`

## 2026-03-03 - UI-context YJS subscription ownership moved to preset subscriptions

- Context:
  - `@asyra/ui-context` still kept YJS change subscribe handlers internally while render-side registration had already moved to preset-driven channel observers.
  - Keeping two ownership styles caused inconsistent extension/customization paths.
- Decision:
  - Remove YJS subscribe handler ownership from `@asyra/ui-context` package internals.
  - Keep `ui-context` focused on stores/property derivation primitives.
  - Register default ui-context channel observers in preset subscription modules alongside render defaults.
  - Rename preset observer folder to `subscriptions` and shorten file names (`data-channel.ts`, `render-system.ts`, `shared-channels.ts`) while keeping exported API names stable.
- Consequences:
  - Render and ui-context now follow the same preset-owned observer registration model.
  - Users can override/default-wire channel observers without touching framework package internals.
  - Preset remains the default-settings layer for observer/process wiring.
- Related Plan:
  - `docs/ai/framework/plans/completed/ui-context-data-channel-subscriber-registration.md`

## 2026-03-04 - Interaction-core retirement completed

- Decision:
  - Mark interaction-core retirement as completed and move the plan into completed plan records.
- Outcome:
  - Runtime and compatibility wiring through interaction-core has been removed.
  - Feature-system is the only execution/session runtime path.
- Related Plan:
  - `docs/ai/framework/plans/completed/interaction-core-retirement-plan.md`

## 2026-03-04 - Render package folder layout standardized by role

- Context:
  - Render internals were split across mixed folder names (`render-layer`, `selection-layer`, `viewport-layer`) and top-level registry files.
  - This made ownership and extension points harder to scan when adding new layers/registries.
- Decision:
  - Consolidate layer modules under `packages/render/src/layers/{scene,selection,viewport}`.
  - Consolidate registries under `packages/render/src/registries`.
  - Keep `@asyra/render` public exports stable while updating only internal paths and tests.
- Consequences:
  - Render internals now follow a consistent role-based structure.
  - New layer/registry additions can follow one predictable placement pattern.
  - No external API behavior change from this reorganization.
- Related Plan:
  - `docs/ai/framework/plans/completed/render-folder-structure-reorganization.md`

## 2026-03-04 - System-context runtime unified on managed properties with flattened snapshot contract

- Context:
  - System-context still had duplicated legacy state holders and grouped snapshot semantics while preset/app integrations were moving to managed-property ownership.
  - Event/state flows required one storage model and one snapshot contract to reduce ambiguity.
- Decision:
  - Remove legacy per-category state files/APIs from `@asyra/system-context` and keep managed-property APIs as the only get/set path.
  - Register builtin system properties in preset defaults using flattened keys (for example `mousePosition`, `keyShift`, `systemMode`).
  - Define `getSystemContextSnapshot` as key-collection aggregation over registered managed properties (no hardcoded grouped shape).
  - Keep duplicate-register behavior quiet by default (`silent` default true), with persistence opt-in via `runtime: false`.
- Consequences:
  - Framework boundary is clearer: `system-context` is managed-property runtime storage, preset owns default key registration.
  - App/preset consumers now use flattened snapshot/property keys consistently.
  - Save/load behavior remains explicit through managed-property runtime flags.
- Related Plan:
  - `docs/ai/framework/plans/completed/system-context-builtin-state-registration.md`

## 2026-03-04 - UI-context scene/selection stores removed from package surface

- Context:
  - `@asyra/ui-context` still exposed scene-tree and selection store singletons after subscription ownership had moved to preset.
  - This kept default aggregation wiring coupled to package-local stores and leaked store-level APIs into app/provider code.
- Decision:
  - Remove ui-context store exports (`uiContextSceneTreeStore`, `uiContextSelectionStore`) from `@asyra/ui-context` and `@asyra/core`.
  - Keep `@asyra/ui-context` focused on property registration/aggregation primitives (`uiContext`, `propertyRegistry`).
  - Move default selection-context building and flattened-element-id derivation into preset subscription wiring using `sceneTree` + `selection` runtime reads.
  - Update app providers to subscribe through core/events and query `sceneTree` directly instead of ui-context stores.
- Consequences:
  - Preset/app own subscription and derivation context wiring; ui-context remains a pure derived-property runtime.
  - App-layer dependency on ui-context store internals is removed.
  - Future custom apps can wire aggregation from any subscribable context without introducing new ui-context-owned stores.

## 2026-03-04 - Preset publishes `elementDataMap` as ui-context-facing element snapshot contract

- Context:
  - After removing ui-context scene/selection stores, app providers still needed per-element UI data without reading scene-tree directly.
- Decision:
  - Add preset-owned `elementDataMap` UI property and keep it synchronized from scene-tree channel updates and transaction/load boundaries.
  - Treat `elementDataMap` + `flattenedElementIds` as default UI-facing snapshot/index pair for element list reads.
- Consequences:
  - App UI can remain bounded to `core`/`ui-context` property subscriptions.
  - Scene-tree traversal and publish timing stay in preset default wiring instead of app providers.

## 2026-03-05 - System-context event-to-property update ownership moved out of system-context package

- Context:
  - `@asyra/system-context` still subscribed to legacy reactive-events channels and performed event-to-property mapping internally.
  - This mixed runtime storage ownership with default wiring policy and duplicated update paths with app/core direct managed-property writes.
- Decision:
  - Remove reactive-event subscribe ownership from `@asyra/system-context`.
  - Keep `@asyra/system-context` as managed-property storage/validation only.
  - Move default compatibility mapping for legacy system-context update events (`updateMouseState`, `updateKeyState`, `updateHoveredElementId`) into preset subscriptions, routed through core system-property APIs.
- Consequences:
  - Ownership is explicit: storage belongs to system-context, default mapping/wiring belongs to preset.
  - Legacy event publishers remain compatible when preset defaults are applied.
  - App/framework code can standardize on direct core system-property updates without hidden package-level subscribe side effects.
- Related Plan:
  - `docs/ai/framework/plans/completed/system-context-event-to-property-update-ownership.md`

## 2026-03-05 - Framework retired system-context-specific reactive event channels

- Context:
  - The earlier March 5 compatibility step moved system-context event mapping out of `@asyra/system-context` into preset wiring.
  - That still left framework-level event names tied to specific system-context keys, which conflicts with framework-agnostic managed-property registration.
- Decision:
  - Remove framework event channels `updateMouseState`, `updateKeyState`, and `updateHoveredElementId` from `@asyra/reactive-events`.
  - Remove preset compatibility subscriptions for those channels.
  - Keep system-context updates on direct managed-property APIs (`core.setSystemProperty` / `core.getSystemProperty`).
- Consequences:
  - Framework event contracts no longer assume any specific system-context key set.
  - Preset/app remain free to define and register domain-specific events when needed.
  - The previous March 5 compatibility mapping entry is superseded by this final boundary.
- Related Plan:
  - `docs/ai/framework/plans/completed/system-context-event-to-property-update-ownership.md`

## 2026-03-05 - Core concrete API tiers defined; preset moved to strict required core contract

- Context:
  - Preset integration still depended on optional capability checks (`core?.api`) despite core exposing concrete methods in runtime.
  - This weakened framework contracts and caused optional-call usage to persist in tests/e2e flows for concrete APIs such as `setSystemProperty`.
- Decision:
  - Define and export core API tier types (`CoreBasicAPIs`, `CoreExtensionAPIs`, `CoreConcreteAPIs`, `CorePresetInstallAPIs`).
  - Treat `setSystemProperty` as concrete core API and call directly where this contract applies.
  - Make preset consume strict required install APIs (`CorePresetInstallAPIs`) without optional guards.
- Consequences:
  - Framework contracts are explicit about concrete vs extension surfaces.
  - Preset bootstrapping behavior is deterministic and type-enforced.
  - Optional core capability probing is removed from concrete API call paths.
- Related Plan:
  - `docs/ai/framework/plans/completed/core-concrete-api-contract-and-preset-strict-surface.md`

## 2026-03-05 - Render-engine boundary formalized as framework direction

- Context:
  - Framework docs still referenced Pixi-centric constraints in acceptance guidance while the architecture direction is engine-swappable rendering.
  - New near-term planning now targets separation between render orchestration and concrete engine implementation.
- Decision:
  - Formalize render-engine boundary direction in framework planning.
  - Keep Pixi as default engine through preset wiring, but treat it as one concrete engine implementation, not framework-wide render ownership.
  - Update acceptance checklist language to require engine-specific imports stay inside render boundary packages (engine-agnostic wording).
- Consequences:
  - Framework guidance is aligned with the swappable renderer goal.
  - Future render-engine package extraction has an explicit planning reference and decision rationale trail.
  - No runtime contract break is introduced yet; this entry records direction and guardrails.
- Related Plan:
  - `docs/ai/framework/plans/render-engine-boundary-plan.md`

## 2026-03-05 - Selection subscribe ownership moved to preset default wiring

- Context:
  - `@asyra/selection` initialized reactive-event subscribe handlers as package side effects.
  - This mixed selection state ownership with default wiring ownership.
- Decision:
  - Remove selection subscribe bootstrap side effects from `@asyra/selection`.
  - Move default selection event routing to preset-owned subscriptions.
  - Apply selection runtime state from shared `selection` data-channel observer in preset.
- Consequences:
  - Selection package is state/query-focused only.
  - Default behavior remains available via explicit `applyPreset(core)` wiring.
  - Ownership aligns with preset-managed default subscriptions used in other framework areas.
- Related Plan:
  - `docs/ai/framework/plans/selection-subscription-ownership-plan.md`

## 2026-03-05 - Selection ownership refinement (supersedes prior same-day routing detail)

- Context:
  - Implementation refinement removed the need for preset-level reactive-event subscriptions for selection routing.
- Decision:
  - Keep selection transaction publishing in core selection APIs (`core.selectElements`, `core.selectVectorPoints`, `core.selectVectorSegments`) via transaction updates to shared `selection` channel.
  - Keep preset responsible for default selection shared-channel apply wiring and scene-tree remove-element cleanup.
- Consequences:
  - `@asyra/preset` no longer depends on `@asyra/reactive-events` for selection flow.
  - Ownership is cleaner: core publishes selection mutations; preset applies default observer-driven runtime wiring.
- Related Plan:
  - `docs/ai/framework/plans/selection-subscription-ownership-plan.md`

## 2026-03-05 - Selection flow moved to registration-driven channel/action metadata

- Context:
  - Selection flow still depended on shared enum constants (`SELECTION_TYPES`, `SELECTION_ACTIONS`) in core/preset paths.
  - Goal is channel/action ownership by registration/profile, not framework-global constants.
- Decision:
  - Core selection APIs now build transaction payloads from registered selection metadata (`selectionType`, `action`, `eventName`) and expose generic `selectByChannel(...)`.
  - Preset defines concrete canvas selection profile constants (`SelectionChannels`, `SelectionActions`) and uses them in default wiring.
  - Selection change contracts use string channel/action types.
- Consequences:
  - Core/preset no longer require `SELECTION_TYPES` / `SELECTION_ACTIONS`.
  - Compatibility wrapper APIs remain (`selectElements`, `selectVectorPoints`, `selectVectorSegments`) and resolve channels through registered selection metadata.
  - Concrete channel identity is explicit in preset profile exports for app usage.
- Related Plan:
  - `docs/ai/framework/plans/preset-selection-profile-plan.md`

## 2026-03-05 - `defineSelection` became primary declaration API with register compatibility alias

- Context:
  - Selection channel registration was still framed as `registerSelection` even after shifting to registration-driven metadata/channel ownership.
  - Framework naming direction is define-first for declaration contracts.
- Decision:
  - Promote `core.defineSelection(...)` as the primary selection declaration API.
  - Keep `core.registerSelection(...)` as a compatibility alias in this phase.
  - Migrate preset default selection declarations to `defineSelection`.
- Consequences:
  - Selection declaration naming is aligned with define-first framework contracts.
  - Existing callers using `registerSelection` remain compatible.
- Related Plan:
  - `docs/ai/framework/plans/define-selection-contract-plan.md`

## 2026-03-05 - UI/system managed-property declarations moved to define-first naming

- Context:
  - Core/preset contracts still used `registerUIProperty` / `registerSystemProperty` as primary naming.
  - This conflicted with define-first declaration naming used in other framework extension surfaces.
- Decision:
  - Add and use `core.defineUIProperty(...)` and `core.defineSystemProperty(...)` as primary declaration APIs.
  - Keep `registerUIProperty(...)` / `registerSystemProperty(...)` as compatibility aliases in core.
  - Update preset default property registration flow to use define names.
- Consequences:
  - Declaration naming across components, selections, and managed properties is now consistent.
  - Compatibility is preserved for existing integrations using register names.
- Related Plan:
  - `docs/ai/framework/plans/define-naming-alias-plan.md`

## 2026-03-05 - Preset selection profile exports dropped `Preset*` prefixes

- Context:
  - Preset selection profile exports (`PresetSelectionChannels`, `PresetSelectionActions`) carried explicit ownership prefixes.
  - For preset consumers, these prefixes added call-site noise without meaningful disambiguation.
- Decision:
  - Rename preset selection profile exports to concise names:
    - `SelectionChannels`
    - `SelectionActions`
    - `SelectionChannel`
    - `SelectionAction`
    - `SelectionChannelList`
  - Keep runtime behavior and channel values unchanged.
- Consequences:
  - Preset API usage is cleaner and more aligned with common framework/library defaults naming.
  - Internal preset wiring, tests, app usage, and docs now use the concise names.
- Related Plan:
  - `docs/ai/framework/plans/preset-selection-profile-naming-plan.md`

## 2026-03-05 - Core selection wrappers removed legacy channel fallbacks

- Context:
  - Core wrapper APIs (`selectElements`, `selectVectorPoints`, `selectVectorSegments`) still had legacy fallback channel defaults when action-to-channel mapping was missing.
- Decision:
  - Remove fallback defaults and require wrapper channel resolution through registered selection metadata only.
  - Throw explicit errors when wrappers are called before corresponding selection channels are registered.
- Consequences:
  - Selection flow is strictly registration-driven end-to-end.
  - Missing preset/custom selection registration fails fast instead of silently routing to implicit defaults.

## 2026-03-05 - Concrete default selection classes removed from `@asyra/selection`

- Context:
  - `@asyra/selection` still shipped concrete canvas-default classes (`element`, `vectorPoint`, `vectorSegment`), while ownership direction is generic runtime in selection and concrete defaults in preset.
- Decision:
  - Remove concrete default selection classes from `@asyra/selection`.
  - Keep `@asyra/selection` surface as generic runtime primitives (`BaseSelection`, `SelectionManager`).
  - Build default canvas selection instances in preset registration from explicit metadata definitions.
- Consequences:
  - Selection package is domain-agnostic and no longer encodes preset-specific defaults.
  - Default selection behavior is preserved through preset-owned registration definitions.
- Related Plan:
  - `docs/ai/framework/plans/selection-concrete-class-removal-plan.md`

## 2026-03-05 - Selection/API naming plan records closed and moved to completed

- Context:
  - Selection ownership/profile/naming refactors were implemented and validated, but plan records still lived under active near-term paths.
- Decision:
  - Close out and archive completed plan records under `docs/ai/framework/plans/completed/`.
  - Keep near-term list focused on unfinished items only.
  - Treat earlier same-day decision references to non-completed paths as superseded by the completed canonical references below.
- Consequences:
  - Active plan index is cleaner and no longer points to finished selection refactor work.
  - Canonical completed records now live at:
    - `docs/ai/framework/plans/completed/selection-subscription-ownership-plan.md`
    - `docs/ai/framework/plans/completed/preset-selection-profile-plan.md`
    - `docs/ai/framework/plans/completed/define-selection-contract-plan.md`
    - `docs/ai/framework/plans/completed/define-naming-alias-plan.md`
    - `docs/ai/framework/plans/completed/preset-selection-profile-naming-plan.md`
    - `docs/ai/framework/plans/completed/selection-concrete-class-removal-plan.md`

## 2026-03-06 - Preset direct selection events now sync render/ui mirrors on undo/redo replay

- Context:
  - Undo/redo replays selection events directly from transaction history (`selectElements`/vector variants), bypassing shared-channel observer callbacks.
  - Runtime selection could be restored while render selection mirrors stayed stale, causing visual selection mismatch.
- Decision:
  - In preset selection-event subscriptions (`subscribeToSelectElements` / vector variants), normalize direct selection payloads and mirror them to:
    - selection runtime state
    - render selection store update
    - ui-context selection mirrors
  - Keep shared-channel observer flow unchanged for normal transaction updates.
- Consequences:
  - Selection visuals and ui-context now stay aligned with runtime during undo/redo replay paths.
  - Drag-move undo can restore both position and prior selection with consistent visual feedback.

## 2026-03-09 - Scene-tree recompute bridge must publish on scene-tree shared channel

- Context:
  - Owner-property recompute from committed props updates reused the props transaction options wholesale.
  - When those options carried `shared: PROPS`, downstream render subscribers listening on the scene-tree shared channel missed the recomputed element updates.
- Decision:
  - Keep the committed props bridge for owner recompute, but clear inherited `shared` routing before the scene-tree transaction commit so scene-tree changes publish on the default scene-tree shared channel.
- Consequences:
  - Direct child-property edits remain bridge-driven without leaking props-channel routing into render-facing scene-tree updates.
  - Render and other scene-tree subscribers stay in sync after committed property edits.

## 2026-03-09 - Render public surface no longer re-exports Pixi classes

- Context:
  - `@asyra/render` directly re-exported Pixi `FillGradient`, which let non-render packages construct engine-specific classes through the render facade.
  - This conflicts with the render-engine boundary direction and future `render` / `render-engine` split.
- Decision:
  - Remove direct Pixi class re-exports from `@asyra/render`.
  - Expose render-owned gradient fill factory/types instead of the concrete `FillGradient` class.
  - Surface preset/app-facing render fill factory access through `core.createRenderGradientFillStyle(...)`.
- Consequences:
  - Non-render packages consume render abstractions only.
  - Concrete engine names no longer leak through the public render package surface.

## 2026-03-09 - Core adds property-id update and computed-refresh bridge for child property edits

- Context:
  - Child property edits such as fill-row updates needed a framework path that avoids rewriting the full parent computed array for each small change.
- Decision:
  - Add `core.updatePropertyById(...)` for direct property-component mutation by id.
  - Add `core.refreshComputedDataFromProperty(elementId, propertyName, ...)` to recompute one owner element property from props and publish one scene-tree update path.
- Consequences:
  - App/common APIs can patch repeatable child properties directly while keeping render/ui-context in sync.
  - Parent computed-array rewrites are no longer required for single-child edits.

## 2026-03-09 - Child-property owner recompute moved to committed props bridge

- Context:
  - Manual app-side `refreshComputedDataFromProperty(...)` calls fixed forward child-property edits but duplicated the refresh rule outside the props transaction boundary and did not define the replay path clearly.
- Decision:
  - Keep direct child-property writes via `core.updatePropertyById(...)`, but add owner metadata and batch them with `core.commitPropertyChanges(...)`.
  - Refresh owner scene-tree computed data from committed props update transactions, so forward writes and undo/redo replay use the same bridge.
- Consequences:
  - App handlers no longer need to manually refresh owner computed state after each child-property write.
  - Direct child-property patterns remain transaction-safe and replay-safe.

## 2026-03-10 - Preset linear gradient render mapping stabilized

- Context:
  - Linear gradient rendering in preset used normalized handle coordinates without local-space mapping, leading to inconsistent output across element sizes.
  - Radial gradient output remained incorrect and required separate handling.
- Decision:
  - Map gradient handles into local pixel space before creating render gradients.
  - Keep linear gradient stop ordering stable under Pixi internal flip behavior.
  - Defer radial/other gradient render fixes to the next iteration.
- Consequences:
  - Linear gradient rendering is consistent across element sizes.
  - Radial/other gradient types remain pending and tracked under the app canvas-gradient-handles plan.

## 2026-03-11 - Computed subscribes to property component changes

- Context:
  - Property updates should update computed data without explicit refresh calls and live closer to property ownership.
- Decision:
  - `Computed` subscribes to property component change events (`Setter.on`) and updates computed values directly from property component state.
- Consequences:
  - Prop-originated updates keep computed data in sync without calling `refreshComputedDataFromProperty(...)` in normal runtime flow.
  - `refreshComputedDataFromProperty(...)` remains available for fallback/diagnostic use.
- Related Plan:
  - `docs/ai/framework/plans/completed/property-driven-computed-sync-plan.md`

## 2026-03-17 - Render overlay interaction bridge added

- Context:
  - Overlay interactions relied on app-side hit testing and input events, causing drag conflicts and render-engine coupling.
- Decision:
  - Add render-owned interaction target registry + bridge that emits `render.pointer.*` and capture events.
  - Provide core facade APIs for registering overlay targets and handlers.
  - Allow capture mode to block input-system pointer combinations during overlay drag.
- Consequences:
  - Overlay tools can implement hit-testing and drag flows without Pixi coupling.
  - Input-system avoids element drag conflicts during overlay capture.
- Related Plan:
  - `docs/ai/framework/plans/completed/interactive-overlay-input-plan.md`

## 2026-07-15 - Local application-level transaction ACID completed

- Context:
  - PR #77 completed and merged the local transaction atomicity, validation,
    interaction serialization, and persistence acknowledgement work.
- Decision:
  - Treat Asyra's local application-level Atomicity, Consistency, Isolation, and
    Durability contract as complete without claiming database serializability or
    distributed transaction guarantees.
  - User-driven interruption defaults to `commit-current` and finalizes the
    current preview as one undoable action; handler error, timeout, validation
    failure, explicit rollback, or a feature's true-discard policy use rollback.
  - Persistence failure reports `persistence-failed` but does not reverse an
    already committed runtime transaction.
  - Yjs provider/room/auth, remote canonical apply, origin/dedupe, awareness,
    reconnect/convergence, and collaborative conflict policy remain outside this
    completed phase.
- Consequences:
  - The active plan is archived at the completed canonical path while the
    executable Transaction Flow Inspector data, contract test, and viewer remain
    active source-of-truth artifacts.
  - `Preset 2D/3D Init Profiles` is now the first Near-Term Plan.
- Related Plan:
  - `docs/ai/framework/plans/completed/transaction-atomicity-and-rollback-plan.md`
- Related Commit(s):
  - `8ea0e1c9736df40312143edaac499b6109af628e` (`feat(framework): add local transaction ACID semantics (#77)`)
  - [PR #77](https://github.com/karote00/asyra/pull/77)

## 2026-07-15 - Render-engine boundary precedes render-mode preset profiles

Status: the profile availability and generic-composition portions are
superseded by the 2026-07-17 Preset profile/default decision below. The package
boundary remains historical authority.

- Context:
  - The near-term preset plan proposed public `2d`, `3d`, and `hybrid`
    profiles before Asyra had a production 3D engine or an explicit hybrid
    runtime contract.
  - A profile name would imply supported engine, render-layer, camera,
    coordinate, hit-test, selection, and input behavior that does not yet exist.
- Decision:
  - Make the render-engine boundary the first Near-Term Plan after transaction
    closeout.
  - Use Pixi as the default concrete engine and prove replaceability with a
    fake/contract-test adapter; a production 3D engine is not required for the
    abstract framework boundary to be complete.
  - Separate generic preset composition from official render-mode profiles.
    Generic composition may coordinate official defaults and preset profile
    provider policy while app customization remains Core-owned.
  - Keep official `2d`, `3d`, and `hybrid` profiles deferred and trigger-gated.
    Do not export empty, placeholder, or capability-incomplete profiles.
- Consequences:
  - Engine selection remains explicit and is not inferred from a product-mode
    label.
  - An official 3D profile requires a supported production 3D engine and
    canonical 3D bundles.
  - An official hybrid profile additionally requires explicit multi-engine or
    hybrid-runtime coordination for surfaces, cameras, coordinate spaces, hit
    testing, selection, input, and cleanup.
  - `Extendable Preset` remains separate: it owns feature/property extension
    and replacement semantics, while Generic Preset Composition owns startup
    layer ordering.
- Related Plans:
  - `docs/ai/framework/plans/render-engine-boundary-plan.md`
  - `docs/ai/framework/plans/extendable-preset-plan.md`
  - `docs/ai/framework/plans/preset-composition-plan.md`
  - `docs/ai/framework/plans/preset-2d-3d-init-profile-plan.md`

## 2026-07-15 - Render package remains stable while engine packages are extracted

- Context:
  - Renaming the published `@asyra/render` package to `@asyra/renderer` would
    add package-wide deprecation and migration cost without improving the
    responsibility boundary.
  - The actual architectural problem is that adapter/orchestration and the Pixi
    concrete implementation currently share one package.
- Decision:
  - Keep `@asyra/render` as the active framework adapter and render
    orchestration package.
  - Add `@asyra/render-engine` as the engine-independent abstract contract.
  - Add `@asyra/render-engine-pixi` as the default concrete Pixi implementation.
  - Make preset startup construct and inject Pixi by default while allowing a
    custom engine implementation through the same abstract contract.
  - Do not introduce a production 3D engine, hybrid runtime, or render-mode
    profile in this phase.
- Consequences:
  - The package extraction reads as a responsibility refactor rather than a
    public package rename.
  - `@asyra/render` and `@asyra/render-engine-pixi` must not depend on one
    another in the completed architecture; both use
    `@asyra/render-engine` contracts.
  - Existing Pixi-specific exports from `@asyra/render` receive a bounded
    deprecation lifecycle only after tested replacements exist.
  - The Render Engine Boundary plan owns a Mermaid package architecture diagram
    that must be synchronized into Framework Architecture documentation during
    implementation and verified again at closeout.
- Related Plan:
  - `docs/ai/framework/plans/render-engine-boundary-plan.md`

## 2026-07-15 - Render-engine boundary implemented as three package owners

Status: provider naming, custom-engine composition, and default adapter
ownership are superseded by the 2026-07-17 Preset profile/default decision
below. The three-package ownership boundary remains active.

- Context:
  - The render adapter, abstract engine contract, and Pixi SDK implementation
    previously shared one package boundary.
  - Preset and app startup needed a default composition that did not prevent a
    user-owned engine implementation.
- Decision:
  - Keep `@asyra/render` as the active framework adapter/orchestration owner.
  - Make `@asyra/render-engine` the pure contract owner and
    `@asyra/render-engine-pixi` the only Pixi runtime owner.
  - Let preset bind a fresh Pixi engine provider by default; custom providers
    bind through Core using the same abstract contract.
  - Replace app use of the Pixi-named renderer facade with `RenderAdapter`;
    retain `PixiJSRenderer` only as a deprecated warn-once compatibility alias
    through the next planned major-release migration window.
- Consequences:
  - Render and the Pixi engine no longer import or depend on one another.
  - Core and Asyra Design remain concrete-engine-neutral.
  - Contract tests prove lifecycle, commands, events, capability failure,
    cleanup, and engine-instance isolation.
  - This boundary does not introduce a production 3D engine, Hybrid runtime,
    or render-mode selector.
- Related Plan:
  - `docs/ai/framework/plans/render-engine-boundary-plan.md`

## 2026-07-16 - Render-engine boundary completed

- Context:
  - PR #79 merged the abstract render-engine contract, Pixi concrete owner,
    engine-neutral render adapter, preset default injection, custom-engine
    composition path, compatibility surface, and architecture documentation.
  - CI validation and Vercel deployment completed successfully before merge.
- Decision:
  - Treat the Render-Engine Boundary plan as complete with
    `@asyra/render` owning framework orchestration,
    `@asyra/render-engine` owning the pure contract, and
    `@asyra/render-engine-pixi` owning concrete Pixi execution.
  - Keep preset as the default Pixi composition owner while allowing users to
    inject a contract-compatible custom engine.
  - Keep production 3D, Hybrid, and render-mode selection outside this
    completed phase.
- Consequences:
  - The detailed plan is archived at its completed canonical path while the
    Render-Engine Boundary Inspector data, contract test, and viewer remain
    executable architecture authorities.
  - Extendable Preset becomes the first Near-Term Plan, followed by Generic
    Preset Composition; official 2D/3D/Hybrid profiles remain deferred and
    trigger-gated.
- Related Plan:
  - `docs/ai/framework/plans/completed/render-engine-boundary-plan.md`
- Related Commit(s):
  - `f185f026cef3b47127003651697bdbf7a8708889` (`feat(render): add replaceable render engine boundary (#79)`)
  - [PR #79](https://github.com/karote00/asyra/pull/79)

## 2026-07-16 - Preset customization uses explicit startup registration composition

Status: the public preset-lifetime portion is superseded by the 2026-07-17
Preset profile/default decision below. Relation removal and graph-aware Core
customization remain active.

- Context:
  - App developers need to add, adjust, remove, or fully change preset defaults
    without editing preset/framework internals.
  - A replace API suggests semantic equivalence even when the old and new
    property, component, render, or feature capabilities are not equivalent.
- Decision:
  - Use `applyPreset(core) -> remove/define relations -> optional capability
unregister -> app migration -> core.start()` as the public app route.
  - Keep one Core-owned registration graph with stable identity, owner metadata,
    deterministic traversal, explicit `detach`/`unregister-source` policies, and
    retryable lifecycle cleanup.
  - Remove preset-specific app extension targets and all public/shared replace
    strategies. App features use `core.defineFeature`; full implementation
    changes use owner unregister followed by ordinary definition/registration.
  - Close composition permanently at the first `core.start()` method entry and
    keep migration app-owned before validation/load.
- Consequences:
  - Apps customize preset defaults without deep imports, manual owner metadata,
    or understanding preset installation internals.
  - Relation removal preserves registrations; full unregister cleans declared
    dependents and owned resources without inferring semantic equivalence.
  - Preset exports pure component definitions and separate render strategies;
    import alone has no component registration side effect.
  - Failed preset application rollback owns acquired graph registrations and
    event, selection, shared-channel, subscription, observer, and render-layer
    wiring. It preserves app-owned channels and retries only pending cleanup
    without rerunning completed cleanup.
  - Supplied Core instances own their shared-channel and observer wiring through
    their injected Factory; preset does not bypass that boundary through the
    default singleton. Failed apply rollback remains retryable on the same Core.
    The default Core explicitly shares one observer registry with the standalone
    compatibility helpers; custom Core instances keep separate registries.
  - Inline component render strategies are explicit graph-owned registrations,
    while independently registered strategies stay independent.
  - Registration retry reconciles pending detach work against current adjacency
    so later formal remove/redefine operations cannot be mistaken for stale work.
    Core rejects relation definition against a pending source or target before
    changing the package runtime owner, while formal removal can still detach a
    healthy source from a pending target.
  - Generic Preset Composition, product profiles, render-mode selection, and
    multi-engine composition remain outside this plan.
- Related Plan:
  - `docs/ai/framework/plans/extendable-preset-plan.md`
- Related Commit(s):
  - `f03693e37` (`feat(utils): add registration relation graph`)
  - `7ae021668` (`feat(core): add component property relation owners`)
  - `53f12fb64` (`feat(props-manager): add property child relation owners`)
  - `6ee041a5f` (`feat(core): coordinate startup registration composition`)
  - `8fa6f9915` (`feat(preset): install graph-owned defaults`)
  - `6b2412816` (`fix(framework): close preset composition ownership gaps`)
  - `cf3855ea9` (`fix(core): preflight retry ownership boundaries`)
  - `bb481da9e` (`test(core): cover pending relation preflight routes`)

## 2026-07-17 - Extendable Preset relation composition completed

- Context:
  - PR #81 contains the completed startup registration composition contract,
    implementation, formal coverage, framework/app documentation, and
    executable Inspector authority.
  - All implementation segments, bounded/root gates, self-review, and
    read-only sub-agent review completed before closeout. PR #81 remains open
    for owner review; this record does not claim merge completion.
- Decision:
  - Treat the Extendable Preset Relation and Unregister plan as implementation
    complete and archive its product contract at the completed canonical path.
  - Keep explicit `remove -> define` for non-equivalent relation changes and
    `unregister -> define/register` for complete capability changes; do not add
    app-facing or shared registry replace semantics.
  - Keep all composition mutations before the first `core.start()`, with
    migration app-owned and runtime validation framework-owned.
- Consequences:
  - The Inspector data, contract test, and viewer remain the executable
    architecture authority and now resolve the completed product contract.
  - Generic Preset Composition becomes the first Near-Term Plan and must consume
    this completed relation/unregister contract without redefining it.
  - Production 3D, Hybrid runtime composition, render-mode selection, and
    app-specific framework policy remain outside this completed phase.
- Related Plan:
  - `docs/ai/framework/plans/completed/extendable-preset-plan.md`
- Related Commit(s):
  - `f03693e37` (`feat(utils): add registration relation graph`)
  - `6ee041a5f` (`feat(core): coordinate startup registration composition`)
  - `8fa6f9915` (`feat(preset): install graph-owned defaults`)
  - `c9b2fda5a` (`docs(preset): record relation composition closure`)
  - [PR #81](https://github.com/karote00/asyra/pull/81)

## 2026-07-17 - Preset startup composition is explicit and engine-neutral

- Context:
  - Review of the first Generic Preset Composition implementation found that
    engine bootstrap inputs, app-provided installers, and a public application
    lifetime did not match the intended product semantics.
  - Apps need two independent choices before startup: preset engine profile and
    official default modules.
- Decision:
  - Make `profile` select only preset engine policy and `defaults` select only
    the fixed official module catalog.
  - Default `applyPreset(core)` to profile `2D` plus all eight defaults. Keep
    `3D` and `HYBRID` as unavailable ids without importing placeholder runtimes;
    `CUSTOM` binds no provider.
  - Bind custom engines only through
    `core.setRenderEngineProvider(provider)` before startup. Core owns the
    default `RenderAdapter`; only exact provider absence becomes headless.
  - Hard-remove the unreleased engine bootstrap, arbitrary installer,
    dependency-input, legacy-provider, and public preset-lifetime surfaces.
  - Return one frozen `PresetApplyResult`; retain reverse failed-apply cleanup
    and pending-only retry internally.
- Consequences:
  - Profile choice never filters defaults. Omitted defaults mean all; an empty
    list means none; explicit choices expand public dependencies in catalog
    order.
  - Apps cannot inject preset installers or cleanup owners. Framework developers
    maintain the eight product modules and private shared prerequisites.
  - Direct Render remains strict, real provider/engine failures remain visible,
    and Asyra Design no longer constructs or sets its own adapter.
- Related Plan:
  - `docs/ai/framework/plans/preset-composition-plan.md`
- Related Commit(s):
  - `18e3c4ab4` (`feat(preset): validate generic composition inputs`)
  - `b2b8f83d0` (`refactor(preset): order shared defaults before engine bootstrap`)
  - `e55df62ca` (`feat(render): make engine provider selection reversible`)
  - `a1a89becb` (`feat(preset): install ordered capability bundles`)
  - `fbb722c12` (`feat(preset): publish composition results`)
  - `b8fc8adfe` (`feat(preset): report retryable cleanup failures`)
  - `1d45cb509` (`docs: redefine preset profile and defaults contract`)
  - `4c291e227` (`refactor: add preset profiles and selectable defaults`)
  - `8efef5e04` (`refactor: let core own app renderer lifecycle`)

## 2026-07-18 - Preset profile and selectable defaults completed

- Context:
  - The independent profile/default contract, Core provider and headless
    lifecycle, eight preset modules, deterministic rollback, Asyra Design
    migration, and synchronized documentation are implemented on
    `codex/generic-preset-composition`.
  - Package, app, Inspector, root, build, lint, dependency, diff, E2E, and live
    visual gates passed. Final self-review found no unresolved concrete issue,
    and the product owner directly verified Asyra Design before requesting
    closeout.
- Decision:
  - Treat the Preset Profile and Selectable Defaults plan as implementation
    complete and archive its product contract at the completed canonical path.
  - Keep `profile` limited to preset render-engine provider policy and
    `defaults` limited to fixed official modules. `applyPreset(core)` remains
    `2D` plus all defaults; `CUSTOM` remains the provider-free preset route.
  - Keep Core as the only public provider and renderer-lifecycle facade, with
    exact missing-provider normalization limited to Core-owned headless startup.
  - This entry completes the 2026-07-17 preset startup composition decision
    without changing its product semantics.
- Consequences:
  - The Preset Composition Inspector data, contract test, and viewer remain the
    executable architecture authority and now resolve the completed product
    contract.
  - Generic Preset Composition is removed from active plans. Production 3D and
    Hybrid profiles remain deferred and unavailable until their independent
    engine and product contracts exist.
  - This closeout records local completion only; no branch was pushed, merged,
    or released.
- Related Plan:
  - `docs/ai/framework/plans/completed/preset-composition-plan.md`
- Related Commit(s):
  - `1d45cb509` (`docs: redefine preset profile and defaults contract`)
  - `4c291e227` (`refactor: add preset profiles and selectable defaults`)
  - `8efef5e04` (`refactor: let core own app renderer lifecycle`)
  - `554b94d47` (`docs: align preset profile and provider contracts`)
  - `082e9449b` (`docs: record preset implementation validation`)
  - `3a2a6c654` (`fix(core): preserve configured provider failures`)
  - `6f76b8aab` (`fix(preset): isolate selectable default prerequisites`)
  - `8a29217b8` (`docs(framework): align preset provider terminology`)

## 2026-07-18 - Canvas Pipeline Debugger completed

- Context:
  - PR #83 merged the optional Canvas Pipeline Debugger, its dedicated
    Inspector, formal Render/Core/app coverage, Asyra Design DEV wiring, and
    production-bundle exclusion to `main`.
  - PR validation passed. A synchronized live-app closeout review additionally
    confirmed that a focused element becomes `observed`, exposes canonical
    workspace/canvas projection, renders a readable debugger-only outline after
    ordinary selection is cleared, and retains no debugger fault.
- Decision:
  - Treat the Canvas Pipeline Debugger plan as implementation complete and
    archive its product contract at the completed canonical path.
  - Keep the debugger optional, disabled by default, deterministic,
    instance-bound, and engine-neutral. Observation stops before the concrete
    engine call and never claims pixel, hit-test, engine-result, or product-data
    authority.
  - Keep the app-facing API limited to
    `@asyra/core/canvas-pipeline-debugger`; Render support remains an optional
    non-app-facing subpath and Pixi remains confined to its concrete engine
    package.
- Consequences:
  - Canvas Pipeline Debugger is removed from active framework plans. Its
    Inspector data, contract test, and direct-open viewer remain the executable
    architecture authority and now resolve the completed product contract.
  - Scene Tree and Props Manager do not gain separate debuggers without a future
    concrete runtime-observability requirement.
  - Debugger data remains transient and cannot become persistence, undo/redo,
    collaboration, export, interaction, or canonical render input.
- Related Plan:
  - `docs/ai/framework/plans/completed/canvas-pipeline-debugger-plan.md`
- Related Commit(s):
  - `fbc216ab2b219c9e950e6dfabad102b2a396b981` (`feat(render): add canvas pipeline debugger`)
  - `77026a8d79a22bcb8ed22d3ff8f6a99f660343ec` (PR #83 merge commit)
  - [PR #83](https://github.com/karote00/asyra/pull/83)

## 2026-07-19 - Declarative Property Type Redefinition completed

- Context:
  - PR #86 contains the complete pre-start property redefinition contract,
    implementation, formal package coverage, executable Inspector authority,
    golden paths, and synchronized framework/app documentation.
  - Bounded sub-agent and independent reviews were resolved, and the product
    owner verified through an uncommitted Asyra Design example that Fill fields
    can be changed and Dimension fields added with explicit typed UI/data
    consumers and no render coupling.
- Decision:
  - Treat Declarative Property Type Redefinition as implementation complete and
    archive its product contract at the completed canonical path.
  - Keep `getPropertyTypeDefinition()` and `redefinePropertyType()` as the only
    high-level Core route for complete config-mode field customization after
    optional preset composition and before the first `core.start()`.
  - Keep semantic consumers explicit and owner-local: relations, render
    strategies, UI properties, commands, and migrations are never rewritten or
    inferred from removed/added fields.
- Consequences:
  - Props Manager remains the sole schema/runtime rebuild owner; Core coordinates
    composition, owner transfer, relation preservation, and final structural
    validation without adding general registry replace semantics.
  - Official preset types and app types use the same public Core API, while
    constructor-mode types retain unregister/define composition.
  - Custom fields remain typed through id-first property updates, engine-neutral
    render strategies, and UI compute elements; render-engine/Pixi and load
    migration ownership remain unchanged.
  - The plan is removed from active framework plans. Its Inspector data,
    contract test, and viewer remain executable architecture authorities and now
    resolve the completed product contract.
  - PR #86 merged to `main` at
    `91cee525af34ebb9f2fa717610663d61b245589a`; this closeout records the merged
    plan state but does not claim release completion.
- Related Plan:
  - `docs/ai/framework/plans/completed/property-type-redefinition-plan.md`
- Related Commit(s):
  - `341ddee24` (`feat(props-manager): add atomic property type definition owner`)
  - `a57a3640c` (`feat(core): coordinate declarative property redefinition`)
  - `a2c06ec4c` (`test(scene-tree): verify canonical custom field projection`)
  - `8b21fef07` (`feat(render): type app-defined strategy data`)
  - `b009d20c5` (`feat(ui-context): type app-defined compute data`)
  - `4b66ba0c9` (`test(preset): verify public property redefinition flow`)
  - `ff5f8a1ee` (`fix(props-manager): distinguish object and array values`)
  - `779d6a427` (`fix(preset): align fill definitions for redefinition`)
  - `91cee525a` (`Framework: declarative property type redefinition (#86)`)
  - [PR #86](https://github.com/karote00/asyra/pull/86)

## 2026-07-19 - Render Delta Update Pipeline completed

- Context:
  - PR #88 contains the committed Scene Tree delta contract, ordered Factory
    delivery, Preset routing, atomic Render projection, explicit resync and
    lifecycle behavior, executable Inspector authority, package documentation,
    regression coverage, and formal app performance/visual evidence.
  - Inspector, package, monorepo, dependency, lint, build, Chromium E2E,
    synchronized visual, primary review, and independent review gates passed.
    The product owner then manually verified Asyra Design before requesting
    closeout.
- Decision:
  - Treat the Render Delta Update Pipeline as implementation complete and
    archive its product contract at the completed canonical path.
  - Keep Scene Tree as the sole canonical raw/computed owner, Factory as the
    ordered exactly-once delivery owner, Preset as the observer/lifecycle route,
    and Render as the sole owner of its complete derived snapshot.
  - Keep scalar, batch, and record patch application atomic; use explicit
    authoritative seed/resync for add, load, registration, and mismatch; retain
    complete-snapshot frame coalescing and engine-neutral hierarchy handoff.
- Consequences:
  - Ordinary Render updates no longer require full computed-data rehydrate;
    direct properties retain their fast path while computed changes rerun the
    public strategy from one complete validated snapshot.
  - Load and re-registration rebuild parent-first in canonical sibling order;
    failed projection, cleanup, and hierarchy handoff paths retain bounded retry
    ownership without fallback output or another state owner.
  - Non-vector strategies and app-defined data-channel observers remain
    compatible, and RenderEngine/Pixi, Feature System, Input System, persistence,
    and app import boundaries remain unchanged.
  - The plan is removed from active framework plans. Its Inspector data,
    contract test, and viewer remain executable architecture authorities and now
    resolve the completed product contract.
  - PR #88 remains open for human review; this closeout records implementation
    completion and does not claim merge or release completion.
- Related Plan:
  - `docs/ai/framework/plans/completed/render-delta-update-plan.md`
- Related Commit(s):
  - `a837ff515` (`docs: define render delta inspector contract`)
  - `4be863e5e` (`fix(render): require explicit snapshot seeds`)
  - `131deeead` (`fix(render): apply snapshot deltas atomically`)
  - `2f1e529d9` (`fix(render): resync mismatched delta snapshots`)
  - `50a336737` (`fix(scene-tree): preserve delta owner provenance`)
  - `a6629eda6` (`fix(preset): rebuild render projection on registration`)
  - `42cb31250` (`fix(render): fail partial authoritative reloads`)
  - `be4eb71b9` (`fix(render): retain failed cleanup ownership`)
  - `50528b384` (`fix(render): preserve canonical load rebuilds`)
  - `2465a6663` (`fix(render): retain failed hierarchy handoffs`)
  - `7009b471d` (`fix(render): rollback failed reparent handoffs`)
  - [PR #88](https://github.com/karote00/asyra/pull/88)
