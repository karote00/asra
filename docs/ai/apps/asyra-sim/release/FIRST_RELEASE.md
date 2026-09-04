# Asyra Sim First Public Release: R0 Public Alpha

## 1. Release Decision and Milestone Definition

**The first user-facing public product release, R0 Public Alpha, requires
completion of M0-M6 and every mandatory gate in this document.**

The [roadmap](../plans/asyra-sim-roadmap.md) owns milestone order. This document
owns release gates; it does not reuse the earlier conversational "phase 5.5" or
old CAD phase numbers.

| State                         | Permitted use                                                              | Claims not permitted                                                        |
| ----------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Planning/public source        | Discussion, review, independent research                                   | A usable engineering product or validated official methods                  |
| M1-M2 internal demo           | View 3D, create workcells, play trajectories                               | Completed continuous collision analysis or factory adoption readiness       |
| M3-M4 functional alpha        | Developer reproduction, comparison, extension trials                       | Independent-user and delivery validation completed                          |
| M5 controlled-pilot candidate | Invite partners to shadow-test under explicit limits                       | R0 completion or safety certification                                       |
| M6 / R0 Public Alpha          | Public download and user-created local experiments within supported limits | Production approval, safety guarantees, equivalence to actual machine paths |
| Later stable release          | Plan from actual usage and maintenance evidence                            | Alpha publication automatically constitutes version 1.0                     |

Source code can be public before the product is ready for adoption. Keep source
publication and a user-facing product release distinct. This document does not
authorize pushing, tagging, registry publication, deployment, or external
outreach.

## 2. Required R0 User Capabilities

1. A free, account-free, locally usable workbench and complete synthetic example.
2. Create/edit one robot, tool, workpiece, and fixed fixtures, not just play the
   official demo.
3. Specify joint values and trajectories, with JSON/CSV mapping and error
   correction.
4. Import restricted visual assets and explicitly create/edit analysis geometry.
5. Choose primary/influencing objects, pair exclusions, time range, methods,
   and thresholds.
6. Reject invalid models in preflight and explain resource risk, not merely
   show a generic warning dialog.
7. Formal static/continuous-motion collision and clearance analysis with
   findings, coverage, unknowns, and cancellation.
8. Replay problem times and objects, including analysis geometry, error bounds,
   and unresolved intervals.
9. Duplicate A/B/C candidates, rerun sequentially, compare changes, and choose a
   candidate.
10. Save, reopen, and export traceable projects and JSON/CSV/HTML reports.
11. Integrate private methods through documentation and examples without
    changing Core; missing modules do not destroy historical results.
12. Understand support limits, assumptions, and unknowns, with usable issue
    reporting and version information.

UI configuration of existing models is required. No-code creation of arbitrary
new physics, a general node editor, cross-domain model libraries, and an
official marketplace are not R0 requirements.

## 3. Mandatory Release Gates

### G1: Scope and Method Specifications

- Define supported/unsupported behavior, numerical limits, units, shape pairs,
  trajectories, and interpolation.
- Official methods include reproducible baselines and explanations of error,
  unknowns, and coverage, not a vague "high precision" claim.
- Specifications, App behavior, Inspectors, and actual methods are consistent.
- No unresolved P0/P1/P2 contract or owner-boundary finding remains.

### G2: Numerical and Continuous-Geometry Evidence

- Formal analytical oracles, metamorphic cases, scale boundaries, and all
  declared shape-pair tests pass.
- High-speed crossings, intermediate rotational collisions, tangency, and error
  bands cannot produce false clear.
- Formal methods cover the full interval or explicitly mark it unresolved.
  Sampled previews are not evidence of complete clearance.
- Normal supported cases produce useful complete answers. Returning unknown
  for everything does not satisfy usability.
- Known numerical bugs, undisclosed missed collisions, or incorrect distance
  bounds block the affected method's release.

### G3: Complete User Journey and Data Integrity

- The synthetic example completes three-candidate comparison, problem replay,
  saving, reopening, and export through normal product paths.
- User-created/imported cases follow the same path without fixture exceptions.
- Undo/Redo, atomic import, source versions, staleness, missing assets, and load
  repair behavior pass.
- UI and all outputs agree on scope, values, limits, and status for the same run.

### G4: Resources, Failure, and Cancellation

- The normal-workcell benchmark passes on the published hardware/browser/method
  profile.
