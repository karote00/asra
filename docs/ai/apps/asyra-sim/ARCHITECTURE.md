# Asyra Sim: Intended Architecture and Boundaries

This is App planning, not a claim that the modules, APIs, or 3D capabilities
below already exist. The [R0 contract](specs/robot-workcell-v0.md) owns product
semantics. This document describes ownership, data, and execution boundaries
without preselecting solver internals.

## 1. Existing Framework and Actual Gaps

According to the current
[Framework Essentials](../../framework/FRAMEWORK_ESSENTIALS.md),
[Architecture](../../framework/ARCHITECTURE.md), and
[Release Support](../../framework/RELEASE_SUPPORT.md):

- Core owns lifecycle, registration, and formal state application; Feature
  System owns user intent.
- Apps access scenes, properties, transactions, and projections through public
  Core and App APIs.
- `@asyra/render-engine` provides an engine-neutral contract, but current
  `CUSTOM` support is not a completed 3D engine.
- Production `3D`/`HYBRID`, public Headless Core, and a multi-runtime kernel
  are not available.
- Core does not automatically persist each App change; Sim owns project and run
  persistence.
- Core registration composition locks after startup. Pluggability must not mean
  arbitrary runtime registry mutation.

M0 must use formal small cases to establish whether 3D transforms, camera,
ray selection, render resources, interaction, and lifecycle can use public
boundaries. The term "engine-neutral" does not prove that all 3D operations are
supported.

If general capabilities are missing, propose the smallest Framework-owner
change and test scope first. Do not create a parallel rendering authority,
manipulate package singletons directly, or present a 2D projection as a complete
3D implementation. General Framework extensions need a separately authorized
implementation contract; this plan does not start that work.

## 2. Ownership

| Owner                 | Owns                                                                                        | Does not own                                                          |
| --------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Asyra Framework       | Generic intent, transactions, canonical graph/properties, load validation, render contracts | Robots, analysis methods, collision results, factory rules            |
| Sim App composition   | Renderer, method catalog, UI, storage, and job-lifecycle composition                        | A second intent runtime bypassing the Framework                       |
| Sim workcell domain   | Shared definitions of joints, units, analysis shapes, trajectories, and poses               | Renderer SDK objects or hidden solver state                           |
| Sim experiment domain | Scope, method selection, rules, candidates, and snapshots                                   | Recomputing solver distances to repair reports                        |
| Sim analysis service  | Execution, capability preflight, budgets, isolation, output validation                      | Arbitrary mutation of the editable canonical scene                    |
| Method/solver adapter | Formal analysis and evidence under declared conditions                                      | Silent changes to trajectory, scope, or thresholds; reading UI pixels |
| Sim results/storage   | Immutable runs, comparison, persistence acknowledgement, export, feedback attachments       | Converting partial or unknown into clear                              |
| Render/UI             | Scene and evidence presentation, intent input                                               | Authority over physical correctness or document state                 |

## 3. Proposed Source Organization

Planned locations, not yet created:

```text
apps/asyra-sim/
  src/
    init/                App composition and registration
    features/            User actions and non-mutating analysis tasks
    common-apis/         App mutation/query boundaries
    domain/              Workcell, trajectory, experiment, rules
    analysis/            Preflight, runner, method contracts
    extensions/          Trusted module catalog and adapters
    storage/             Projects, assets, runs, import/export
    render-app/          Engine-neutral render composition
    render-layers/       App analysis-result projections
    ui/                  Workcell, experiment, comparison UI
  samples/               Permanent synthetic examples and formal-case assets
  e2e/                   Normal user workflows
```

Unit and integration tests belong in their owners' `__tests__/` directories,
not disposable diagnostic files. Concrete renderer SDK code belongs in a
separate engine adapter conforming to Framework boundaries. M0 must approve its
final package location and dependencies; do not spread SDK code throughout App
UI.

Start with App-owned modules rather than many new `packages/*`. Extract a
package only when independent distribution or actual cross-App reuse requires
it. Cross-package imports must use public `@asyra/...` entries or approved
subpaths, never repository-private deep imports.

## 4. Editing and Analysis Have Different Lifecycles

### Editing

`UI/import acceptance -> Feature -> App common API -> Core/canonical owner -> Render/UI`

- One editing intent maps to one transaction. Failure and cancellation follow
  the formal rollback contract.
- Scene Tree owns parent-child relationships. Sim stores joint semantics but
  does not maintain a second editable hierarchy.
- Properties are canonical model/experiment definitions. Derived world poses
  are not another independent source of truth.
- Renderer handles, solver bodies, worker messages, and progress do not enter
  the canonical graph.
- Validate and preview imports before acceptance; do not mutate a partial model
  while reading a file.

### Analysis

1. **Sim experiment owner** reads committed definitions and freezes the required
   snapshot.
