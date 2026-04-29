# Parameter Impact Matrix And Geometry Decision Trace

## Role

This file defines how the final stroke engine should reason about:

- what changes when a user edits one parameter
- which pipeline stages must rerun
- which layers may be reused
- where failures are most likely to originate
- how to determine the final geometry for one concrete authored path

It exists to make testing and debugging deterministic rather than anecdotal.

## Core Rule

For any stroke update, the engine must be able to answer all of these:

1. which authored field changed
2. which dirty layers changed
3. which pipeline stages reran
4. which canonical objects were reused
5. what the final semantic-region geometry became
6. which stage most likely failed if the output is wrong

If the runtime cannot answer these, the implementation is not following the
final package correctly.

## Parameter Families

The engine should classify user edits into these parameter families:

- paint-only
- dash schedule
- stroke geometry
- support-semantic boundary
- source topology
- interaction mode only

## Impact Matrix

### 1. Paint-only changes

Examples:

- solid color
- gradient stops
- image transform
- paint opacity

Expected dirty layers:

- paint layer
- render/hit/export payload layer

Must reuse:

- `PathTopologyModel`
- source/topology classification
- interval records
- candidate geometry
- arrangement
- ownership
- legality
- semantic region packets

Must rerun:

1. `AttachPaintPayload`
2. `EmitRenderHitExportPackets`

Most likely failure stage if output is wrong:

- paint attachment
- emitter payload construction

Forbidden failure interpretation:

- blaming topology or legality for a paint-only mismatch

### 2. Dash offset change

Examples:

- user drags dash phase
- user types a new dash offset

Expected dirty layers:

- interval allocation layer
- candidate geometry layer
- arrangement layer
- ownership layer
- legality layer
- resolved region layer
- paint layer
- render/hit/export payload layer

Must reuse:

- `PathTopologyModel`
- source/topology classification

Must rerun:

1. `AllocateIntervals`
2. `BuildOneSidedCandidates`
3. `PartitionArrangementAndFaces`
4. `ResolveOwnership`
5. `ApplyLegality`
6. `BuildResolvedStrokeRegions`
7. `AttachPaintPayload`
8. `EmitRenderHitExportPackets`

Most likely failure stage if output is wrong:

- interval allocation
- interval-local candidate construction

Key validation:

- committed interval schedule follows canonical arc-length basis

### 3. Dash pattern change

Examples:

- dash list changes from `[12, 8]` to `[20, 6]`

Expected behavior:

- same rerun set as dash-offset change
- interval count and seam-wrap behavior may change

Most likely failure stage if output is wrong:

- normalization
- interval allocation

### 4. Width change

Examples:

- `6 -> 12`

Expected dirty layers:

- normalized stroke-spec layer
- candidate geometry layer
- arrangement layer
- ownership layer
- legality layer
- resolved region layer
- paint layer
- render/hit/export payload layer

Usually reusable:

- `PathTopologyModel`
- topology classification
- interval records if dash schedule did not change

Must rerun:

1. `NormalizeStrokeSpec`
2. `BuildOneSidedCandidates`
3. `PartitionArrangementAndFaces`
4. `ResolveOwnership`
5. `ApplyLegality`
6. `BuildResolvedStrokeRegions`
7. `AttachPaintPayload`
8. `EmitRenderHitExportPackets`

Most likely failure stage if output is wrong:

- one-sided candidate construction
- arrangement for overlap-heavy cases
- legality if width introduces overflow

### 5. Join or cap change

Examples:

- `miter -> round`
- `butt -> round`

Expected behavior:

- topology and interval schedule usually remain reusable
- one-sided candidate geometry must rerun
- downstream legality and region build must rerun

Most likely failure stage if output is wrong:

- join-face builder
- cap-face builder

### 6. Position change

Examples:

- `center -> inside`
- `inside -> outside`

Expected behavior:

- topology usually reusable
- source family classification usually reusable
- interval records may remain reusable for the same dash schedule
- one-sided geometry must rebuild because chosen side changed

Must inspect carefully:

- support status may change if the new family is not currently exact-supported

Most likely failure stage if output is wrong:

- support-family classification
- one-sided candidate construction
- legality

### 7. Path-point move or control-point move

Examples:

- dragging one pen point
- moving one bezier handle

Expected dirty layers:

- source path layer
- topology classification layer
- interval allocation layer
- every downstream geometry layer

Must rerun:

1. `BuildPathTopologyModel`
2. `ResolveSourceFamilies`
3. `AllocateIntervals`
4. `BuildOneSidedCandidates`
5. `PartitionArrangementAndFaces`
6. `ResolveOwnership`
7. `ApplyLegality`
8. `BuildResolvedStrokeRegions`
9. `AttachPaintPayload`
10. `EmitRenderHitExportPackets`

Most likely failure stage if output is wrong:

- topology build
- source-family classification
- arrangement on overlap-heavy shapes

### 8. Topology-structure change

Examples:

- closing an open path
- splitting a contour
- adding/removing networks
- turning a simple loop into a self-intersecting shape

Expected behavior:

- full topology rebuild
- support classification may change
- blocked state may change