- Record workload, runtime, and measurable resources. Limits and cancellation
  deadlines are numerical.
- Preflight and runtime safeguards handle excessive work. Timeout, crashes, and
  uncooperative workers never masquerade as success.
- Repeated-operation tests verify resource cleanup; refreshing the page cannot
  hide leaks.

### G5: Offline Use, Security, and Pluggability

- Core workflows work without accounts, networks, or paid services. Network
  tests prove no default external transmission.
- Unknown projects do not install or execute code. Input/output injection and
  resource-limit tests pass.
- An independent example method integrates and replaces a method, passing both
  conformance tests and its mathematical tests.
- Missing methods, incompatible versions, and invalid results fail clearly.
  Trusted-module and sandbox limitations are described accurately.
- Review official dependencies for licensing, redistribution, and known
  vulnerabilities. Unacceptable risk blocks release.

### G6: Independent Distribution and Use

- Produce a versioned local distribution, dependency list, and checksums from
  an exact source commit.
- A clean consumer builds using packed dependencies, without private repository
  imports or dependency hoisting.
- Small-manufacturer users can launch it using public instructions without
  cloning or understanding the entire Asyra monorepo.
- Provide quick start, data formats, official-method limits, examples, SDK,
  backup/recovery, and troubleshooting documentation.
- Release notes identify supported platforms and known limits. Do not claim
  untested OS/browser support.

### G7: Independent Use and Understanding of Real-World Limits

The planned minimum pilot is two users who are not App developers, at least one
with equipment or automation-workcell experience. This is a minimum usability
check, not a statistically representative study.

- One uses the distributed example; the other uses a self-created or mapped
  de-identified/synthetic workcell.
- Following distributed documentation, complete creation/import, setup,
  analysis, modification, three-candidate comparison, export, and reopening.
- Maintainers may observe. If completion requires code changes, manual data
  repairs, or privately supplied missing critical instructions, the attempt
  does not pass. Fix the product/docs and rerun affected workflows.
- Users can explain that proxies are not exact CAD geometry, unresolved is not
  clear, and no issue found does not prove on-site safety.
- Real cases remain shadow trials. Unvalidated software does not control
  equipment or become the sole decision basis.
- Without independent pilot users, remain a candidate. Internal self-review
  does not replace G7.

Partners need not provide confidential data. Do not market R0 as certified for
industrial real-world accuracy.

### G8: Release and Maintenance Responsibility

- Define issue reporting, private/security reporting, and a minimal reproducible
  case format.
- Name at least one maintenance owner and define notification, withdrawal, and
  correction procedures for serious missed findings or corrupted results.
- For the initial release, retain reproducible candidate artifacts and
  original-data backups/recovery instructions. Subsequent updates also retain
  the previous known-working version. Migrations must not destroy original
  backups.
- Free software does not promise unlimited immediate support or an SLA.
  Publish support scope and response expectations.
- Explicitly resolve how Sim reporting/support relates to the existing
  Framework policy of not accepting external issues/PRs. This document does not
  silently change repository-wide policy; necessary changes require separate
  authorization.
- Passing gates and obtaining publication authorization are separate. Actual
  external operations require explicit user approval.

## 4. Unacceptable Substitutes for Gates

- "Free" cannot replace error handling, accuracy specifications, or security
  checks.
- "Users are responsible" cannot replace mathematical and software verification
  of official methods.
- "One demo works" cannot replace imports, invalid data, cancellation,
  boundaries, and independent use.
- "The method is conservative" cannot make always-unknown results useful.
- "The vendor is well known" cannot replace evidence for the specific version,
  configuration, and adapter.
- An unresolved support policy is still a release gap, not a minor
  documentation detail.

## 5. Capabilities R0 Does Not Wait For

R0 does not wait for TCAD, chemistry/optics, full dynamics, whole-factory
scheduling, AI, automatic avoidance, a marketplace, collaboration, cloud
compute, or full native CAD. They must not block the bounded, trustworthy first
robot-workcell experiment tool or excuse postponing R0 data and quality work.

## 6. Decisions Still Required Before Release

Freeze these at the roadmap's defined points: numerical/platform profiles,
specific third-party engines and licenses, local delivery format, resource
limits, pilot arrangements, reporting and maintenance policy, and App version
number. R0 cannot be ready while these remain unspecified. This plan does not
promise a release date.
