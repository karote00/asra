# Unreleased Cross-Cutting Decision History

Decision log for repo-wide decisions not yet captured in a release snapshot.

Append-only rule: do not edit/delete prior entries; add a superseding entry when decisions change.

## 2026-02-28 - Adopt global decision-history standard across framework and apps

- Context:
  - Decision history started in framework docs and needs to scale to app repos/modules consistently.
- Decision:
  - Define one global history standard in `docs/ai/decisions/*`.
  - Keep scope logs in:
    - framework: `docs/ai/framework/decisions/releases/*`
    - app: `docs/ai/apps/<app>/decisions/releases/*`
    - cross-cutting: `docs/ai/decisions/releases/*`
  - Use append-only history contract across all scopes.
- Consequences:
  - New contributors can trace rationale at framework and app levels with one consistent model.
  - Cross-scope architectural/governance decisions have a dedicated home.
- Related Scope Docs:
  - `docs/ai/decisions/README.md`
  - `docs/ai/framework/decisions/README.md`
  - `docs/ai/apps/asyra-design/decisions/README.md`
- Related Commit(s):
  - pending

## 2026-03-03 - Selection ownership converged on multi-channel SelectionManager contracts

- Context:
  - Framework and Asyra Design app had mixed selection ownership between SelectionManager and app-owned vector point state.
  - Delete/path-editing feature work required deterministic cross-package selection contracts.
- Decision:
  - Converge on channel-first selection ownership for `ELEMENT`, `VECTOR_POINT`, and `VECTOR_SEGMENT`.
  - Keep app `selectedVectorPoint` as a compatibility mirror during migration, not source-of-truth.
  - Remove legacy `VERTEX` selection naming/contracts.
- Consequences:
  - Framework/app boundaries are clearer: selection state ownership is unified in SelectionManager channels.
  - Feature/UI/render state propagation now follows one subscription model across packages.

## 2026-03-04 - Cross-scope alignment on flattened managed system-context properties

- Context:
  - Framework and Asyra Design app were transitioning from grouped system-context snapshots to managed-property ownership.
  - The same behavior needed consistent contracts across framework packages, preset defaults, and app feature consumers.
- Decision:
  - Adopt flattened managed system property keys as the shared contract across framework/preset/app.
  - Use managed-property APIs for system-context mutations at app level (`core.setSystemProperty` / `core.getSystemProperty` paths).
  - Keep snapshot generation generic (registered-key aggregation) rather than framework-hardcoded grouped fields.
- Consequences:
  - App and framework now share one deterministic system property contract.
  - Startup defaults remain preset-owned while runtime mutation paths remain explicit and consistent in app/common APIs.

## 2026-03-04 - Cross-scope UI data boundary set to ui-context published properties

- Context:
  - ui-context scene/selection store surfaces were removed at framework level to keep ui-context focused on derived-property runtime.
  - App-level UI providers still required per-element UI data without crossing into scene-tree runtime internals.
- Decision:
  - Preset publishes default UI-facing element snapshot/index properties (`elementDataMap`, `flattenedElementIds`) through ui-context.
  - App providers consume ui-context properties only for element list/read models.
- Consequences:
  - Framework/preset/app now share one consistent UI data flow boundary (`core`/`ui-context` subscriptions).
  - UI data aggregation ownership stays in preset/app wiring layers, not in ui-context package internals.

## 2026-03-06 - Cross-scope overlay ownership moved to registered layer architecture

- Context:
  - Selection/hover overlay rendering behavior needed app-controlled geometry semantics and panel-originated hover parity.
  - Existing built-in render selection layer ownership conflicted with app-level hover/selection evolution.
- Decision:
  - Shift selection/hover overlay behavior to preset/app registered render layer ownership.
  - Keep `@asyra/render` focused on scene/viewport primitives and external layer registration APIs.
  - Align selection runtime restoration by subscribing to selection events during undo/redo flows.
- Consequences:
  - Framework/app boundary is cleaner: render core provides primitives, app/preset define overlay behavior.
  - Cross-scope hover/selection behavior is now deterministic across canvas interaction, content-panel interaction, and history replay.
