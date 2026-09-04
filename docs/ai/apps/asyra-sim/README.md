# Asyra Sim Planning Entry

> We provide a trustworthy environment for executing experiments, not a guarantee that users' experimental assumptions hold.

Asyra Sim is a free, extensible simulation and experiment workbench. Its first
domain is **offline geometric interference and clearance experiments for a
single robot workcell**, not a complete factory simulator.

## Status and Location

- This is a product planning baseline. Implementation has not started, and no
  App, solver, or release gate is claimed to have passed.
- Planned implementation: `apps/asyra-sim/`, alongside `apps/asyra-design/`.
- This work creates documentation only: no App scaffold, packages, dependencies,
  deployment, or Inspector artifacts.
- At the user's request, this plan supersedes the former Asyra CAD roadmap.
  Useful content has been integrated without retaining its phase numbering or
  claiming that the old plan was implemented. See the roadmap's replacement
  notes.
- [Framework documentation](../../framework/README.md) remains authoritative for
  Framework contracts.
- This is a roadmap whose implementation has not started, not an
  implementation-ready Inspector owner-step plan. App implementation requires
  the M0 contracts, formal product cases, and Inspector readiness first.
  Any code or tests needed for an M0 proof also require the corresponding bounded
  owner contract and Inspector readiness before implementation.

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
features.

M0 must still establish public-boundary 3D feasibility, the formal collision
method, accuracy and scale limits, supported environments, and resource
baselines. Do not claim production 3D support or engineering accuracy before
that evidence exists.

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
