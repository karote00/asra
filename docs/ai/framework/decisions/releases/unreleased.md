# Unreleased Decision History

Decision log for branch-level and post-release work not yet shipped in a tagged framework release.

Append-only rule: do not edit/delete prior entries; add a new superseding entry when decisions change.
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
  - `docs/internal/undoable-option-support-plan.md`
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
  - `docs/internal/framework-enhancement-custom-graphics.md`
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
  - `docs/internal/props-manager-typed-setter-refactor-plan.md`
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
  - `docs/internal/hover-hit-test-performance-plan.md`
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
  - `docs/internal/undoable-option-support-plan.md`
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
  - `docs/internal/props-manager-file-load-validation-plan.md`
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

## 2026-02-28 - Completed plans moved to categorized archive

- Context:
  - `PLANS.md` would keep growing and lose focus if completed items remained inline.
- Decision:
  - Keep `PLANS.md` for active/deferred work.
  - Move completed items into `docs/ai/framework/plans/completed/*` by category.
- Consequences:
  - Active planning stays concise.
  - Historical implementation outcomes remain searchable by category.
- Related Plan:
  - `docs/ai/framework/plans/completed/README.md`
- Related Commit(s):
  - `9dedb25` (`docs(framework): archive completed plans by category`)

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
  - `docs/internal/user-action-completion-event-plan.md`
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

## 2026-02-28 - Framework load validation plan archived as completed

- Context:
  - Load validation pipeline was still listed in near-term plans, but implementation and tests already cover core orchestration + package validation + diagnostics.
- Decision:
  - Move "Framework load validation pipeline" from active near-term plans to completed archive (`plans/completed/load-and-migration.md`).
  - Set next unfinished near-term plan as current pickup: app-level migration pipeline formalization.
- Consequences:
  - Active plan list better reflects remaining work.
  - Load validation work is preserved as completed history with references.
- Related Plan:
  - `docs/ai/framework/PLANS.md`
- Related Commit(s):
  - `449cb77` (`feat(framework): add load diagnostics pipeline and app-level reporting hook`)

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

## 2026-02-28 - Archive completed load-validation plan and keep active list focused

- Context:
  - Load-validation pipeline work was complete, but still listed as active.
- Decision:
  - Move load-validation plan from active to completed archive and keep active planning focused on unfinished work.
- Consequences:
  - `PLANS.md` remains concise and better reflects current execution priorities.
- Related Plan:
  - `docs/ai/framework/plans/completed/load-and-migration.md`
- Related Commit(s):
  - `61fccfa` (`docs(plans): archive completed load validation pipeline`)

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
  - `docs/internal/user-action-completion-event-plan.md`
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
  - `docs/ai/framework/plans/completed/events-and-registry.md`
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
  - pending (current working tree)