- Related App Plan:
  - `docs/ai/apps/asyra-design/plans/completed/hover-state-and-hover-selection-box-plan.md`

## 2026-07-16 - Preset customization uses stable targets and owned lifecycle cleanup

- Context:
  - Preset feature/property defaults were static after registration, which made
    app customization depend on framework or preset internals.
  - Framework, preset, and app needed one deterministic extension/replacement
    contract without introducing generic preset composition or product modes.
- Decision:
  - `@asyra/utils` owns stable target ordering, conflict/error results, and
    retryable cleanup state.
  - `@asyra/preset` owns stable property schema/runtime targets, the app feature
    hook, default installers, and one returned application lifetime.
  - Feature-system and props-manager retain runtime lifecycle ownership; Core
    exposes only curated define/query/unregister delegates.
  - Asyra Design keeps the compatible `applyPreset(core)` startup route and may
    later choose public extensions or successful `unregisterTarget -> redefine`
    without deep imports.
- Consequences:
  - Extension ordering and explicit replace are deterministic and queryable.
  - Active usage and cleanup failures block fallback redefinition without
    duplicate tolerance or hidden default state.
  - Render-engine capability remains unrelated to product-mode selection.
- Related Plan:
  - `docs/ai/framework/plans/extendable-preset-plan.md`
- Related Commit(s):
  - `ac8b5ec14`
  - `a9c395c22`
  - `92e9a0f35`
  - `71b12c1f4`
  - `bf1a424bf`
  - `fff9a72cd`
  - `8009fb4c7`
  - `85915a539`
  - pending app/docs closeout commit

## 2026-07-23 - Workspace automation validates exact build and publish artifacts

- Context:
  - Adding the optional Collaboration package exposed a mismatch between
    package-specific build task names and Turbo's dependency-wide `^` syntax.
  - Successful builds could reuse stale ignored `dist` files while CI,
    deployment, E2E, generated templates, and registry publication followed
    different command paths.
- Decision:
  - Generate package-qualified Turbo tasks with exact package-qualified edges,
    and separate intentional graph rewriting from non-mutating graph checks.
  - Require clean Collaboration builds and validate its actual packed ESM
    artifact through extraction and Node import.
  - Treat generated-template synchronization, template build, root gates, and
    package artifact validation as pre-publication release gates.
  - Restore workspace dependency ranges through a release `finally` boundary.
- Consequences:
  - Root, CI, E2E, server, and deployment builds share one checked workspace
    graph instead of silently regenerating or bypassing it.
  - Stale compiler output and stale generated templates can no longer make a
    release validation appear successful.
  - The future Framework Release Gate 5 still owns the complete all-package
    clean-consumer audit; this decision provides the current automation
    foundation without declaring that gate complete.
- Related Docs:
  - `docs/ai/workflows/package-release-validation.md`
  - `docs/ai/framework/rules/generated-artifacts.md`
  - `docs/ai/framework/packages/collaboration.md`

## 2026-07-23 - Package artifact validation remains an all-package release gate

- Context:
  - A Collaboration-only tarball import check introduced package metadata and
    TypeScript module settings that differed from every other pure TypeScript
    framework package.
  - The generated Asyra Design release template already proves the app's
    consumer-facing public imports against local package builds, while
    Framework Release Gate 5 explicitly owns tarball and clean-consumer
    verification for every published package.
- Decision:
  - Keep Collaboration on the shared framework package build convention.
  - Remove the Collaboration-only package artifact gate from current CI and
    release validation.
  - Validate all published package artifacts together under Framework Release
    Gate 5 instead of establishing a special publication contract for one
    package.
- Consequences:
  - Current release validation continues to cover the workspace graph,
    generated template build, and Collaboration integration without duplicating
    the future all-package release gate.
  - Collaboration no longer carries package-specific Node ESM configuration
    that other framework packages do not share.
- Related Docs:
  - `docs/ai/workflows/package-release-validation.md`
  - `docs/ai/framework/plans/framework-release-readiness-and-closeout-plan.md`
  - `docs/ai/framework/packages/collaboration.md`
