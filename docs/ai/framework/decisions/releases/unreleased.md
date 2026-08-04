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

## 2026-07-19 - Define first framework release gate sequence

- Context:
  - The Render Delta Update Pipeline closeout left no Near-Term framework plan,
    while the remaining Deferred list mixed release prerequisites with optional
    future capabilities.
  - Most design-oriented canvas tools require a CRDT collaboration foundation
    even though individual apps may choose not to activate collaboration.
  - The first release is also expected to provide a safe opt-in AI action
    runtime without turning any model provider or app-domain agent into a Core
    dependency.
  - Preset already installs an official Group component, but Scene Tree, Factory,
    collaboration, Preset operations, load/save, and Render do not yet expose one
    complete atomic group/ungroup/reparent/subtree contract.
  - This supersedes the 2026-02-28 priority decisions that kept app migration and
    Yjs collaboration in the deferred queue; it does not rewrite those historical
    entries.
- Decision:
  - Require five ordered gates before the first public Asyra Framework release:
    app-level migration formalization/closeout, optional-at-runtime Yjs network
    collaboration and conflict policy, Group hierarchy behavior with Preset
    basic operations, optional AI agent runtime with a replaceable production
    provider boundary, and framework release-readiness audit/closeout.
  - Keep Scene Tree as canonical hierarchy owner, Factory/Yjs as transaction and
    shared-delivery infrastructure, Preset as official Group default/basic
    operation owner, Render as derived hierarchy projection, and apps as owners
    of selection, commands, hover/click behavior, and UI presentation.
  - Keep Auto-layout and its unit/UI aggregation family at the lowest
    post-release priority. Keep production 3D/Hybrid profile activation on the
    post-release Roadmap.
- Consequences:
  - Collaboration ships in the framework release but remains explicitly
    opt-in, so non-collaborative apps incur no provider, room, awareness, network,
    or lifecycle activation.
  - Group work extends the existing component/container baseline instead of
    registering a duplicate Group or placing design-tool UI policy in framework
    packages.
  - AI ships as an optional package/runtime: app-owned registered actions and
    Feature System lifecycle plus ordinary transaction, validation,
    collaboration, canonical state, and Render paths remain authoritative,
    while apps that omit AI activate no provider, model network, secret, or AI
    lifecycle behavior.
  - Each gate remains queued rather than implementation-ready until its thin
    product contract and exact Inspector owner flow pass readiness review.
  - The final gate audits packed artifacts, public APIs, clean-consumer use,
    generated templates, formal gates, and release records; it does not itself
    authorize push, merge, tag, or publication.
- Related Plan:
  - `docs/ai/framework/PLANS.md`
  - `docs/ai/framework/plans/props-manager-app-level-migration-plan.md`
  - `docs/ai/framework/plans/network-collaboration-transport-plan.md`
  - `docs/ai/framework/plans/collaborative-conflict-policies-plan.md`
  - `docs/ai/framework/plans/group-component-and-hierarchy-behaviors-plan.md`
  - `docs/ai/framework/plans/ai-agent-runtime-plan.md`
  - `docs/ai/framework/plans/framework-release-readiness-and-closeout-plan.md`
  - `docs/ai/framework/plans/auto-layout-behavior-engine-plan.md`
- Related Commit(s):
  - pending

## 2026-07-19 - Formalize app-level migration and close Framework Release Gate 1

- Context:
  - The Gate 1 audit began from PR #89 merged into the latest `main` and
    confirmed that Core already provided `registerLoadHook(...)`, ordered load
    hooks, package validation before canonical apply, provider/direct load
    convergence, and observational load diagnostics.
  - Formal Inspector routes and regression tests exposed bounded gaps in raw
    input semantics, async-result rejection, validation artifact authority,
    diagnostics containment, and instance isolation. They did not justify a
    second migration pipeline or a framework-owned app schema history.
- Decision:
  - Close Framework Release Gate 1 and archive its product contract at the
    completed canonical path.
  - Keep apps as owners of document versions and domain `vN -> vN+1`
    transforms. Keep Core as owner only of hook orchestration, package
    validation/fallback, canonical apply ordering, and observational
    diagnostics.
  - Keep one synchronous load pipeline for direct `core.load(...)` and
    persistence-provider loads: nullish bypass or raw document, ordered app
    hooks, all package validation, canonical apply, then diagnostics.
- Consequences:
  - Public `VersionedLoadDocument` and stable load-hook failures define the
    synchronous boundary; Promise-like and structurally invalid hook results
    fail before package validation or partial canonical apply.
  - Owner-issued, instance-bound validation artifacts prevent forged,
    cross-instance, reused, or post-validation-mutated results from bypassing
    package validation. Hook and diagnostics registrations remain isolated per
    Core instance.
  - Diagnostics evidence is detached, lazily assembled only after successful
    canonical apply, and fully failure-contained; it cannot change migration,
    validation, or apply outcomes.
  - No app-specific version branch, UI migration authority, duplicate state
    owner, or compatibility fallback was added to framework packages.
  - Release Gate 2 (Yjs) is next in sequence but may begin implementation only
    after its own product contract and Inspector pass readiness review. This
    closeout does not authorize push, pull request creation, merge, release, or
    publication.