2. **Sim preflight owner** validates units, scope, pairs, methods, data, and
   resource conditions.
3. **Feature task / Sim runner** executes a non-canonical-mutating async task,
   allocates an owned worker, and passes the signal and budget. No transaction
   spans the entire external wait.
4. **Method adapter** reads only detached, validated model/trajectory/scope data,
   uses shared kinematics semantics, and returns evidence with completeness and
   uncertainty.
5. **Sim result validator** checks the schema, source identity, coverage,
   numerical validity, and method capabilities before producing an immutable
   run result.
6. **Sim result acceptance Feature** commits a run reference or annotations when
   the user retains a result. Storage separately acknowledges persistence of
   external assets and run blobs.
7. **Comparison / Render / Export** consume the same validated result as
   different projections.

Steps 3-5 do not rewrite trajectories, geometry, or thresholds. Task completion
does not mean persistence. If either blob persistence or canonical-reference
acceptance fails, retain an explicit retryable state. Do not claim cross-storage
ACID or report a reference as saved when its content is unavailable.

Once the relevant M0 contracts are ready, create the formal Inspector under
`tools/flow-inspector/inspectors/` with owners, artifacts, routes, failure
owners, and actual file allowlists. This document does not replace the required
Inspector. Its absence blocks implementation, not this initial roadmap.

## 5. Data Categories

| Data                                            | Lifecycle                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Workcell/Trajectory/Experiment/Rule definition  | Editable, undoable, versioned persistence                                                                     |
| Analysis snapshot                               | Immutable run input, independent of camera/UI                                                                 |
| Analysis result                                 | Immutable evidence bound to snapshot and method version; partial results may be retained with explicit status |
| Selected candidate/Annotation/Field observation | User-editable records referencing a run without changing its evidence                                         |
| Playback pose/Progress/Selection                | Transient or derived state; not completed analysis and not per-frame Undo                                     |
| Render mesh/Solver acceleration structure       | Execution resources, not persisted product semantics                                                          |

Assets need stable content/version identities; identical filenames do not imply
identical content. Result freshness follows actual input dependencies, not any
change to the UI document. R0 does not assume a result cache. Do not design
memoization or cross-method result reuse without profiling and an equivalence
oracle. Provenance identity is not a cache design.

## 6. Compute Isolation and Replacement

The first-version direction is a local browser UI with an owned compute worker.
The worker executes detached analysis, not an unsupported Headless Core.

- Workers may import pure domain code, not canonical runtime singletons.
- Trial runs, formal runs, cancellation, timeout, and crashes have explicit
  terminal states.
- Scope or method changes apply to new runs, not in-flight snapshots.
- Replacing a renderer requires recomposition. Two renderer implementations are
  not required merely to prove the boundary.
- Experiments may select among registered method adapters. Installing or
  removing modules requires stopping work and restarting composition.
- Contract tests use a second, simple formal example method to prove
  replaceability, not only a fake callback.

See [extensions-v0.md](specs/extensions-v0.md).

## 7. Persistence, Offline Use, and Privacy

R0 is a locally launched browser workbench. Double-click `file://` operation,
PWA delivery, desktop installers, every browser, and cross-platform support are
not already-decided or automatic capabilities. M0 selects the minimum supported
environment. M5 delivers a local package that nondevelopers can start by
following instructions without cloning the entire monorepo.

Both local storage and portable project export need explicit behavior. Browser
quota and browser-data deletion are not a reliable backup strategy. The App owns
large assets, runs, migrations, persistence failures, recovery, and export
integrity. Do not reuse Design's socket-authoritative server or require login
and a backend for R0.

The default is no external traffic: runtime bundles, examples, fonts, and solver
resources must be locally available. Offline tests and network capture are
gates, not merely checking for a telemetry switch. Private-module trust and
network permissions need separate treatment; worker isolation is not a security
sandbox.

## 8. Independent Delivery Without Splitting the Repository

The App can remain in the monorepo while owning its build, tests, version, and
distribution artifacts. R0 does not require a create-app generator or a public
npm solver package.

M5 must verify the App in a project-local isolated consumer using exact packed
Framework dependencies, not dependency hoisting or private aliases. If unreleased
Framework changes are required, establish a reproducible distribution path;
users must not guess the required Framework branch. An App release does not
authorize Framework publication, merging, tagging, or deployment.

## 9. Forbidden Shortcuts

- Using renderer hit testing as the formal solver.
- Reviving loose frame sampling from the deleted CAD plan as proof of continuous
  analysis.
- Ignoring colliders or unsupported pairs and reporting clear.
- Falling back to a simpler solver after failure without changing the method
  identity and result labeling.
- Adding fixture-specific geometry or downstream answer corrections because
  the UI looks wrong.
- Executing scripts, downloading binaries, or loading third-party plugins
  silently during project load.
- Replacing error handling, numerical validation, or user support with a
  disclaimer.
