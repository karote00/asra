# R0: Robot Workcell Experiment Contract

This document defines first-version product targets, not implemented
capabilities. M0 must freeze the numerical support envelope; M3 and M5 must
verify it. Planning is not evidence of accuracy.

[PRODUCT.md](../PRODUCT.md) owns the mission;
[ARCHITECTURE.md](../ARCHITECTURE.md) owns execution boundaries.

## 1. Supported Workcell

- One fixed-base serial rigid-body robot with fixed, revolute, or prismatic
  joints.
- Each actuated joint has an explicit axis, local frame, units, limits, and
  initial value.
- One tool and a workpiece rigidly attached to it; attachment relationships
  remain fixed throughout a run.
- Fixed influencing objects such as tables, fixtures, and equipment enclosures.
- Other scene groups may remain as background without automatically entering
  the analysis.
- The official example is a synthetic six-axis robot, not an accurate model of
  a particular vendor or product.

Users can create and edit equipment through forms and the hierarchy without
changing code. R0 edits dimensions, mounting, joints, and analysis geometry; it
does not provide general CAD authoring.

## 2. Visual and Analysis Geometry

R0 plans to support box, sphere, and capsule analysis shapes, including
combinations on the same rigid body. Every supported shape pair, rotation, and
motion condition must pass formal method tests. If M0 finds a capability
infeasible, explicitly revise the contract rather than silently degrading the
implementation.

- Prefer self-contained GLB for visual import. Load only geometry and necessary
  appearance data; do not execute embedded scripts or follow arbitrary remote
  resources. M0 dependency review determines the exact supported importer.
- Imported meshes are visual-only by default. Users must explicitly configure
  analysis shapes before using official methods.
- Analysis shapes must be visible, editable, and comparable in the UI.
  Preflight and reports must identify proxy geometry.
- Do not describe a coarse proxy result as an exact result for the original CAD
  model or mesh.
- Any claim that a proxy encloses the original object needs evidence of that
  containment. A hand-built approximation does not automatically provide it.
- With conservative enclosing geometry, a proxy collision may be a conservative
  warning rather than actual physical contact.
- Missing colliders or assets and unsupported shapes must not be silently
  skipped to produce a passing result.
- Formal collision answers must not come from visual picking, transparency,
  LOD, or renderer bounds.

## 3. Coordinates, Units, and Support Envelope

A workcell uses explicit right-handed local coordinates. Geometry and joint
poses have one App domain owner. The renderer, solver, and exporter must not
independently interpret axes or parent-child transforms.

- Length inputs explicitly support mm/m; angles support deg/rad; time uses
  seconds or explicitly declared milliseconds.
- Import previews show conversions and preserve source units. Do not guess
  units for unspecified columns.
- Joint axes must be finite and nonzero and normalized according to the
  contract. Reject nonfinite positions, dimensions, and times.
- Analysis dimensions must be valid. Negative scale or hidden nonuniform
  transforms must not silently alter the mechanism. Convert dimension edits
  into explicit geometry, separately from pose rotation.
- Larger background scenes are permitted, but formal solving uses a workcell
  local origin and an approved numerical envelope.
- R0 is machine-scale geometric analysis, not a nanometer or TCAD accuracy
  claim. Unit conversion does not improve accuracy.

M0 must specify testable minimum shape dimensions, maximum coordinate offsets,
scale ratios, geometric error limits, time-bound precision, and supported
execution environments for official methods. Until those are frozen, M3 cannot
claim that the complete method contract is ready. UI thresholds cannot replace
algorithmic error bounds.

## 4. Trajectories and Motion Semantics

Users edit joint keyframes or import CSV containing time and every actuated
joint value. R0 analyzes an **explicit user-specified joint-space trajectory**,
not a path that a particular vendor controller is guaranteed to execute.

- Times must be finite and strictly increasing. Reject duplicate times, missing
  joints, limit violations, NaN, and Infinity.
- Each segment uses piecewise-linear interpolation of joint values. The
  end-effector path in world coordinates is therefore not necessarily straight.
- Revolute joints use explicitly unwrapped angles. Do not choose the shortest
  rotation automatically or guess direction across 360 degrees.
- Do not silently extrapolate beyond the data. The trajectory must fully cover
  the selected analysis interval.
- A single pose uses static analysis. Empty data is not a successful motion
  analysis.
- Playback speed, display FPS, and camera zoom do not change formal analysis
  time or results.
- The App's shared domain contract defines interpolation and forward
  kinematics. Analysis modules must not silently smooth the path or substitute
  different interpolation.
- R0 official guarantees do not cover compliance with velocity/acceleration
  limits or vendor-controller behavior.

