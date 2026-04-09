# Inside Dashed Stroke Final-Face Algorithm Rules

**Status:** active algorithm contract  
**Scope:** pure algorithm rules for inside dashed stroke final-face construction  
**Runtime changes:** none  
**Purpose:** provide an implementation contract that can drive runtime work,
unit tests, and later debugging without reverting to ad-hoc local fixes

## Goal

Define a final-face algorithm for `inside + dashed` stroke rendering that is:

- geometry-first
- scenario-based
- deterministic
- testable as explicit invariants
- free of workaround logic

This document is intentionally not a bug diary. It is the contract for how the
algorithm should work.

---

## Non-Negotiable Rules

1. **No workaround logic**
   - no point-id-specific branches
   - no dash-index-specific branches
   - no reported-sample-only patches
   - no postprocess "repair" after malformed geometry is already emitted

2. **Schedule is canonical**
   - authored `dash` and `gap` values define longitudinal ownership
   - later stages may constrain legal width/shape
   - later stages may not reinterpret interval length

3. **Scenario rules must be geometric**
   - all branching must be triggered by geometry contracts already present in
     the pipeline
   - examples: seam pair, same-corner split pair, smooth turn, same-segment
     adjacent caps

4. **Final-face is a region problem**
   - boundary specs do not directly define final visibility
   - final visibility is the output of a region decomposition

5. **Every rule must be unit-testable**
   - if a rule cannot be mapped to a deterministic unit/integration test, it
     is not specific enough

---

## Input / Output Contract

## Inputs

The final-face layer receives:

- authored dash interval ownership
  - `startDistance`
  - `endDistance`
- scenario-local source geometry
  - `outerBoundary`
  - `innerBoundary`
  - `centerlinePoints`
- scenario-local constraints
  - split constraints
  - wedge constraints
  - seam markers
  - cap presence
- stroke attrs
  - width
  - position
  - cap style

## Output

The final-face layer must emit:

- one or more polygons representing the final visible region

Those polygons must satisfy all of:

- full authored interval coverage where geometry is legal
- no unintended overlap
- no self-intersection
- deterministic ownership across scenario boundaries

---

## Whole Pipeline Contract

The full stroke pipeline is:

1. normalize stroke input
2. allocate dash/gap intervals
3. extract interval-local source geometry
4. declare scenario constraints
5. build boundary specs
6. decompose into final visible regions
7. emit polygons
8. triangulate/project mesh

This contract only redefines **Step 6**, but it depends on the boundaries of
the surrounding stages being respected.

---

## Stage Rules

## Stage 1: Allocation

### Rule

Dash/gap windows are assigned on authored path arc length.

### Guarantees

- `intervalLengthSpan` should be zero for full intervals
- `gapLengthSpan` should be zero for full gaps
- first interval starts from path origin unless the stroke policy says
  otherwise

### Forbidden

- shifting ownership because a corner "looks tight"
- shortening an interval because width legality becomes narrow

## Stage 2: Source Geometry

### Rule

Each interval is mapped to local source geometry without losing authored
longitudinal ownership.

### Guarantees

- source geometry may span multiple segments
- `exact-cubic` should be preferred where valid
- `sampled` is a source representation, not a semantic fallback for ownership

### Forbidden

- treating segment boundaries as dash boundaries
- using source extraction to solve final visibility

## Stage 3: Scenario Constraint Declaration

### Rule

This stage may declare geometry legality, but may not decide final-face
ownership by itself.

### Allowed outputs

- split constraints
- wedge constraints
- seam markers
- cap presence flags
- scenario tags

### Forbidden

- direct final clipping heuristics that implicitly solve visibility
- using ownership hints as if they were already final polygons

## Stage 4: Boundary Specs

### Rule

Boundary specs are intermediate descriptors, not render output.

### Required meaning

A spec may say:

- this boundary exists
- this boundary participates in a local scenario
- this boundary retains start or end cap eligibility

It may not imply:

- "clip this and render the result directly"

## Stage 5: Final-Face Decomposition

### Rule

Final polygons must be built from explicit region decomposition, not from
incremental ownership trimming.

### Consequence

If a scenario cannot be represented correctly by the current decomposition
family, the decomposition family must change.

---

## Scenario Taxonomy

The final-face algorithm must distinguish at least these scenario classes.

## 1. Generic Single-Spec Dash

Conditions:

- one spec
- no split pair
- no seam pair
- no competing adjacent local ownership

Algorithm family:

- generic single-band final face

## 2. Smooth-Turn Crossing Dash

Conditions:

- interval crosses a smooth turn
- no sharp wedge conflict

Algorithm family:

- generic multi-slice composition is acceptable if:
  - coverage is preserved
  - ownership remains legal

