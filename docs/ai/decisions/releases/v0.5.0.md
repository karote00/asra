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

## 2026-07-25 - Keep conversational AI progress observational and App-owned

- Context:
  - Asyra Design needs a complete mock conversation and drawing experience
    before a production model endpoint or API key exists.
  - The completed framework runtime already owns orchestration, while App
    product decisions own UI, drawing semantics, confirmation, partial-item
    policy, target identity, and history presentation.
- Decision:
  - Add only an optional detached operational progress observer to the
    framework runtime.
  - Keep mock fixture selection, delay, conversation records, confirmation
    presentation, drawing/update actions, recoverable partial results,
    semantic target hints, and Message Bar Undo/Redo in Asyra Design.
  - Preserve one rejected executor as a fatal transaction rollback, while a
    resolved App partial result may commit successful siblings in one undo
    unit.
  - Expose operational phases and concise explanations only; never expose or
    fabricate model private chain-of-thought.
- Consequences:
  - App UI can follow actual runtime phases without becoming an execution
    owner.
  - Provider replacement, canonical state ownership, Factory history, Render,
    and optional Collaboration routes remain unchanged.
  - Framework Release Gate 4 stays completed; the new capability is tracked by
    the active Asyra Design plan.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-plan.md`

## 2026-07-26 - Add a capacity-appropriate browser persistence provider

- Context:
  - Core already separates committed runtime state from persistence
    acknowledgement, but the LocalStorage reference provider cannot durably
    store Asyra Design's high-detail canonical documents.
- Decision:
  - Add a replaceable structured-clone IndexedDB provider to
    `@asyra/persistence`.
  - Keep Core save scheduling, transaction capture, status reporting, and
    provider replacement unchanged.
  - Let Asyra Design select the new provider and own its one-time legacy
    localStorage migration.
- Consequences:
  - Framework consumers gain a large-document offline browser reference without
    an app-specific persistence queue or fallback snapshot format.
  - Provider failures remain explicit and never redefine whether the preceding
    runtime transaction committed.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-plan.md`

## 2026-08-03 - Move document persistence ownership from Core/browser to the App socket server

- Context:
  - Core's complete-snapshot commit capture couples action cost to full document
    size.
  - Asyra Design now requires one always-connected socket document session for
    single-Actor and collaborative editing.
- Decision:
  - Keep Core as checkpoint load/validation/apply and explicit serialization
    owner, not automatic durability owner.
  - Keep Factory `SharedPublication` as the existing canonical client change
    artifact.
  - Make the Asyra Design socket server the document sequencer, live fan-out,
    fixed three-second persistence-window, retry, and durable-watermark owner.
  - Make the App backend the ordered publication materialization and checkpoint
    owner.
- Consequences:
  - Framework transaction/History contracts stay separate from App persistence
    and backend merge policy.
  - The browser performs no persistence write in the accepted target.
  - The target is pending implementation under one App product specification,
    Level 3 plan, and Flow Inspector.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/socket-authoritative-document-persistence-plan.md`
- Related Commit(s):
  - pending

## 2026-08-04 - Separate App transport recovery from framework and backend persistence

- Context:
  - Asyra Design requires local canonical editing to continue when its mandatory
    socket session is unavailable.
  - Generic `@asyra/collaboration` intentionally owns live transport only, and
    Core no longer owns automatic complete-document persistence.
- Decision:
  - Keep generic Collaboration's no-history/live-only reconnect contract.
  - Place durable unaccepted-publication retention, 30-second reconnect
    scheduling, transition notifications, and server-order reconciliation in
    the Asyra Design collaboration lifecycle.
  - Keep App IndexedDB outbox records limited to immutable
    `SharedPublication` values; no materialized document, private History,
    Selection, Awareness, or Render/UI data enters that outbox.
- Consequences:
  - Framework transaction, History, transport, and load owners stay replaceable
    and free of App persistence policy.
  - Browser transport recovery and backend canonical document persistence are
    explicit separate acknowledgement domains.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/socket-authoritative-document-persistence-plan.md`
- Related Commit(s):
  - pending

## 2026-08-04 - Activate socket-authoritative persistence end to end

- Context:
  - The load-only Core boundary, App recovery outbox, socket sequencer,
    fixed-window persistence queue, and backend materializer now implement the
    accepted cross-layer contract.
