# Asyra Sim: Intended Architecture and Boundaries

This is the intended App architecture under implementation, not a claim that
every module, API, or 3D capability already exists. The [R0 contract](specs/robot-workcell-v0.md) owns product
semantics. This document describes ownership, data, and execution boundaries
without preselecting solver internals.

The original-part geometry refactor supersedes the previous visual/proxy split
as the implemented geometry contract. The domain resolves complete source
triangles and binding placement for rendering and detached version-2 analysis;
neither consumer may independently simplify them. Original-triangle methods
own bounded static and continuous evidence, not the renderer. Admission rejects
missing full geometry, unsupported topology or incompatible methods before Worker
allocation. Storage verifies frozen geometry against original source bytes and
preserves version-1 historical evidence without upgrading its meaning. See
[original-part-method-v1.md](specs/original-part-method-v1.md) for exact semantics.

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

The user approved the smallest necessary Framework-owner changes and tests if
formal CUSTOM proofs establish a missing boundary. Do not create a parallel rendering authority,
manipulate package singletons directly, or present a 2D projection as a complete
3D implementation. Start with the App-owned
[CUSTOM spatial engine](specs/custom-engine-v0.md); do not modify Framework
contracts speculatively or move generic defaults into Preset during this task.

## 2. Ownership

| Owner                 | Owns                                                                                          | Does not own                                                          |
| --------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Asyra Framework       | Generic intent, transactions, canonical graph/properties, load validation, render contracts   | Robots, analysis methods, collision results, factory rules            |
| Sim App composition   | Renderer, method catalog, UI, storage, and job-lifecycle composition                          | A second intent runtime bypassing the Framework                       |
| Sim workcell domain   | Joints, units, complete original parts, native shapes, trajectories, world and relative poses | Renderer SDK objects or hidden solver state                           |
| Sim experiment domain | Scope, method selection, rules, candidates, and snapshots                                     | Recomputing solver distances to repair reports                        |
| Sim analysis service  | Execution, capability preflight, budgets, isolation, output validation                        | Arbitrary mutation of the editable canonical scene                    |
| Method/solver adapter | Formal analysis and evidence under declared conditions                                        | Silent changes to trajectory, scope, or thresholds; reading UI pixels |
| Sim results/storage   | Immutable runs, comparison, persistence acknowledgement, export, feedback attachments         | Converting partial or unknown into clear                              |
| Render/UI             | Scene and evidence presentation, intent input                                                 | Authority over physical correctness or document state                 |

## 3. Source Organization

Owner locations (some later-stage owners are not implemented yet):