- Related Plan:
  - `docs/ai/framework/plans/completed/props-manager-app-level-migration-plan.md`
  - `docs/ai/framework/plans/app-level-migration-flow-inspector.data.cjs`
  - `docs/ai/framework/PLANS.md`
- Related Commit(s):
  - pending local closeout commit

## 2026-07-19 - Correct app-level migration dispatch semantics

- Context:
  - A later product-contract review clarified that independent app migration
    steps are not an unconditional Core hook queue and that version identifiers
    need not be numerically adjacent.
  - Rejecting an otherwise well-formed document only because its string version
    had no registered transition hid app compatibility behavior that should
    remain visible to the app and its package validators.
- Decision:
  - Keep app schema history outside framework packages. Validate one complete
    app-owned batch as a connected linear migration chain with one head and one
    tail, allowing opaque non-contiguous version identifiers but rejecting
    incomplete or sparse batches, disconnected components, branches, merges,
    duplicate sources/targets, self-transitions, and cycles before Core
    registration.
  - Compile the batch into one synchronous app dispatcher registered through
    `core.registerLoadHook(...)`. For each matched current version, run exactly
    that transform, require its declared target version, and continue lookup on
    the returned document without recursively entering `core.load(...)`.
  - Permit one non-empty helper installation per Core instance. Reject a second
    non-empty registration before adding another hook so app schema history
    cannot be split across dispatchers. Empty batches do not claim the slot;
    the instance-isolated guard remains app-owned rather than becoming a Core
    schema registry.
  - Treat no matching version as normal migration termination and pass the
    document unchanged to Core normalization and mandatory package validation.
    Keep missing-version eligibility, thrown transforms, invalid transform
    results, and asynchronous transform results as app-owned migration failures.
- Consequences:
  - A document can begin at any registered point and runs only the remaining
    suffix; an already-terminal, unknown, or future string version runs no
    transform and remains observable by normal app/package behavior.
  - The app dispatcher contains rejected transform Promises and reports stable
    invalid/asynchronous app migration errors before package validation. Core's
    existing hook ordering, direct/provider parity, validation/apply atomicity,
    diagnostics containment, and instance isolation remain unchanged.
  - This contract correction does not perform a closeout, change any release
    gate state, start Release Gate 2, or authorize push, pull request, merge, or
    publication. Those actions remain subject to explicit user direction.
- Related Plan:
  - `docs/ai/framework/plans/completed/props-manager-app-level-migration-plan.md`
  - `docs/ai/framework/plans/app-level-migration-flow-inspector.data.cjs`
- Related Commit(s):
  - pending local contract-correction commit

## 2026-07-19 - Confirm app-level migration Gate 1 closeout

- Context:
  - PR #90 merged the app-level migration formalization and its corrected
    connected-dispatch semantics into `main` at `19bbe2c51`.
  - The completed plan record, dedicated Inspector, public contracts, reusable
    example, and formal tests now describe the same app-owned version-chain and
    framework-owned load orchestration boundary.
  - The user explicitly authorized final closeout after that merge.
- Decision:
  - Confirm Framework Release Gate 1 as closed without creating a second plan
    record or moving schema-history ownership into framework packages.
  - Retain the completed plan at its canonical completed path and keep Gate 1
    absent from `PLANS.md`.
  - Keep Framework Release Gate 2 as the next gate. This closeout does not start
    its implementation; its product contract and dedicated Inspector must pass
    readiness first.
- Consequences:
  - The final Gate 1 contract is the single synchronous direct/provider load
    flow shipped by PR #90: raw input, the app-owned connected migration
    dispatcher and any later hooks, mandatory package validation/fallback,
    atomic canonical apply, then observational diagnostics.
  - No production behavior changes are required by this closeout record.
  - This closeout does not authorize merge, release, tag, or publication.
- Related Plan:
  - `docs/ai/framework/plans/completed/props-manager-app-level-migration-plan.md`
  - `docs/ai/framework/plans/app-level-migration-flow-inspector.data.cjs`
  - `docs/ai/framework/PLANS.md`
