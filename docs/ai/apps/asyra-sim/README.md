# Asyra Sim Development Entry

> We provide a trustworthy environment for executing experiments, not a guarantee that users' experimental assumptions hold.

Asyra Sim is a free, extensible simulation and experiment workbench. Its first
domain is **offline geometric interference and clearance experiments for a
single robot workcell**, not a complete factory simulator.

## Status and Location

- Implementation is active. M0 feasibility and M1 foundations are complete. The R0
  release gates are not complete.
- App workspace: `apps/asyra-sim/`, alongside `apps/asyra-design/`.
- The normal CUSTOM workbench renders and edits a synthetic six-axis model.
  Canonical editing, analytical numerical kernels, and basic browser proofs
  exist. Field observations, distribution, and pilots remain pending.
- At the user's request, this plan supersedes the former Asyra CAD roadmap.
  Useful content has been integrated without retaining its phase numbering or
  claiming that the old plan was implemented. See the roadmap's replacement
  notes.
- [Framework documentation](../../framework/README.md) remains authoritative for
  Framework contracts.
- Implementation follows the dedicated
  [R0 Inspector](../../../../tools/flow-inspector/inspectors/asyra-sim-r0-flow-inspector.html)
  and each bounded owner contract. The [CUSTOM engine contract](specs/custom-engine-v0.md)
  defines the current adapter boundary. The
  [runtime profile](specs/runtime-profile-v0.md) freezes initial environment,
  distribution, and resource choices. A working viewport does not establish
  R0 readiness.

## Reading Guide

| Question                                                                         | Document                                                        |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Who needs it, what does it help with, and what does it not promise?              | [PRODUCT.md](PRODUCT.md)                                        |
| What can the first version do, and what are its inputs, outputs, and exceptions? | [Robot workcell R0 contract](specs/robot-workcell-v0.md)        |
| What do the App, Framework, renderer, and solver each own?                       | [ARCHITECTURE.md](ARCHITECTURE.md)                              |
| How are methods replaced, and how do user settings differ from third-party code? | [R0 extension contract](specs/extensions-v0.md)                 |
| How can we test without confidential factory data?                               | [Testing and credibility strategy](validation/TEST_STRATEGY.md) |
| What must be complete for the first public release?                              | [First-release gates](release/FIRST_RELEASE.md)                 |
| What are the delivery order, dependencies, and stop conditions?                  | [Milestone roadmap](plans/asyra-sim-roadmap.md)                 |
| What work has actually started?                                                  | [PLANS.md](PLANS.md)                                            |
| Why was this direction chosen?                                                   | [App decision history](decisions/releases/unreleased.md)        |

## Document Ownership

- `PRODUCT.md`: user value, audience, and limits of the product promise.
- `specs/*`: proposed user behavior and public contracts, not claims that APIs
  already exist.
- `ARCHITECTURE.md`: intended ownership and data flow; M0 verifies actual
  Framework gaps.
- `validation/*`: required formal tests, oracles, and evidence, not passing-test
  records.
- `release/*`: first-release scope and blockers, not publication authorization.
- `plans/*`: dependencies, milestones, and open decisions; no separate product
  semantics.
- `decisions/*`: agreed direction and planning tradeoffs, not execution status.

Resolve conflicts against Framework hard rules and the product contract, then
update the single owning document. A roadmap, test expectation, renderer, or
solver must not redefine product behavior independently.

## Agreed Direction and Outstanding Evidence

Agreed: the Asyra Sim name, an independent App in the same repository, free
baseline capabilities, replaceable methods, user-defined experiments, local
analysis scope, a robot-workcell starting point, and no guarantee of real-world
outcomes.

This plan makes the following first-version choices concrete: a local browser
workbench, one fixed-base serial robot, explicit joint trajectories, simple
analysis geometry, JSON/CSV import, sequential candidate comparison, and trusted
local method extensions. These are implementation targets, not available
features unless the implemented checkpoint below says otherwise.

The implemented checkpoint includes public-boundary 3D, canonical workcell and
experiment edits, isolated interval-geometry runs, immutable evidence, A/B/C
comparison, portable projects, and restricted GLB references. Ordinary browser
tests cover visual placement, Undo/Redo, damaged-source rejection, and historical
replay through complete App replacement. Initial resource/environment choices
are frozen. Trusted pre-start methods share one catalog and Worker protocol;
an independent analytical sphere example, typed parameters, retained declarations,
missing-module history and declaration-aware comparison are implemented. New
studies use measured 100,000-evaluation/30-second defaults without rewriting saved
budgets. Typed acceptance predicates and nested AND/OR groups now retain separate
evidence-based evaluations through editing, Worker execution, reports, comparison
and portable history. Field observations, independent distribution,
reference-hardware performance, and pilot acceptance remain unfinished.
The [numerical contract](specs/numerical-method-v0.md) defines the method's support
limits; passing local tests is not an independent numerical review or a
real-world accuracy claim.

## Working Rules

Inherit the
[bounded-scope](../../framework/rules/bounded-task-scope-and-closure.md),
[test-first](../../framework/rules/bugfix-test-first.md),
[no-patch](../../framework/rules/no-patch-fixes.md),
[Inspector readiness](../../framework/rules/inspector-contract-readiness.md), and
[Inspector step execution](../../framework/rules/inspector-step-execution.md)
rules.

Initial planning does not modify existing Inspectors or Framework contracts.
Freeze a new mutation scope before M0 or implementation. Any general-purpose
Framework change needs its own owner, contract, and tests; this plan does not
authorize broader changes.

## Smallest Success Story

An engineer at a small automation company builds a workcell, imports a joint
trajectory, selects the tool, workpiece, and fixtures to analyze, and finds a
collision or clearance problem. They duplicate the scenario, adjust the
configuration, compare three runs, export a report with assumptions and
versions, and independently validate their chosen candidate on site.

**The first public product is R0 Public Alpha. It requires M0-M6, not merely an
M1 viewport demo.** TCAD, whole-factory scheduling, AI, and cloud capabilities
after M7 are not R0 prerequisites.