```text
apps/asyra-sim/
  src/
    init/                App composition and registration
    engine/              CUSTOM SDK adapter and spatial descriptor
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

### Workbench organization

The UI is organized by Sim responsibility, not by copying Design's directory
tree or introducing its 2D providers, collaboration stack, or server APIs:

- `ui/shell/`: workbench composition, bounded intent callbacks, toolbars,
  hierarchy rows, notices, and panel shells.
- `ui/runtime/`: App-lifetime subscriptions and revision-bound read projections.
- `ui/objects/`: body metadata, independent mount/joint/part fields, and
  non-canonical field-edit helpers.
- `ui/experiments/`: experiment drafts, configuration, acceptance rules,
  preflight presentation, and experiment orchestration.
- `ui/imports/`: trajectory and original-part import controllers and views.
- `ui/results/` and `ui/observations/`: evidence, comparison, retention/export
  orchestration, and separately editable field observations.
- `ui/projects/`: explicit local/portable project operations and their views.
- `ui/viewport/`: transient camera input, projection handoff, and playback.
- `ui/shared/`: small field controls, read-only value subscriptions, keyboard
  eligibility, and error formatting.
- `ui/styles/`: Tailwind entry, native-control base, and light/dark theme tokens.

Keep formal tests beside the owning slice. TSX composes views and small local
input handlers; canonical runtime calls, persistence, asynchronous import
lifecycles, and reusable calculations belong in the matching controller or
helper module. Controllers still dispatch the existing Features; they are not
a second transaction or state owner. Existing `features/`, `common-apis/`,
domain, storage, solver, and renderer boundaries remain authoritative.

Component layout uses Tailwind utilities. Only native control defaults and
theme tokens belong in CSS; semantic classes retained for browser selectors
do not define a parallel component stylesheet system. Keep blank lines between
logical TSX sections and statement groups, wrap long utility lists, and split
by responsibility rather than an arbitrary line-count target. Trivial local
input handlers may remain next to their fields.

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

1. **Sim composition and domain owners** resolve all original source bindings
   from the owned archive; the experiment owner freezes complete detached parts
   and committed definitions into the required snapshot.
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

The runner owns a transient, immutable progress view containing the run/snapshot
identity, validated retained pair count, evaluation/leaf counts, and execution
state. The analysis Feature exposes it through a read-only query. The UI may
poll it while a run is active and releases that polling on completion/unmount;
neither progress nor its update cadence enters canonical state or Undo. Worker
transport batches pair evidence at most ten times per second; terminal evidence
is delivered immediately and includes any pairs not sent in a progress batch.
Counts describe received evidence, not elapsed-work percentages, future runtime,
or a final safety conclusion.

### Shared playback evidence

The analysis-owned `analysis/live/` service retains one admitted input lifetime
and bounded immutable observations indexed by exact sampled time. Its Feature
is non-mutating and cancellable. A cache miss lazily allocates one Worker,
transfers the snapshot once, then sends time-only requests. There is at most one
in-flight sample and one latest pending time. The static invocation uses the
selected installed method, complete geometry, scope and numerical settings.
Neither the animation clock nor the renderer performs geometry queries.

The current cache retains up to 256 samples under the shared evidence-byte cap;
oldest records are evicted first. Normal playback requests a 0.2-second
simulation-time grid so subsequent Play operations can reuse exact samples.
Crossed canonical trajectory keyframes are checked in order before catching up
with the playhead, including after a dropped display frame or the final frame;
only optional intermediate samples may be coalesced. An exact seek starts a new
sampling anchor and does not sweep skipped time. No list of pending frames is
retained. Each missing
sample has a 500 ms execution ceiling (or the smaller experiment time budget),
and the parent watchdog terminates unresponsive work. Partial or failed checks
remain explicitly unknown. These sampled observations are visible in the
experiment panel but never become continuous coverage, an acceptance verdict,
an immutable formal run, or an Undo entry.

An owner-issued input identity allows reuse across Play lifetimes; caller-owned
objects with matching IDs cannot claim that identity. Experiment, candidate,
revision, and warning-acknowledgement changes fence reuse. Committed or rolled
back transactions conservatively invalidate current observations. Retained
historical reports are not deleted: semantic freshness checks exclude changed
geometry, source bindings, trajectories, scope, method/settings, or rules from
current Play reuse.

Compatible formal evidence bypasses live Worker creation. The UI replays
established witness times and preserves continuous-clear certificates; a
finding interval is not interpreted as continuous contact. Live feedback and
formal replay both produce engine-neutral whole-part appearance at the exact
checked pose. Default collision pause restores that pose. Disabling pause
leaves the clock running and labels earlier observations without coloring a
different pose. Precise contact regions and region picking remain planned.

The feedback banner and sampled-observation section own narrow subscriptions.
Seeking fences late responses; leaving playback, hiding the page, formal
analysis, input replacement and runtime disposal retire owned work. No new
Framework render layer, component memo wrapper, solver geometry, or persistent
storage is introduced by playback feedback.

The dedicated `asyra-sim-r0-flow-inspector.data.cjs` under
`tools/flow-inspector/inspectors/` owns exact step boundaries and handoffs.
Re-read it before each segment. This document is not a substitute for that
contract, and an unready later step still blocks that step's implementation.

## 5. Data Categories

### Interactive projection boundaries

The workbench follows the same separation used by Design's viewport API and
fine-grained UI providers, without importing Design's 2D state or socket
architecture. Camera state is viewport-local; canonical workbench reads are
revision-bound, and unrelated hierarchy/experiment panels do not rerender for
each camera or playback sample. Immutable source geometry is prepared for the
current displayed workcell; shared kinematics updates poses independently.
Spatial admission isolates new data and issues immutable products that can
cross later internal handoffs without repeated triangle scans or copies.
Camera-only updates use the registered spatial layer and existing Framework
frame scheduler, never a second engine loop or direct SDK access.

Canonical experiment queries refresh on runtime, candidate, or canonical
revision, not draft-only input. Hierarchy rows consume only their displayed
identity, label, role, joint indicator, visibility, depth, and selection; a
single label edit does not rerender unrelated rows. Experiment scope rows are
isolated from numerical draft fields, and a role change updates only its row.
Mount, joint, and original-placement sections subscribe to their individual
property values and units, never source triangles. The workbench composes
controller/provider lifetimes above independent consumers; changing controller
state does not recreate the whole workbench tree. The current read-only
projection publishes only changed semantic values to their subscribers, without
component memo wrappers or props comparators. Their callbacks merge a section
patch against the latest committed body so an unchanged field view cannot
overwrite a newer name or other section. Projection subscriptions add no
editable model, geometry cache, or transaction.

`WorkbenchView` publishes the current workbench, workcell, body, and experiment
input channels before notifying consumers. React providers own controller
lifetimes; their composed children consume values through `useViewValue`, not
changing context snapshots. `ExperimentFieldsView` keeps scope subscriptions
separate from numerical draft fields, so a threshold edit does not visit scope
subscribers. Playback updates the viewport surface and time caption without
recreating the viewport options or workbench layout. Removed entities release
their subscriptions on unmount; replacement creates fresh editor lifetimes.

The exact navigation and admission contracts remain in
[editing-v0.md](specs/editing-v0.md) and
[custom-engine-v0.md](specs/custom-engine-v0.md). Formal work-count, equivalence,
replacement and browser-profile tests guard these boundaries. This does not
remove full-geometry rasterization cost or establish reference-hardware FPS.

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

Candidate duplication is an App common API invoked through the editing Feature.
It creates independent canonical body/experiment IDs and remaps references inside
one transaction. Optional candidate lineage stores only body-origin correspondence,
not a second hierarchy or geometry model. The runtime's read-only lineage projection
includes newly added bodies under their own identities and omits removed bodies.
Retained runs freeze a complete, one-to-one lineage map for their snapshot when
present. Comparison normalizes identity labels using this explicit map, compares
actual input values, and preserves raw snapshots unchanged. Original projects and
runs without lineage keep their existing canonical identities; names never imply
correspondence. Historical run references remain with their original candidate.

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
