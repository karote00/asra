# Unreleased App Decision History: Asyra Sim

Append App-scoped decisions according to the
[global standard](../../../../decisions/README.md). Record changes in direction
as superseding entries; do not overwrite released history.

## 2026-09-04 — Implement CUSTOM First, Extract Generic Defaults Later

- The user authorized the first candidate implementation, `three`,
  `@types/three`, their necessary dependencies, and minimal necessary Framework
  extensions with tests and documentation.
- Start with an App-owned CUSTOM engine and the existing public Core/Render
  boundaries. Keep SDK objects private to the adapter and robot/analysis
  semantics outside it. Do not enable the official 3D/HYBRID profiles.
- Generic contracts and adapter code may be extracted in a later task; Preset
  will own optional default composition, not engine execution or Sim semantics.
- Foundation tests and local builds do not replace numerical, real-browser,
  distribution, maintenance, or independent-user release evidence.

## 2026-09-04 — Establish Asyra Sim's Product Direction and Separate Documentation

- Context: The user wants to lower the barrier for small and medium-sized
  manufacturers to build simulation experiments, not replace every commercial
  solver or guarantee real-world agreement or improved yield.
- Decision: The product is named Asyra Sim. Its planned App path is
  `apps/asyra-sim/`, alongside `asyra-design`. Its plans and product contracts
  belong exclusively in `docs/ai/apps/asyra-sim/`.
- Core contract: "We provide a trustworthy environment for executing experiments,
  not a guarantee that users' experimental assumptions hold." Official methods
  must still be implemented correctly and formally verified under their published
  conditions of applicability.
- Consequence: Develop in the monorepo first, using public boundaries and a clean
  consumer to maintain independent delivery. Do not split repositories
  immediately or inject Sim domain logic into the Framework.
- Status: This task creates planning documents only, without creating the App,
  installing dependencies, or changing the Framework.

## 2026-09-04 — Limit the First Domain to Local Robot Workcell Geometry Experiments

- Decision: The first version uses one fixed-base serial arm, a tool, a workpiece,
  and static obstacles to analyze user-specified joint trajectories. It provides
  collision and clearance analysis, scope configuration, variant comparison,
  and traceable results.
- Exclusions: No real-equipment control, safety certification, vendor-controller
  equivalence, dynamics, whole-factory scheduling, automatic obstacle avoidance,
  TCAD, or nanometer-accuracy promises.
- Rationale: Start with experiments that have explicit mathematical answers and
  verifiable boundaries; the long-term name does not define first-version scope.
- Consequence: Separate background scenes from analysis scope. Unknown and
  incomplete are formal states. Algorithms, precision, and resource profiles
  still require M0 evidence; animation frames cannot stand in for formal
  full-trajectory analysis.

## 2026-09-04 — A Free, Pluggable Core Does Not Mean Safe Hot Loading of Arbitrary Code

- Decision: Local modeling, basic official methods, experiments, comparison,
  saving, and export are all part of the free core. Users configure existing
  methods through the UI; new solvers integrate through trusted local modules.
- Consequence: R0 has no account, cloud, or AI dependency. Modules are installed
  before composition, without changing Core's post-startup registration lock.
  Private methods need not be uploaded and receive no automatic official
  endorsement.
- Open questions: Specific dependency licenses, supported platforms, private
  extension delivery, and issue-reporting and maintenance policies must still be
  resolved at the planned decision points.

## 2026-09-04 — Gate the First Public Release on a Complete User Experiment Loop and Evidence

- Decision: The first product release is R0 Public Alpha, after M0–M6 and the
  [first-release gates](../../release/FIRST_RELEASE.md) are complete.
- Minimum usability requirement added by this plan: Two non-developers complete
  independent pilots, with at least one having equipment or automation
  experience. De-identified or synthetic data is acceptable; sharing commercial
  secrets is not required.
- Consequence: Distinguish internal demos, public source code, controlled-pilot
  candidates, and public product releases. Do not claim a completed release for
  small manufacturers without external pilots or a support mechanism.
- Status: These are planned gates, not evidence already obtained or authorization
  to publish externally.

## 2026-09-04 — Replace the Original CAD Roadmap with the Sim Plan

- Context: The user requested retaining useful parts of the old CAD plan and
  removing the superseded plan after completing this planning task.
- Decision: Retain 3D vertical slices, transactions and persistence, engine
  isolation, collision replay, result invalidation, and test sequencing. Do not
  retain general CAD modeling, AI-first phases, sampling presented as complete
  analysis, or old schedules.
- Consequence: Remove the old CAD roadmap and its dedicated README/PLANS
  navigation, and update the App index. Git history preserves the original text.
  This supersedes a product direction; it does not mark the old plan as
  implemented.
- Reference: [Roadmap replacement notes](../../plans/asyra-sim-roadmap.md).