Most likely failure stage if output is wrong:

- topology build
- topology semantics classification
- support-scope enforcement

### 9. Interaction-mode-only change

Examples:

- preview drag mode enters or exits
- exact settle begins after interaction

Expected behavior:

- semantic classification must remain stable
- committed interval schedule must remain stable
- numeric density may change
- geometry realization level may change

Most likely failure stage if output is wrong:

- preview policy
- dirty-key handling
- illegal preview-specific geometry mutation

## Failure Localization Heuristic

If the final output is wrong, first ask what kind of wrong it is:

- wrong color but same shape:
  - inspect paint/emission
- wrong dash placement but same contour side:
  - inspect interval allocation
- wrong side or ghost band:
  - inspect one-sided candidate construction
- wrong corner/cap shape:
  - inspect join/cap builders
- wrong overlap trimming:
  - inspect arrangement then legality
- wrong ownership between intervals/networks:
  - inspect ownership
- visually plausible but unsupported family mislabeled as exact:
  - inspect active support scope and topology semantics classification

## Geometry Decision Trace For One Concrete Path

This section explains how to determine the final geometry for one authored path.

Example:

- user draws a 50-point pen path resembling an animal face
- user applies `inside + dashed`

The engine must determine the final result through this exact trace.

### Step 1. Normalize the authored stroke

Questions answered here:

- is the dash pattern valid
- is the offset valid
- is the width valid
- is the paint valid

If this fails:

- no geometry should be claimed yet

### Step 2. Build the canonical topology

Questions answered here:

- how many contours exist
- is the path open or closed
- does it self-intersect
- does it have multiple networks
- where are intersections
- what are the legal domains
- what is the canonical arc-length basis

For the 50-point face:

- if it is one closed simple contour, the path may remain in a supportable
  family
- if it self-intersects or contains multiple networks, support may move to
  `research-gated` or `blocked`

### Step 3. Classify the topology family and current support state

Questions answered here:

- is this family `supported now`
- `research-gated`
- or `blocked`

This is where the engine decides whether your animal-face path is even allowed
to claim exact inside dashed support.

If the family is not `supported now`:

- the engine must not pretend the exact result is guaranteed

### Step 4. Allocate committed dash intervals

Questions answered here:

- where do visible dash spans begin and end on canonical arc length
- how do seam-wrap intervals behave
- how many visible intervals exist

For the face path:

- this determines where dashed visibility should occur before any one-sided
  geometry is built

### Step 5. Build one-sided candidate geometry

Questions answered here:

- for `inside`, which side is inward for each contour
- what segment-body faces exist
- what join faces exist
- what cap faces exist if the path is open

This is the first stage that produces candidate geometry for the face.

If the output already shows outer ghost geometry here:

- the bug is in one-sided construction, not in legality

### Step 6. Partition arrangement if overlap exists

Questions answered here:

- do candidate faces overlap
- do they self-overlap under high curvature
- do we need explicit face regions

For a detailed animal face, especially around ears, cheeks, or tight turns:

- high curvature may force arrangement even if the path is not self-intersecting

### Step 7. Resolve ownership

Questions answered here:

- which face belongs to which interval or network owner
- whether repeated intervals from one stroke remain coherent

For one single stroke on one face path:

- ownership may be simple
- but the stage still matters if intervals overlap or repeat

### Step 8. Apply legality

Questions answered here:

- which owned faces remain legal for `inside`
- which faces must be trimmed or removed

This is where the engine decides the final visible one-sided dashed geometry,
not by inventing it, but by filtering candidate faces correctly.

### Step 9. Build semantic-region packets

Questions answered here:

- what are the final exact visible regions
- what are their bounds
- what are their owner/support or blocked/legality identities

This is the canonical answer to:

- "what is the final geometry for my animal face"

### Step 10. Attach paint and emit payloads

Only after semantic regions are final:

- paint is attached
- render/hit/export payloads are emitted

## How To Know Whether The Rendered Result Is "What I Want"

For a concrete authored path, this plan says the result is trustworthy only if
all of these are true:

1. the topology family is `supported now`
2. the current parameter combination is supported for that family
3. the dash intervals were allocated on canonical arc length
4. the one-sided candidate geometry matches the chosen side
5. arrangement/ownership/legality all agree
6. the final semantic-region packets match tests or approved reference fixtures

If any of these are false, the system may still show something visible, but it
must not claim that the exact result is guaranteed.

## Test And Debug Usage

This file should be used to build:

- parameter-change regression tests
- stage-rerun assertions
- dirty-layer assertions
- support-state assertions
- failure-localization playbooks

Minimum debug output expected from the runtime for one stroke update:

- changed parameter family
- dirty layers
- rerun stages
- support state
- interval summary
- candidate-face count
- partitioned-face count
- final semantic-region count

## Success Criteria

This matrix is only complete when:

- a developer can predict rerun stages from one parameter edit
- a tester can derive expected dirty-layer behavior from one parameter edit
- a reviewer can inspect one arbitrary path and explain how final geometry is
  derived
- a bug report can be narrowed to likely stages without guessing
