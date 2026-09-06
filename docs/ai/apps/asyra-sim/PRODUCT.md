# Asyra Sim: User Value and Product Boundaries

## Mission

Enable manufacturers and automation teams with limited resources to turn their
engineering assumptions into executable, comparable, reproducible experiments
without first acquiring a complete, expensive industrial software toolchain.

Core promise:

> We provide a trustworthy environment for executing experiments, not a guarantee that users' experimental assumptions hold.

"Free" does not excuse incorrect computation; "correct execution" does not mean
the model fully represents reality. The platform must faithfully execute the
selected method, and official methods must meet their published specifications.
Users determine whether a model suits their purpose and remain responsible for
real-world validation and equipment-operation decisions.

## Initial Users

The primary audience is small automation integrators, equipment and process
engineers at manufacturing companies, and engineering teams helping small
manufacturers improve workcells. They must be able to supply or create
dimensions, joint structures, motion assumptions, and basic constraints. They
do not need to become solver developers.

Secondary users include education and research teams, and developers able to
provide custom equipment definitions, importers, and analysis methods.
Educational use is valuable, but an educational demonstration is not a
substitute for engineering usability validation.

R0 does not claim to serve safety-certification bodies, live production-line
control, or teams requiring complete TCAD. They may become future collaborators,
but those capabilities are not first-release promises.

## What Users Gain

| User question                                           | How Asyra Sim helps                                                                                                     | What users must still supply or verify                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Will a new tool hit a fixture along the specified path? | Checks geometric relationships among the tool, workpiece, robot, and obstacles; locates problem times                   | Dimensions, tool mounting, trajectory, and actual calibration                 |
| Would moving the worktable improve clearance?           | Duplicates a scenario, changes the configuration, and compares reruns                                                   | Physical relocation feasibility, utilities, and personnel space               |
| Which of three paths better meets our thresholds?       | Compares findings, coverage, clearance bounds, and user-rule results                                                    | Tradeoffs and selection; the platform does not declare the real-world optimum |
| Can a colleague reproduce my conclusion?                | Exports models, settings, method versions, and traceable results                                                        | Data-sharing permissions and a compatible environment                         |
| Can we add our own checks?                              | Configures existing methods through the UI or adds new methods through private extensions                               | Custom algorithms, applicability limits, and validation evidence              |
| Must we solve an entire factory to test one area?       | Selects primary objects, influencing objects, and a time range; background objects do not automatically enter the solve | Whether surrounding objects and boundary assumptions are sufficient           |

The defensible value is a lower barrier to creating, rerunning, comparing, and
handing off geometric experiments. Without evidence, do not claim a percentage
yield improvement, fewer accidents, prevention of every collision, or guaranteed
cost savings. Free software does not make hardware, data preparation, engineering
labor, or external solvers free.

## First-Version User Journey

1. Open the local workbench without an account and load the official synthetic
   example.
2. Inspect the robot, tool, workpiece, fixtures, and analysis geometry, which may
   differ from visual geometry.
3. Modify the example with their own dimensions and configuration, or create a
   new workcell.
4. Create joint keyframes or map CSV columns to joints and time.
5. Choose the analysis scope, collision/clearance method, thresholds, and
   resource limits.
6. Review preflight feedback: missing inputs, exclusions, and unsupported
   capabilities.
7. Run the analysis and receive replayable findings or explicit unknown/failure
   reasons.
8. Duplicate the scenario, adjust the tool, fixtures, or path, and rerun
   candidates sequentially.
9. Compare results and export the selected candidate and report. On-site
   validation happens outside the App.
10. Attach field observations and supporting files, then create the next
    experiment revision without overwriting the original result.

Users can conduct what-if experiments with explicit assumptions even without
real-world data. This does not make the model calibrated.

## Executable Experiments, Not Whole-Factory Scheduling

R0 composes only this experiment chain:

`Select model and trajectory -> select analysis method -> configure decision rules -> execute -> compare/export`

The same definition can be rerun; methods and rules are configurable. Start with
a compact step-by-step editor, not a general node editor, arbitrary loops,
parallel-resource scheduling, MES, or a rework system. "Executable workflows"
must not become a requirement to build a large workflow engine first.

R0 permits scene groups and background workcells, but each formal analysis
supports only one moving robot and its influencing objects. A dedicated
whole-factory layout editor and coupled workcell analysis remain future work
driven by actual demand.

## Free Baseline Capabilities

Local modeling, parameter editing, joint trajectories, basic imports, official
collision/clearance methods, result comparison, project save/load, and report
export are all part of the free R0 core.

- No account, AI key, or cloud service is required to solve.
- Exporting users' own data, official examples, and basic methods is not a paid
  unlock.
- There are no artificial licensed-run or seat-count limits. Resource limits
  are technical safeguards and must be explained.
- Private methods and local deployment are supported; new algorithms may still
  require development skills.
- Models, trajectories, and results are not uploaded by default. Telemetry is
  not enabled by default.
- External commercial engines disclose their own fees and licenses and cannot
  become a hidden requirement for the free core.

Commercial support, hosting, and other revenue models remain undecided. This
plan introduces no paywall. Before release, explicitly address licensing,
third-party redistribution, and support policy. This document is neither legal
advice nor a separate license grant.

## Responsibility and Wording

| Layer                       | Promise or responsibility                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Platform                    | Execute and pass data as defined; correctly manage cancellation, failure, versions, results, and storage state     |
| Official methods            | Meet the specification within published input, geometry, scale, trajectory, and error limits, with formal evidence |
| Third-party/private methods | Authors supply applicability and validation; platform conformance checks are not physics certification             |
| User model                  | Users supply dimensions, trajectories, exclusions, decision rules, and real-world validation                       |

Do not describe the promise as "we only guarantee that it runs, not that it
computes correctly." The standard wording is: **We guarantee correct execution
of the specified method, not that the method fully represents reality or
achieves the user's practical objective.**

Results should say "under the selected model, scope, method, and conditions,"
not "the machine is safe." The
[R0 contract](specs/robot-workcell-v0.md) owns exact result semantics.

## Excluded from the First Version

- Live robot connections, PLC integration, control-program deployment, virtual
  commissioning certification, and real-time safety protection.
- Inverse kinematics, automatic avoidance, optimal paths, and certified
  equivalence to vendor-controller interpolation or kinematics.
- Dynamics, contact forces, collision response, stopping distance, flexible
  cables, deformation, and load sway.
- Coordinated solving of multiple moving robots, mobile bases, closed-chain
  mechanisms, and in-run grasp/release topology changes.
- Nanometer accuracy claims, deposition, etching, chemistry, optics, TCAD, and
  multiphysics coupling.
- Full CAD authoring, an owned native CAD kernel, or exact collision claims for
  arbitrary complex meshes.
- Whole-factory throughput, scheduling, utilization, supply-chain, or MES
  integration.
- Arbitrary JavaScript expressions, an online marketplace, and in-run engine
  hot-swapping.
- Real-time collaboration, AI agents, remote HPC, general optimization, and a
  Monte Carlo platform.

These are not permanently forbidden. A broad long-term product name does not
authorize including them in R0.

## Measuring Success

Before public release, independent users must complete
"import/configure -> analyze -> modify -> compare -> export/reopen" without
changing App code and must explain the result's assumptions and unknowns.

Measure completion time, steps requiring assistance, import errors,
misunderstandings, reproducibility, and resource use. Attractive graphics,
download counts, and passing-test counts alone do not establish success.
Pilot and acceptance criteria are defined in
[FIRST_RELEASE.md](release/FIRST_RELEASE.md).