## 3. Seam Pair

Conditions:

- closed path
- split occurs across the seam

Algorithm family:

- seam-specific decomposition

Rationale:

- seam is not a normal generic corner

## 4. Same-Corner Split Pair

Conditions:

- exactly two local specs from the same local split/corner
- no seam
- no unresolved wedge conflict
- authored interval continuity must be preserved through the split

Algorithm family:

- **three-region decomposition**

This is the primary active target for new algorithm work.

## 5. Gap-Local Adjacent Terminal Pair

Conditions:

- two adjacent dashes define one local gap window
- both can contribute terminal shapes near the same gap

Algorithm family:

- local gap ownership policy

Important:

- this is distinct from global self-overlap pollution

## 6. Global Self-Overlap Pollution

Conditions:

- a non-neighbor dash projects into the same 2D region as a local gap window

Algorithm family:

- diagnose separately
- do not treat as a local cap bug by default

---

## Final-Face Decomposition Rules

## Generic Rule

The final visible face must be produced by selecting a **decomposition family**
based on scenario class, then building explicit regions.

The algorithm is:

1. classify scenario
2. select decomposition family
3. build region set
4. validate region set
5. emit polygons only if validation succeeds

## Validation Rules

Every emitted region set must satisfy:

1. authored interval coverage where geometry is legal
2. `maxRasterCoverage <= 1` unless overlap is explicitly proven harmless and
   represented as a single legal face
3. no self-intersection
4. deterministic result under repeated evaluation

If a region set fails these, the decomposition family is wrong for that
scenario.

---

## Same-Corner Split-Pair Rules

This is the scenario where the current algorithm is weakest.

## Required Regions

A same-corner split pair must be decomposable into:

1. **leading retained region**
   - the valid portion of the leading spec

2. **trailing retained region**
   - the valid portion of the trailing spec

3. **bridge / lens region**
   - the shared intermediate region required to preserve continuity without
     overlap

## Explicit Rule

The bridge / lens region is **not automatically**:

- the full polygon intersection
- a merged single face
- a trim artifact from one plane

It must be constructed as its own bounded region with explicit boundaries.

## Required Properties

For a valid split-pair decomposition:

- `coverageRatio = 1`
- `preCornerCoverageRatio = 1`
- `maxRasterCoverage <= 1`
- no self-intersection

## Failure Interpretation

If a candidate gives:

- full coverage but overlap

then the retained regions are too broad.

If a candidate gives:

- no overlap but low coverage

then the retained regions or bridge are too narrow.

If a candidate gives:

- the same result as current merged face

then the representation is still too weak.

---

## Gap-Local Cap Rules

Caps are terminal shapes, not interval extenders.

## Canonical Rules

1. gap ownership belongs to the gap window
2. cap presence may visually terminate a dash
3. cap presence may not consume authored gap ownership without an explicit
   local scenario rule
4. local gap legality must consider both neighboring dashes together

## Forbidden

- generic cap trim applied everywhere
- cap-only postprocess after final geometry is already wrong

---

## Forbidden Behaviors

The final algorithm must never:

- shorten a dash interval because an acute corner is visually tight
- use cap geometry as hidden bridge geometry
- use seam logic for non-seam corners
- use generic corner logic for seam pairs
- fix one scenario by weakening earlier-stage guarantees

---

## Unit-Test Mapping

Every rule above should map to tests. The minimum mapping is:

## Allocation Invariants

- full-path interval monotonicity
- full-path interval length span
- full-path gap length span

## Source Geometry Invariants

- first acute-angle dash preserves authored longitudinal length
- crossing dash preserves multi-segment source length

## Constraint Invariants

- acute wedge legality
- sharp corner wedge legality
- seam-local raw/wedge decomposition sanity

## Final-Face Invariants

- worst split-pair first broken layer must be detectable
- same-corner split-pair decomposition candidate must meet:
  - coverage
  - no overlap
  - no self-intersection
- seam pair must preserve pre/post seam continuity without overlap
- smooth-turn crossing dash must preserve body ownership through the turn

## Gap Invariants

- distinguish local neighboring-gap problems from remote self-overlap pollution
- local gap policy must not be tested against polluted global windows

---

## Practical Workflow For Future Work

1. identify first broken layer
2. decide whether the current decomposition family is expressive enough
3. if not, define a new scenario-level decomposition family
4. prove it in artifact/unit test first
5. then wire it into runtime

This is the required workflow change away from debug-driven local tweaking.

---

## Final Rule

If the algorithm cannot explain a case in terms of:

- schedule
- source geometry
- scenario classification
- region decomposition

then the algorithm spec is incomplete and must be revised **before** more
runtime tuning is attempted.