## 5. Analysis Scope and Pair Policy

Each Experiment must explicitly specify:

1. Primary objects: robot parts, tool, workpiece, or other objects being checked.
2. Influencing objects: fixed obstacles that may contact the primary objects.
3. Pair policy: self-collision, external collision, and explicit pair exclusions.
4. Analysis interval, method, thresholds, and resource budget.
5. External assumptions: unmodeled environmental conditions and background
   scope.

Background objects do not enter the solve automatically. Preflight lists
relevant visible objects that are excluded and asks users to confirm the scope.
The platform cannot guarantee that it has identified every real-world influence.
R0 does not derive thermal, fluid, or other physical boundary conditions.

Shapes within the same rigid body are not self-collision pairs. Excluding
adjacent links or tool-mounting interfaces requires a visible, justified,
versioned pair policy. Do not silently skip all adjacent links.
Exclusion is not proof of safety; reports and comparisons retain the exclusion
list.

A setup with no checkable pairs returns "no valid analysis scope," not a passing
conclusion. Hiding an object does not automatically exclude it, and showing one
does not automatically include it.

## 6. Preflight

Preflight must distinguish model validity from resource cost instead of judging
only the number of selected objects:

| Category               | Example                                                                                   | Behavior                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Model/contract blocker | Missing units, unsupported joints, missing collider, invalid interval, unavailable method | Do not start formal analysis; explain the correction                                           |
| Known capability limit | Two moving robots, unsupported scale or geometry                                          | Require splitting the analysis or a supported method; confirmation cannot make the model valid |
| Resource risk          | Large pair count, segment count, shape complexity, or candidate count                     | Explain the estimate and uncertainty; offer reduced scope, a trial run, or confirmation        |
| User assumption        | Proxies, excluded pairs, omitted objects                                                  | Display and preserve acknowledgement without implying platform validation                      |

R0 allows one formal local analysis job at a time. Candidate scenarios run
sequentially; there is no unlimited "select everything and run" operation.
The UI may configure lower budgets but must not bypass hard limits.
Without sufficient profiling, show workload indicators and "no reliable time
estimate yet" rather than inventing an execution time.

## 7. Methods and Completeness

R0 official methods cover:

- Static interference and clearance queries.
- Self-collision and external-collision checks along specified joint
  trajectories.
- Minimum-clearance analysis over the selected interval against user thresholds.

Formal motion analysis must cover the complete selected continuous-time
interval, not only keyframes or display frames. An implementation may use
validated continuous queries or conservatively bounded interval subdivision;
this document does not preselect an algorithm. Mark an interval unresolved when
rotation, composite shapes, or numerical limits prevent the method from
establishing its result.

Preview mode may use finite sampling, but the UI, reports, and exports must
identify it as sampled preview. It is not formal evidence that the entire
trajectory is clear.

Clearance output must distinguish an observed witness distance, lower/upper
bounds over the interval, and error. Do not label the smallest sampled distance
as the true global minimum. Official method specifications must define contact,
intersection, equality at the threshold, and values inside the error band.
Displaying more decimal places must not disguise differences below the declared
resolution.

## 8. Results Are Not a Single Green Check

Each run records these dimensions separately:

| Dimension       | State or meaning                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Execution       | completed, cancelled, timed-out, failed; completed does not imply a geometric pass               |
| Coverage        | complete, partial, unsupported; includes checked and unresolved intervals and pairs              |
| Method evidence | Established contact/interference, clearance bounds and witnesses, numerical uncertainty          |
| User verdict    | Meets/does not meet/cannot determine under the selected rules; cannot erase evidence or unknowns |

User-facing summaries:

- **Issue found**: at least one established finding. Preserve it even if other
  areas remain incomplete, without claiming that the entire analysis completed.
- **No issue found within the selected scope and conditions**: all required
  scope is covered, no finding exists, and method bounds support the conclusion.
- **Cannot determine / analysis incomplete**: unresolved areas, unsupported
  inputs, timeout, failure, or cancellation remain.

Optional [typed acceptance rules](decision-rules-v0.md) evaluate only retained
geometry evidence and change the user verdict, never the method summary or
findings. Incomplete execution or coverage cannot become a successful verdict.

Rules cannot turn unknown into clear. Changing a decision threshold creates a
new rule version and records its difference from the previous result. Preserve
raw method evidence and do not rewrite old runs.
Whether a rule change requires rerunning a method depends on the rule's
declared inputs and required completeness. Do not silently reuse incompatible
results.

## 9. Comparable and Traceable Experiments

Experiment definitions are separate from individual run results. Each run
freezes:

- Required model/asset revisions, analysis geometry, and source units.
- Joint definitions, trajectory, interpolation, interval, and pair policy.
- Method, adapter, and solver versions; actual settings and capabilities.
- User-rule versions, thresholds, and acknowledged assumptions.
- Execution environment and budget; a seed when the method is stochastic.
- Completeness, errors, findings, distance/time error bounds, and start/end
  information.

An experiment can be duplicated into A/B/C candidates. Comparison must show
what changed; analysis scope and assumptions; whether methods and rules match;
finding and unresolved counts; clearance evidence; and execution state.
Analysis runtime is not robot cycle time. Results with different scales,
methods, or scopes must not be ranked without disclosure.

Duplicating a candidate creates independent body and experiment identities and
remaps every parent, robot root, trajectory joint, source-unit key, and scope
reference in one Undo action. Historical run references are not copied or relabeled
as new runs. Explicit lineage records each copied body's original candidate/body
identity, including copies of copies. Newly added bodies have their own origins.
Lineage is correspondence metadata, not proof that geometry is still unchanged.
Run retention freezes this metadata alongside evidence. Comparison may normalize
identities using validated lineage, but must still compare actual geometry,
trajectories, units, methods, scope and rules; it must not infer correspondence
from object names or suppress material differences.

The comparator may display incompatible results side by side, explicitly
marked "not directly comparable." It does not automatically choose the best
candidate. Users select a candidate; the App sends no control command.

Editing a project during analysis does not change the in-flight snapshot.
The result remains bound to the original revision. New geometry, trajectory,
method, or rules make dependent results stale relative to the current project
while preserving historical evidence. Camera, selection, and panel-layout
changes do not invalidate geometric results.

## 10. Import, Persistence, and Field Feedback

- JSON: versioned workcell and experiment data. Reject unknown/unsupported
  versions explicitly or identify them as requiring migration.
- CSV: time/joint mapping, units, previews, and row-level diagnostics. Do not
  silently discard invalid rows.
- GLB: restricted visual-asset import, not automatic vendor kinematics or an
  analyzable collider.
- Project export: a portable bundle containing necessary models, assets,
  experiment definitions, method identities, and selected runs. External
  method binaries are not automatically redistributed with a project.
  Missing method binaries permit historical-result viewing but block reruns.
  A native bundle missing referenced visual sources is incomplete and must not
  replace the active document; independently exported reports remain readable.
- Reports: machine-readable JSON/CSV and human-readable self-contained HTML,
  with limitations and unknowns. Handle spreadsheet formula injection and HTML
  injection; do not load unknown remote resources.
- Local saving: distinguish unsaved, saved, and failed-to-save states. A runtime
  commit does not mean data has reached persistent storage.
- Field feedback: initially text and attached observations referencing a run.
  Do not claim automated calibration, data alignment, or a yield model.
  [Field Observations v0](field-observations-v0.md) defines separate canonical
  annotations, bounded opaque attachments, integrity and lifecycle behavior.

Import follows validation, preview, user acceptance, then the formal mutation
boundary. Failed, cancelled, or rejected imports leave no partial canonical
model. If Core load fallback repairs analysis-critical fields, the App must
show the repair and block reruns until the user confirms or corrects it.
Replacement defaults must not masquerade as original experiment inputs.

## 11. Interaction, Cancellation, and Resources

- One edit maps to one understandable Undo action. Playback and solving do not
  write every frame into Undo history.
- Solving uses an isolated compute execution environment. The UI supports
  cancellation, progress inspection, and nonconflicting interactions.
- Cancellation first propagates a signal. An uncooperative worker exceeding the
  defined grace period must be terminated and its owned resources released.
  Do not claim that an ordinary Promise can always be forcibly stopped.
- Timeout and cancellation preserve explicitly partial evidence, or state that
  no evidence could be retained. They do not produce a success summary.
- Saving partial runs uses an explicit acceptance/save action. Failed analysis
  must not damage the original project.
- Closing, restarting, and switching methods must prevent late results from
  mutating a new session.
- Project replacement uses the complete App runtime termination/reconstruction
  boundary in [Local Storage](local-storage-v0.md#complete-runtime-reset), not
  canonical load plus a history-clear patch. Feature admission closes before
  draining work; owner cleanup must complete before the successor starts.

## 12. Representative Product Cases and Definition of Done

[TEST_STRATEGY.md](../validation/TEST_STRATEGY.md) owns the formal cases, including
valid, empty, invalid, boundary, cancellation, precision, cross-version, scope,
and visual behavior.

This scope is complete only when the full PRODUCT journey works through normal
UI/import/API paths and all first-release gates pass. One animation or one
correct collision does not satisfy this contract.
