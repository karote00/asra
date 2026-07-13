# Rule: Geometry Scenario Testing

## Purpose

All geometry-producing or visually observable rendering features must be
validated from a scenario coverage table first, not from incident screenshots first.

This rule prevents the system from drifting into:

- one bug report -> one ad hoc regression test
- screenshot-specific hotfixes without algorithm coverage
- fragmented tests that fail to cover the real input space
- duplicated testing philosophies per feature

This is a platform-level validation philosophy, not a stroke-specific rule.

It applies to every non-trivial rendering or layout feature, including:

- stroke
- shadow
- fill / pattern fill
- blur
- blend / masking / clipping interactions
- offset path / outline
- future appearance effects
- layout or geometry engines with visible output

## Non-Negotiable Method

All features governed by this rule must be tested in this order:

1. define scenario families
2. define expected geometry / visibility semantics
3. write unit tests for algorithm contracts
4. write visual tests for supported scenarios
5. only then add regression tests if necessary

Incident-driven tests may exist, but they are never the primary structure.

Scenario coverage is allowed to expand over time when new failures reveal a
missing family or a missing subfamily. That is acceptable, but the expansion
must still follow this rule:

1. name the family or subfamily explicitly
2. define the expected semantics
3. add the unit / visual tests
4. only then merge the fix

When a reported problem is under review, the owner must also decide whether the
current product semantics are actually the intended outcome.

This means every investigation must separate:

- implementation bug
- incomplete scenario coverage
- product-semantics mismatch

A visually surprising result must not be treated as an implementation defect
until the intended product semantics have been checked explicitly.

## Bounded Expansion Stop Rule

Scenario-family expansion is allowed only while the new slice still belongs to
the same declared algorithm class.

Before adding another bounded slice, the owner must check:

1. whether the new slice closes a real scenario-family gap rather than merely
   restating the same family with narrower fixtures
2. whether the slice still fits the currently declared bounded normalization
   path
3. whether the coverage gained is still large enough to justify the added
   implementation, test, and documentation complexity

Bounded expansion must stop when either of the following becomes true:

1. the next uncovered family requires a different algorithm class
   - for example general polygon boolean, arbitrary non-convex subtraction, or
     arbitrary mixed-topology owner-domain construction
2. the next slice no longer reduces the uncovered scenario frontier in a
   meaningful way relative to the complexity it adds

When bounded expansion stops, the owner must not keep adding more micro-slices
under the old phase. A new plan or sub-plan must be opened explicitly for the
new algorithm class.

## Mandatory Self-Review Before Expansion

Whenever the owner is about to handle an edge case or expand the current
scenario scope, the owner must stop and answer these three questions first:

1. If this case is not handled now, which later phase would be blocked?
   - if no later phase is blocked, move the case to backlog and keep moving
     downstream
2. Would handling this case now change any externally exposed interface?
   - if yes, stop and ask for an explicit decision instead of changing the
     interface unilaterally
3. How much extra work does this case add relative to the current phase?
   - if the added work is greater than `20%` of the current phase scope, stop
     and ask for approval before expanding

This self-review is mandatory even when the owner believes the next slice is
small. It is the standard procedure before every scope expansion, not a
special-case escalation path.

## Phase Discipline

Every phase must follow these discipline rules:

- run the mandatory self-review before any scope expansion
- stop and ask before changing externally exposed interfaces
- optimize for "good enough to move downstream", not perfect coverage of every
  edge case
- backlog is a valid outcome; deferred work must be recorded explicitly, not
  silently ignored

## Scenario Modeling

### Core Scenario Axes (Universal)

All covered features must define scenario families across these shared axes:

- topology
  - open
  - closed
  - seam-wrap
  - self-intersecting
- path family
  - straight
  - right-angle turn
  - acute-angle turn
  - obtuse-angle turn
  - smooth high-curvature turn
- shape source
  - shape-generated path
  - vector-generated path
- visibility semantics
  - continuous
  - discontinuous
  - clipped
  - corner-crossing
  - overlap-sensitive
- continuity / ownership semantics
  - segment-local
  - corner-spanning
  - seam-coupled
  - self-overlap-dependent

### Feature-Specific Scenario Axes

Each feature must define its own additional axes beyond the universal set.

#### Stroke — reference axis set