- Related Commit(s):
  - `19bbe2c51` (`feat(framework): formalize connected app migrations`, PR #90)

## 2026-07-19 - Implement optional Yjs collaboration foundation without closeout

- Context:
  - Gate 2 began from PR #91 merged into the latest `main` and a dedicated Yjs
    Network Collaboration Inspector that passed readiness before production
    implementation.
  - Existing Factory shared channels already owned local projection,
    transaction-end buffering, immediate delivery, rollback, and transaction
    history, but the old local Yjs convenience was not an explicit
    provider/room/canonical-apply product contract.
- Decision:
  - Keep Factory as local transaction/history/shared-settlement owner and make
    its local channels Y.Doc-free. A committed action, undo, redo, or formal
    rollback compensation becomes detached semantic delivery only after the
    owning transaction boundary permits it.
  - Add explicit optional `@asyra/collaboration` composition for instance-owned
    Y.Doc, replaceable provider, Awareness, collaboration update persistence,
    stable operation envelopes, instance-local dedupe, permission/conflict
    policy, and remote Factory transaction/canonical apply.
  - Keep auth, room access, durable backend policy, and non-commutative domain
    conflict semantics app/server owned. Keep Yjs, provider state, Awareness,
    durability outcomes, Render, and UI non-authoritative.
  - Distinguish runtime commit, local update persistence, network send and
    convergence, and durable acknowledgement. Use state-vector exchange for
    missing updates and a separate ephemeral Awareness route.
- Consequences:
  - Apps that omit collaboration create no Y.Doc, provider, room, Awareness,
    collaboration persistence, or network side effect. Construction is inert;
    `Collaboration.start()` is the explicit activation point.
  - Identical local/remote replay is deterministic, operation-ID collision is
    rejected, remote apply cannot echo or enter ordinary local undo, and
    immediate rollback compensation re-enters the normal inbound pipeline.
  - `MemoryProvider` and persistence adapters are reference implementations,
    not mandatory authorities.
  - This record documents implementation direction only. Gate 2 remains active;
    it does not move the plan, declare closeout, or authorize push, pull request,
    merge, tag, release, or publication.
- Related Plan:
  - `docs/ai/framework/plans/network-collaboration-transport-plan.md`
  - `docs/ai/framework/plans/network-collaboration-transport-flow-inspector.data.cjs`
  - `docs/ai/framework/plans/collaborative-conflict-policies-plan.md`
- Related Commit(s):
  - local Gate 2 implementation commits on
    `codex/yjs-network-collaboration-foundation`

## 2026-07-20 - Batch collaboration by synchronous delivery action

- Context:
  - One synchronous app action can create several low-level transactions across
    elements or state owners. Sending each transaction independently creates
    avoidable transport overhead.
  - Remote peers need canonical element creation and geometry before pointer-up,
    not a second Awareness-owned document preview.
- Decision:
  - `sharedDelivery` selects complete shared-pipeline timing. `immediate`
    publishes without waiting for the outer transaction; `transaction-end`
    waits for commit.
  - Batch all changes made by one synchronous immediate delivery action into
    one ordered publication, one Y.Doc transaction/update, and one provider
    send. Do the same for one committed transaction-end batch.
  - Preserve the app-authored timeline, including repeated A -> B -> C -> B;
    Factory and collaboration do not semantically deduplicate it.
  - Forward one remote event unchanged to its registered state owner. Keep an
    ordered batch as one event through rollback, undo, and redo; the state owner
    alone interprets and applies its entries.
  - Keep canonical element creation and geometry out of Awareness.
- Consequences:
  - A pointer session may emit mouse-down, selected drag-update, and conditional
    mouse-up publications while remaining one local undo commit.
  - Already-published immediate entries are not sent again at transaction end.
    Pre-flush rollback discards the pending batch; post-publication rollback
    emits one linked reverse compensation batch.
  - Awareness remains optional ephemeral presence and never becomes a canonical
    element transport.
  - Factory no longer rewrites a state-owner batch into scalar app operations.
- Related Plan:
  - `docs/ai/framework/plans/network-collaboration-transport-plan.md`
  - `docs/ai/framework/plans/network-collaboration-transport-flow-inspector.data.cjs`
- Related Commit(s):
  - pending local Gate 2 validation

## 2026-07-21 - Simplify collaboration ownership and public API boundaries

- Context:
  - A package-wide review found implementation-oriented names, mixed operation
    pipeline responsibilities, combined provider/persistence owners, and root
    exports for helpers that app composition does not consume.
  - Framework Release Gate 2 is still pre-release, so compatibility aliases
    would preserve an API that has not yet become a release contract.
- Decision:
  - Use `Collaboration` in `collaboration.ts` as the public lifecycle owner and
    keep `createCollaboration(...)` as the composition entry. Process each
    Factory publication through the internal `processPublication` boundary.
  - Group envelope, registry, outcome, validation, conflict, and canonical
    apply owners under `operations/`, and keep their pipeline helpers internal.
  - Use the public `Provider`, `MemoryHub`, and `MemoryProvider` contracts. Split
    memory room/author validation from client lifecycle/subscriptions.
  - Keep `UpdatePersistence` and `MemoryPersistence` separate from the internal
    `Durability` coordinator. Use `Awareness` as the ephemeral state owner with
    app-owned JSON-safe fields and only `heartbeatAt` reserved for framework
    liveness.
  - Export only app composition, provider, persistence, policy, awareness,
    durability observation, envelope type, and canonical apply contracts from
    the package root; do not add aliases for the superseded names.
- Consequences:
  - App and reference-server consumers use shorter package-context names while
    provider wire messages, room identity, operation envelopes, validation
    order, transaction behavior, reconnect, acknowledgement, and Awareness
    semantics remain unchanged.
  - Each source file or folder has one primary owner, and Inspector
    implementation boundaries point to the new canonical paths.
  - This decision does not close Gate 2 or authorize push, pull request, merge,
    tag, release, or publication.
- Related Plan:
  - `docs/ai/framework/plans/network-collaboration-transport-plan.md`
  - `docs/ai/framework/plans/network-collaboration-transport-flow-inspector.data.cjs`
- Related Commit(s):
  - pending local Gate 2 validation

## 2026-07-21 - Keep collaborative entity identity in the canonical ID owner

- Context:
  - Independent pages begin with the same local component and property
    counters, so simultaneous creation can otherwise reuse an app entity ID.
  - A collaboration-layer payload comparison or winner rule would duplicate
    app state semantics and cannot repair every nested property identity.
- Decision:
  - Let the Utils ID owner optionally namespace non-default registered counters.
  - Have Asyra Design use its full per-page actor identity as that namespace
    before collaborative actions begin.
  - Accept IDs from other namespaces without advancing the local namespace's
    numeric counter; keep ordinary non-collaborative IDs unchanged.
- Consequences:
  - Concurrent element, component, and property creation is cross-actor unique.
  - Collaboration continues to transport validated operations unchanged and
    owns no same-entity-ID winner policy.
- Related Plan:
  - `docs/ai/framework/plans/network-collaboration-transport-plan.md`
- Related Commit(s):
  - pending local Gate 2 validation

## 2026-07-21 - Consolidate repository contracts by semantic owner

- Context:
  - Repository-wide maintenance found repeated low-level geometry, numeric,
    diagnostic, vector-selection, property-config, icon, and test-action
    implementations, plus anonymous contract variants and filenames that did
    not communicate their primary responsibility.
  - Identical-looking helpers are not automatically the same contract: adapter
    cloning, untrusted-input freezing, and renderer-local replay closures can
    have different owners and change independently.
- Decision:
  - Centralize only behavior with the same semantics and owner. Put pure
    numeric, geometry, registration-key, validation, and diagnostic dispatch
    primitives in Utils; canonical vector control identifiers and point-target
    projection in Core; official vector selection ids and synthetic-handle
    presentation defaults in Preset; and property-component config cloning in
    Props Manager.
  - Share app property icons and E2E action helpers inside Asyra Design without
    moving app behavior into framework packages.
  - Keep separate identity clones at provider adapter boundaries, separate deep
    freezes at distinct untrusted-data boundaries, and tiny renderer-local path
    replay closures. Their similar implementation does not establish shared
    ownership.
  - Prefer named contract variants and responsibility-based module names.
    Classify supported package contracts under `docs/ai/framework/packages/`
    and archive historical audits or superseded notes under `docs/ai/project/`.
- Consequences:
  - Shared behavior now has one canonical implementation without creating a
    miscellaneous cross-layer owner or changing product behavior.
  - Remaining repetition is deliberate, local to its trust or adapter boundary,
    and may evolve independently.
  - The three repository-wide maintenance plans remain active until user review;
    this decision does not authorize closeout, push, merge, tag, release, or
    publication.
- Related Plan:
  - `docs/ai/framework/plans/project-wide-duplicate-contract-and-ownership-consolidation-plan.md`
  - `docs/ai/framework/plans/project-wide-code-readability-analysis-and-refactor-plan.md`
  - `docs/ai/framework/plans/project-wide-documentation-contract-audit-plan.md`
- Related Commit(s):
  - local repository-maintenance commits on
    `codex/yjs-network-collaboration-foundation`

## 2026-07-22 - Correct repository-maintenance review findings

- Context:
  - Independent review found that the maintenance plans still declared a
    queued state after implementation, Factory and Scene Tree retained the
    same own-value descriptor helper, and a public diagnostics primitive used
    across Render, Preset, and the app still carried a stroke-specific name.
- Decision:
  - Keep all three maintenance plans active but mark implementation and repair
    work complete while they await explicit user review and closeout approval.
  - Put the domain-neutral `setOwnEnumerableValue(...)` primitive in Utils and
    let Scene Tree canonical apply/replay and Factory patch inversion consume
    that single owner. Keep patch meaning and special-key behavior unchanged.
  - Name the optional observation primitive `emitDiagnosticCounter(...)`, its
    callback `DiagnosticCounterSink`, and its global hook
    `__asyraDiagnosticCounterSink`. Counter names, values, timing, budgets, and
    product behavior remain unchanged; no compatibility alias is retained for
    the unreleased stroke-specific vocabulary.
- Consequences:
  - Special own-property materialization now has one implementation while the
    Render Delta Inspector still assigns semantic state and transport behavior
    to Scene Tree and Factory respectively.
  - The Utils diagnostics API now describes all current consumers without
    implying that stroke owns Render, UI Context, vector, or projection
    counters.
  - This correction does not close or archive the maintenance plans and does
    not authorize push, merge, tag, release, or publication.
- Related Plan:
  - `docs/ai/framework/plans/project-wide-duplicate-contract-and-ownership-consolidation-plan.md`
  - `docs/ai/framework/plans/project-wide-code-readability-analysis-and-refactor-plan.md`
  - `docs/ai/framework/plans/project-wide-documentation-contract-audit-plan.md`
- Related Commit(s):
  - `d46d7cc3c` (`refactor(utils): centralize own property writes`)
  - `0eb306f91` (`refactor(utils): generalize diagnostic counters`)

## 2026-07-22 - Complete bounded maintenance review corrections

- Context:
  - Final maintenance review found that an optional diagnostic sink could
    still throw into product flow, Factory retained two implementations of the
    same detached-value clone, several exact type contracts had parallel
    declarations, and four existing Utils consumers repeated unit clamping.
- Decision:
  - Isolate diagnostic sink failures and prove the rule through the Utils test
    and Render Delta Inspector contract.
  - Use one Factory-internal clone primitive for transaction journals, local
    shared channels, deliveries, and publications while preserving the
    mutation-time detached snapshot contract.
  - Keep raw render-layer registration owned by Render, Core facade callback
    ownership in Core, structural vector intent ownership at the Asyra Design
    element common-API boundary, and canonical vector selection/state shapes
    in Core.
  - Use Design System's public icon-name contract, one Props Manager
    registration-options contract, one Utils registration-owner contract, and
    Utils-owned point/rect/bounds/transform/RGBA primitives across Render,
    Preset, and Asyra Design. Domain-specific public names remain aliases when
    they communicate consumer meaning.
  - Route Asyra Design overlay system-property reads through the Core facade and
    keep one app E2E helper for workspace-rectangle center projection.
  - Express empty function exits with `return` and keep explicit `undefined`
    for expression/data positions. Reuse Utils `Bounds` for app Bézier bounds.
  - Share repeated owner-local workflows for app property interaction
    transactions, vector-icon snapshots/events, Feature System input snapshots,
    and Preset computed-key pending state without moving their behavior across
    package boundaries.
  - Reuse the existing Utils `clampUnit(...)` primitive only in consumers that
    already depend on Utils and implement the identical numeric contract.
- Consequences:
  - Optional diagnostics cannot change canonical product outcomes.
  - The consolidated implementations and type declarations retain their
    existing runtime payloads, transaction behavior, dependency direction, and
    app-owned collaboration policy.
  - Similar but independently owned adapter, trust-boundary, opacity, and
    concrete-renderer code remains separate. The maintenance plans remain
    active until user review and explicit closeout approval.
- Related Plan:
  - `docs/ai/framework/plans/project-wide-duplicate-contract-and-ownership-consolidation-plan.md`
  - `docs/ai/framework/plans/project-wide-code-readability-analysis-and-refactor-plan.md`
  - `docs/ai/framework/plans/project-wide-documentation-contract-audit-plan.md`
- Related Commit(s):
  - `b9e4b2869` (`fix(utils): isolate diagnostic observer failures`)
  - `57ee6bb00` (`refactor(factory): centralize detached value cloning`)
  - `45a922d2e` (`refactor(types): consolidate shared contracts`)
  - `dcfc39194` (`refactor(utils): reuse canonical unit clamp`)
  - `b471e1621` (`refactor(types): finish shared contract ownership`)
  - `16f441157` (`refactor(asyra-design): reuse app boundary contracts`)
  - `67b34e31a` (`refactor(readability): finish empty return cleanup`)
  - `c4f6f8d3f` (`refactor(readability): consolidate repeated local workflows`)

## 2026-07-22 - Close repository-wide maintenance plans

- Context:
  - The documentation-contract audit, duplicate/ownership consolidation, and
    readability refactor were implementation-complete and retained as active
    plans only for product-owner review.
  - A second bounded review at baseline `478bec0be` repeated the frozen
    candidate classes and search methods, found no new concrete finding, and
    passed the applicable focused and repository gates.
- Decision:
  - Close all three maintenance plans and preserve their detailed records under
    `docs/ai/framework/plans/completed/`.
  - Remove the active maintenance block from `PLANS.md` and route future
    equivalent requests to the completed records.
  - Preserve preceding decision entries unchanged. This closeout does not close
    or advance a Framework Release Gate.
- Consequences:
  - `PLANS.md` now tracks only active or deferred framework work.
  - The completed audit scope, method, and evidence remain available without
    being treated as an active or unlimited repository claim.
  - Future repository-wide maintenance is new bounded work rather than an
    implicit reopening of this completed snapshot.
- Related Plan:
  - `docs/ai/framework/plans/completed/project-wide-documentation-contract-audit-plan.md`
  - `docs/ai/framework/plans/completed/project-wide-duplicate-contract-and-ownership-consolidation-plan.md`
  - `docs/ai/framework/plans/completed/project-wide-code-readability-analysis-and-refactor-plan.md`
- Related Commit(s):
  - `4308f12e7` (`docs(plans): archive repository maintenance plans`)

## 2026-07-22 - Limit framework collaboration to live publication transport

- Context:
  - The Gate 2 implementation stored app operation envelopes in a Y.Doc,
    retained provider room history, replayed state vectors, and made framework
    decisions about dedupe, permission, and conflict processing.
  - Factory already defines the complete ordered `SharedPublication` boundary,
    while app/backend owners have the context required for route validation,
    canonical apply, authorization, persistence, recovery, ordering, and domain
    conflict behavior.
- Decision:
  - Make one detached Factory `SharedPublication` the Provider transport unit.
  - Preserve every publication and delivery in order, including repeated
    values, undo, redo, and compensation; send once and discard after transport
    settlement.
  - Deliver one inbound publication to one app callback. The app owns one
    remote transaction and all semantic validation or policy.
  - Keep Provider lifecycle, live-room fanout, acknowledgement, failures, and
    separate Awareness in `@asyra/collaboration`.
  - Remove Yjs, semantic operation history, state vectors, reconnect replay,
    update persistence, dedupe, permission, and conflict-policy APIs from the
    collaboration package. Do not add TTL, timestamps, LWW, rebase, snapshots,
    authentication, or authorization.
- Consequences:
  - Reconnect restores a live connection only; app/backend code owns canonical
    refresh or missed-change recovery.
  - Apps without collaboration keep their ordinary HTTP/load/save behavior.
  - Release Gate 2 and its Inspector are renamed to the network collaboration
    transport foundation; framework conflict policy is no longer an active
    sub-plan.
- Related Plan:
  - `docs/ai/framework/plans/network-collaboration-transport-plan.md`
  - `docs/ai/framework/plans/network-collaboration-transport-flow-inspector.html`

## 2026-07-23 - Close network collaboration transport Release Gate 2

- Context:
  - The transport-only collaboration implementation and its bounded corrective
    work were complete, all formal Gate 2 gates passed, and the product owner
    confirmed the real multi-window CRDT behavior was operating normally.
- Decision:
  - Close Framework Release Gate 2 and preserve its canonical product contract
    under `docs/ai/framework/plans/completed/`.
  - Keep the dedicated Inspector active as the architecture authority, pointed
    at the completed product contract.
  - Keep the durable Asyra Design collaboration server plan queued and inactive
    until the user explicitly starts its required contract rebase.
- Consequences:
  - `PLANS.md` now starts with Framework Release Gate 3; this closeout does not
    begin Gate 3 automatically.
  - Optional live publication transport, app-owned remote apply, live-only
    reconnect, and separate Awareness remain the supported Gate 2 contract.
  - Historical decision links continue to resolve through the original plan
    path, which now redirects to the canonical completed record.
- Related Plan:
  - `docs/ai/framework/plans/completed/network-collaboration-transport-plan.md`
  - `docs/ai/framework/plans/network-collaboration-transport-flow-inspector.html`

## 2026-07-24 - Close Group component and hierarchy Release Gate 3

- Context:
  - Gate 3's canonical hierarchy, transaction, Preset Group geometry,
    persistence, transport boundary, app-owned remote apply, and identity-safe
    Render projection were complete.
  - All local release gates and PR #93 checks passed, and the product owner
    explicitly approved closeout.
- Decision:
  - Close Framework Release Gate 3 and preserve its canonical product contract
    under `docs/ai/framework/plans/completed/`.
  - Keep the dedicated Inspector active as the architecture authority, pointed
    at the completed product contract.
  - Keep Group interaction, selection, shortcuts, Layers presentation, and
    remote permission/order/conflict policy app-owned.
- Consequences:
  - `PLANS.md` now starts with Framework Release Gate 4; this closeout does not
    begin Gate 4 automatically.
  - Asyra Design may now implement its two active Group app plans on top of the
    merged Gate 3 framework contract.
  - Historical links continue to resolve through the original plan path, which
    now redirects to the canonical completed record.
- Related Plan:
  - `docs/ai/framework/plans/completed/group-component-and-hierarchy-behaviors-plan.md`
  - `docs/ai/framework/plans/group-component-and-hierarchy-flow-inspector.html`

## 2026-07-25 - Close optional AI Agent Runtime Release Gate 4

- Context:
  - Framework Release Gate 4 required an optional provider-replaceable agent
    runtime without making model output, provider credentials, permission,
    transaction history, canonical state, Render, or Collaboration framework
    policy.
  - Readiness completed before implementation, and the finished package,
    generic HTTP adapter, Feature lifecycle, reference app composition,
    canonical/transaction/projection proofs, documentation, and deterministic
    tests passed without a live endpoint or API key.
- Decision:
  - Ship `@asyra/ai-agent-runtime` as an inert-until-composed orchestration
    package with app-owned context, schema-backed actions, permission,
    confirmation, transaction runner, and domain executors.
  - Treat provider output as an untrusted candidate plan; normalize and
    validate the complete plan before permission or mutation, retry only
    provider planning, and execute one accepted action batch through one
    app-owned transaction.
  - Keep providers replaceable through `AiProvider`; include a generic
    HTTPS/same-origin HTTP adapter with no SDK/schema dependency or implicit
    credential read.
  - Return only stable detached redacted terminal evidence and keep Feature
    System as the sole trigger/exclusivity/cancel/session lifecycle owner.
  - Close Gate 4 and preserve its canonical product contract under completed
    plans while retaining the dedicated Inspector as architecture authority.
- Consequences:
  - Apps without explicit AI activation have no AI runtime, Feature, provider,
    network, timer, listener, or secret side effect.
  - Apps may replace fake, generic HTTP, self-hosted, or vendor-specific
    providers without changing registered action, validation, permission, or
    transaction contracts.
  - API keys, backend authentication, rate limits, and vendor repair remain
    app/backend responsibilities; live-provider smoke tests remain opt-in.
  - `PLANS.md` now advances to Framework Release Gate 5 readiness/closeout.
- Related Plan:
  - `docs/ai/framework/plans/completed/ai-agent-runtime-plan.md`
  - `docs/ai/framework/plans/ai-agent-runtime-flow-inspector.html`
- Related Commit(s):
  - `b8bdd5fb4` (`docs(framework): ready AI agent runtime gate`)
  - `d37bbdd95` (`feat(ai-runtime): add optional runtime composition`)
  - `11677fa7a` (`feat(ai-runtime): add generic HTTP provider`)
  - `2715faf32` (`feat(ai-runtime): add single plan transaction boundary`)
  - `4721938da` (`feat(ai-runtime): add detached audit output`)
  - `87ff206b0` (`feat(ai-runtime): orchestrate complete agent invocations`)

## 2026-07-29 - Close canonical projection and collaboration contract realignment

- Context:
  - Canonical property/structural evidence and local-only computed projection
    previously overlapped, while shared data, Provider, Core, Scene Tree, and
    Factory exposed conflicting batch or compatibility paths.
  - The synchronized Inspector, executable BDD, affected framework package
    gates, production build, default 16-item two-actor CRDT gate, and
    high-detail two-actor correctness flow passed.
- Decision:
  - Keep one origin-neutral canonical owner flow with separate Props and Scene
    missions, one plural Core creation path, required batch shared-data and
    Provider contracts, the existing Factory journal and Undo boundary, and
    one separate minimal `SharedPublication`.
  - Keep computed projection local-only and keep remote transactions free of
    local Undo, echo, and client persistence.
  - Close the prerequisite and resume the Asyra Design performance plan for
    its remaining performance-equivalence gates.
- Consequences:
  - The dedicated framework Inspector remains architecture authority and now
    points to the completed contract record.
  - The Asyra Design performance plan and its Inspector remain the authority
    for any explicitly retained app performance or visual closure.
  - No live provider, backend database checkpoint, package installation,
    runtime upgrade, push, PR, merge, or release is implied by this closeout.
- Related Plan:
  - `docs/ai/framework/plans/completed/canonical-projection-and-collaboration-contract-realignment-plan.md`
  - `docs/ai/framework/plans/canonical-projection-and-collaboration-contract-flow-inspector.html`

## 2026-08-03 - Accept load-only Core and socket-authoritative App persistence target

- Context:
  - Core currently captures, deeply detaches, and queues a complete
    `CoreRawData` snapshot after every committed action, Undo, and Redo.
  - On the 7,076-element Asyra Design document, selection and History actions
    spend most of their visible delay in this full-document persistence work,
    while Factory publication and UI projection remain small.
  - Asyra Design will keep a socket session active for one-Actor as well as
    multi-Actor document editing.
- Decision:
  - Remove commit-triggered snapshot persistence from Core in the accepted
    target while retaining canonical load and explicit serialization.
  - Keep Factory's existing immutable `SharedPublication` as the only client
    document-change unit; do not expose private Undo History or create a
    persistence-specific Factory artifact.
  - Keep generic Collaboration provider-neutral. The App socket server owns
    handshake, sequence, live fan-out, a fixed three-second dirty-window queue,
    retry, and durable-watermark tracking; the App backend owns ordered
    materialization.
- Consequences:
  - Runtime commit, socket acceptance, peer apply, and backend durability remain
    distinct states.
  - Selection and other non-document state cannot trigger persistence merely
    because they are transaction-bounded or undoable.
  - The target is not implemented; current Core and App persistence behavior
    remains until the active Inspector slices and formal gates pass.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/socket-authoritative-document-persistence-plan.md`
- Related Inspector:
  - `docs/ai/apps/asyra-design/plans/socket-authoritative-document-persistence-flow-inspector.data.cjs`
- Related Commit(s):
  - pending

## 2026-08-04 - Implement the load-only Core persistence boundary

- Context:
  - The accepted App persistence plan has completed its framework-facing Core,
    Factory, Persistence, and Collaboration contract work.
- Decision:
  - Remove automatic full-document capture and provider save from Core action,
    Undo, and Redo settlement.
  - Preserve canonical checkpoint load and explicit detached serialization as
    separate Core operations.
  - Preserve Factory `SharedPublication` as the sole bounded canonical
    publication and keep generic Collaboration free of App recovery or backend
    persistence policy.
- Consequences:
  - Transaction completion no longer implies a persistence snapshot boundary.
  - Selection and other ephemeral state cannot trigger document persistence.
  - App transport recovery and backend durability remain explicit
    App-owned acknowledgement domains.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/socket-authoritative-document-persistence-plan.md`
- Related Commit(s):
  - pending

## 2026-08-04 - Separate Group operation snapshots from live content bounds

- Context:
  - Preset treated Group `x/y/width/height` as an eagerly synchronized cache
    and rewrote ancestor Groups after every descendant geometry change.
  - Core scene bounds also unioned invisible Group snapshot rectangles with
    visible descendant geometry.
- Decision:
  - Group `x/y` remain canonical container translation; `width/height` remain
    operation-produced document snapshots and are not refreshed by
    descendant-only mutation.
  - Preset Group projection requires explicit official Group target ids.
    Child-only updates return unchanged without Scene Tree or computed reads.
  - Selected Group content bounds and Group overlay bounds are read-only
    consumer projections.
  - Core world-scene bounds union visible non-Group rectangles and use Group
    translation only while traversing descendant parent chains.
- Consequences:
  - Descendant writes no longer cause ancestor traversal, sibling rebasing,
    Group-sized History, or Group-sized publication.
  - Zoom fit and Group UI remain aligned with current visible descendants
    without making read operations canonical mutations.
- Related Plan:
  - `docs/ai/framework/plans/completed/group-component-and-hierarchy-behaviors-plan.md`
- Related Inspector:
  - `docs/ai/framework/plans/group-component-and-hierarchy-flow-inspector.data.cjs`
- Related Commit(s):
  - pending

## 2026-08-04 - Close Framework Release Gate 5 as READY

- Context:
  - The first-release package set, public API boundaries, optional
    Collaboration and AI side-effect contracts, generated Asyra Design
    template, support records, and retained Gate 1 through Gate 4 authorities
    required one artifact-only release audit.
  - Node.js 20 CI built and validated all release packages, installed only the
    packed artifacts into isolated consumers, ran the generated template, and
    passed the full formal and E2E gates.
- Decision:
  - Record Framework `0.2.5` release readiness as `READY` with no unresolved
    P0/P1/P2 finding.
  - Close Gate 5 under completed plans while retaining the release-readiness
    Inspector as architecture authority.
  - Keep release readiness distinct from merge, tag, registry publication,
    deployment, and formal release authority.
- Consequences:
  - All 19 public packages have one frozen artifact owner and reproducible
    metadata, declaration, import, clean-consumer, and template evidence.
  - `PLANS.md` has no active Framework Release Gate.
  - A separately authorized release cut still owns the immutable
    `v0.2.5` decision snapshot, tag, publication, and any deployment.
- Related Plan:
  - `docs/ai/framework/plans/completed/framework-release-readiness-and-closeout-plan.md`
- Related Inspector:
  - `docs/ai/framework/plans/framework-release-readiness-flow-inspector.data.cjs`
- Related Commit(s):
  - `20bcf3446` through `ba1289239`
- Related Pull Request:
  - [#106](https://github.com/karote00/asyra/pull/106)