- Decision:
  - Treat socket checkpoint-plus-tail bootstrap and Factory publication
    delivery as the single ordinary document-session path.
  - Keep browser recovery limited to unaccepted publications and backend
    persistence limited to server-sequenced canonical batches.
- Consequences:
  - Runtime settlement, socket acceptance, peer apply, and backend durability
    are separate observable states.
  - Missing public services produce a disconnected but locally editable client,
    not an alternate frontend-only persistence mode.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/socket-authoritative-document-persistence-plan.md`
- Related Commit(s):
  - pending

## 2026-08-05 - Sequence runtime migration, package publication, create-app, and public docs

- Context:
  - Framework Release Gate 5 proved project-local artifact readiness without
    merging the implementation or publishing every package.
  - Seven Framework packages still need their initial public `0.2.5`
    publication before one synchronized patch release can be attempted.
  - Asyra Design generated output must follow the canonical app version and
    publicly available Framework dependency versions.
  - Node.js 24 compatibility and Vercel operation must be proven before any
    package publication.
- Decision:
  - Complete Node.js 24 local/CI/Vercel validation first and block publication
    on any failure.
  - Research local exact-version installation separately without implementing
    a new registry or dependency.
  - Establish the missing public `0.2.5` package baseline, then use the
    intentional all-package Changeset patch flow.
  - Defer root Asyra and private Asyra Design version changes, template
    regeneration, and create-app publication until the Framework patch set is
    publicly installable.
  - Build the public Framework marketing/docs site only after package,
    create-app, example, and public documentation versions are stable.
- Consequences:
  - Package release work cannot hide Node.js 24 or Vercel failures.
  - Generated output is never manually repaired or used ahead of its canonical
    source version.
  - Patch versions may advance repeatedly while the process stabilizes; a
    correct minor release remains a later explicit decision.
  - Registry publication, create-app publication, and production deployment
    remain separate irreversible authorization checkpoints.
- Related Plans:
  - `docs/ai/framework/plans/node-24-runtime-upgrade-and-vercel-validation-plan.md`
  - `docs/ai/framework/plans/local-versioned-package-install-research-plan.md`
  - `docs/ai/framework/plans/framework-package-patch-release-plan.md`
  - `docs/ai/framework/plans/completed/create-asyra-design-app-release-plan.md`
  - `docs/ai/framework/plans/asyra-framework-website-plan.md`
- Related Commit(s):
  - pending

## 2026-08-05 - Complete the Node.js 24 runtime prerequisite

- Context:
  - Framework package publication remained blocked until local, CI, generated
    consumer, Asyra Design, and Vercel evidence agreed on one Node.js runtime.
  - The existing Vercel project still selected Node.js 20.x even though
    Vercel supported Node.js 24.x.
- Decision:
  - Make Node.js 24.x the only current supported runtime across repository and
    package manifests, release automation, generated output, CI, and public
    support records while preserving Yarn 4.3.1.
  - Set the existing Asyra Design Vercel project to Node.js 24.x and accept the
    reviewed feature-branch Preview only after its build log, static resources,
    required-file route, and editable frontend smoke passed.
  - Record the migration prerequisite as `READY` with no unresolved P0/P1/P2
    finding.
- Consequences:
  - The next release-sequence plan may begin from one Node.js 24.x contract;
    Node.js 20 is no longer a current support path.
  - The deployed project currently owns static assets only, so no Vercel
    Function or Middleware path exists to waive or test.
  - Merge, package version changes, Changesets, registry or create-app
    publication, tag, production deployment, and formal release remain
    separately authorized operations.
- Related Plan:
  - `docs/ai/framework/plans/completed/node-24-runtime-upgrade-and-vercel-validation-plan.md`
- Related Inspector:
  - `tools/flow-inspector/inspectors/node-24-runtime-upgrade-flow-inspector.data.cjs`
- Related Pull Request:
  - [#107](https://github.com/karote00/asyra/pull/107)
- Related Preview:
  - [Node.js 24 feature-branch Preview](https://asyra-git-codex-node-24-runtime-upgrade-karote00s-projects.vercel.app)
- Related Commit:
  - `e24c021b2f93ba200c728761d400d0ac0a87379d`