- authored interval family
  - dash shorter than a segment
  - dash longer than a segment
  - dash spans a corner
  - gap spans a corner
  - dash starts at a corner
  - dash ends at a corner
  - offset shifts crossing point
- stroke style controls
  - join type
  - cap type
  - position
  - width mode

#### Shadow — reference axis set

- shadow parameters
  - blur mode
  - spread
  - offset
- shadow type
  - outer shadow
  - inner shadow
- interaction behavior
  - clipping boundary behavior
  - overlap accumulation
  - self-shadowing rules

### Additional Axis Guidance

Every feature must cover at least:

- input topology
- parameter family
- interaction with shape source, where applicable
- edge / boundary conditions

Axes that have only one meaningful behavior may be collapsed.
Axes that produce qualitatively different outcomes must be split.
Shape names may be used as fixtures, but they must not become the main
taxonomy when the real scenario is geometric or topological. In that case,
shape source belongs on its own axis and equivalent sources must be compared
under the same family.

## Required Test Layers

### File and Batch Structure

Geometry tests must be partitioned by scenario family and runtime contract.
Large mixed files make failures hard to interpret and hide slow paths.

Rules:

- Keep a test file focused on one scenario family or one runtime wiring layer.
- Split files when adding a new family would make the output ambiguous.
- Split files when one slow case delays progress reporting for unrelated cases.
- Test names must state the invariant being proven, not just the fixture or bug
  nickname.
- A passing run must immediately show which geometry contract passed from the
  file name, describe block, or test name.
- Performance / budget checks belong in their own narrowly named test file or
  describe block when they can run slower than ordinary unit semantics.

If a geometry command needs a second diagnostic pass to understand what passed,
the suite is not sufficiently partitioned.

### Unit Tests

Unit tests validate algorithm semantics, not screenshots.

Examples:

- interval or region allocation
- boundary / seam continuity
- corner-spanning or edge-crossing classification
- eligibility and ownership logic
- overlap handling
- final topology structure

Unit tests must not be limited to historical bugs.

### Visual Tests

Visual tests validate what the user actually sees for supported slices.

Visual tests must:

- go through the real app/runtime path
- cover representative supported scenarios from each scenario family
- measure the behavior that matters for that family

Examples:

- stroke:
  - visible/gap alternation
  - corner continuity
  - join/cap silhouette
  - absence of uncovered slices inside the declared supported scope
- shadow:
  - correct offset direction
  - blur falloff shape
  - spread expansion
  - correct occlusion behind the caster

### Regression Tests

Regression tests are allowed only when one of the following is true:

1. the bug maps cleanly to an existing scenario family
2. the bug reveals a missing scenario family, and that family is added first

Regression tests must never become the main taxonomy of the test suite.

## Required Benchmark Discipline

Visual benchmarks must be defined from scenario semantics, not from arbitrary
pixel snapshots.

Each benchmark must specify:

- the feature and scenario family
- the expected visible behavior
- the probe / measurement strategy
- the pass threshold

Examples:

- stroke:
  - corner square must remain filled for `miter`
  - corner square must be cut away for `bevel`
  - corner corridor must keep continuity when one dash spans the turn
- shadow:
  - shadow centroid must be offset by the declared `(dx, dy)` within tolerance
  - blur edge must decay before the declared radius boundary
  - shadow must not bleed through a clip mask applied to the caster

## Done Rule

A feature phase is not DONE unless:

- the supported scenario families are declared explicitly
- the corresponding unit tests exist
- the corresponding visual tests exist
- bug-report regressions are mapped back to those families

If a bug cannot be mapped to an existing family, the scenario model is
incomplete and must be updated before the fix is merged.

## Adding a New Feature

When a new rendering or layout feature enters development, the feature owner
must produce a Scenario Axis Document before implementation begins.

It must contain:

1. the list of scenario axes and their family members
2. the expected semantics for each family
3. the planned unit test contracts
4. the planned visual test probes and pass thresholds

The Scenario Axis Document may be:

- a section in the feature design doc
- a standalone plan file

It must be reviewed before any algorithm code is merged.

## Philosophy

This rule enforces one invariant:

> Rendering correctness must be derived from structured scenario modeling,
> not from accumulated bug fixes.

Stroke is the first fully implemented reference feature under this rule.
Future features must follow the same validation discipline instead of inventing
new testing philosophies.
