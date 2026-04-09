# Inside Dashed Stroke Gap-Local Cap Pseudo Algorithm

**Status:** active design draft  
**Scope:** `inside + dashed` final-face behavior for a local authored gap between two adjacent dashes  
**Purpose:** define an implementable algorithm for local gap ownership that is compatible with the finalized split-pair work and explicitly separates local gap bugs from remote self-overlap pollution

## Goal

Define a runtime-ready algorithm for the scenario:

- two authored dash windows are adjacent in schedule order
- they define one authored gap window
- their final faces may locally intrude into that gap

This algorithm must answer:

1. when the problem is truly local
2. what part of each neighboring dash may legally remain near the gap
3. how caps and body terminal regions coexist without erasing the authored gap

This algorithm must **not** attempt to solve:

- global self-overlap pollution from non-neighbor dashes
- split-pair same-corner decomposition inside a single dash
- seam-local decomposition

Those remain separate scenario classes.

---

## Scenario Contract

## Inputs

For one authored gap `g_i = [d_i.endDistance, d_{i+1}.startDistance]`, the algorithm receives:

- leading dash final-face inputs
  - body boundaries
  - cap eligibility
  - final-face scenario metadata
- trailing dash final-face inputs
  - body boundaries
  - cap eligibility
  - final-face scenario metadata
- authored gap window
  - `gapStartDistance`
  - `gapEndDistance`
  - `gapLength`
- local path geometry over the union of:
  - trailing terminal portion of dash `i`
  - gap `g_i`
  - leading terminal portion of dash `i + 1`
- local diagnostics
  - whether either dash is already classified as seam
  - whether either dash is already classified as same-corner split pair
  - whether non-neighbor polygons project into the same 2D window

## Output

One of:

1. a validated **local gap pair region set**
2. a declaration that the case is **not local** and must not be repaired by gap-local policy

The emitted local region set must preserve:

- authored local gap ownership
- neighboring dash terminal continuity
- no overlap
- no reliance on fixture-specific tuning

---

## Pre-Classification

Before any local cap/body rule runs, the runtime must classify the gap.

### Class A: Local Adjacent Pair

Conditions:

- the only polygons intersecting the local gap window belong to:
  - leading dash `i`
  - trailing dash `i + 1`
- no non-neighbor dash projects into the same local 2D gap window

This is the only class the gap-local algorithm is allowed to repair.

### Class B: Remote Pollution

Conditions:

- one or more non-neighbor dashes project into the same local 2D gap window

This class is **not** a gap-local cap problem.

The gap-local algorithm must:

- record diagnostics
- decline to repair
- leave responsibility to the broader final-face overlap stage

### Class C: Scenario-Owned Gap

Conditions:

- either neighboring dash is already owned by:
  - seam-specific decomposition
  - split-pair same-corner decomposition

In this case, gap-local policy may only run if the owning scenario explicitly
exports local terminal regions for further legal trimming.

Otherwise:

- do not attempt independent gap-local repair

---

## Required Derived Geometry

For a local adjacent pair, the algorithm must derive:

1. **gap axis**
   - local longitudinal axis from `gapStartDistance -> gapEndDistance`
   - this is the canonical local forward direction

2. **leading terminal cross-sections**
   - a non-degenerate near-gap cross-section
   - a second supporting cross-section slightly farther inside the leading dash

3. **trailing terminal cross-sections**
   - a non-degenerate near-gap cross-section
   - a second supporting cross-section slightly farther inside the trailing dash

4. **local lateral envelope**
   - lateral bounds from the two neighboring dash bodies near the gap

5. **local gap window in 2D**
   - a bounded local rectangle/lens-like window aligned to:
     - gap axis in longitudinal direction
     - local lateral envelope in transverse direction

This 2D local gap window is not the authored gap itself. It is the spatial
window in which local gap ownership must be decided.

---

## Core Rule

The local gap must be solved by a **three-owner terminal decomposition**:

1. leading terminal retained region
2. trailing terminal retained region
3. gap-owned local window

Caps are not separate owners. Caps are merely terminal sub-geometry of the
leading/trailing retained regions.

This is critical:

- the final solution should not "add a cap policy after the fact"
- instead, terminal cap geometry must be emitted only insofar as it remains
  inside the retained region of its owning dash

---

## Pseudo Algorithm

## Step 1: reject non-local cases

1. compute all polygons intersecting the local gap 2D window
2. if any polygon belongs to a non-neighbor dash:
   - classify as remote pollution
   - return `null`

## Step 2: build neighboring terminal regions

1. construct the leading dash final face without using the neighboring gap as
   an ownership source
2. construct the trailing dash final face without using the neighboring gap as
   an ownership source
3. isolate only the local terminal portions near the gap

## Step 3: derive local gap window

1. get the leading near-gap non-degenerate cross-section
2. get the trailing near-gap non-degenerate cross-section
3. get one additional supporting cross-section from each side, slightly inside
   the owning dash
4. use these cross-sections to define:
   - local longitudinal bounds
   - local transverse bounds
5. build a bounded local gap window polygon

The gap window must:

- sit between the two neighboring dashes in authored schedule order
- remain local
- avoid global hull growth

## Step 4: carve retained regions

1. subtract the local gap window from the leading terminal region
2. subtract the local gap window from the trailing terminal region
3. keep only the pieces that remain connected to their owning dash body

This removes any terminal cap/body geometry that illegitimately occupies the
local gap-owned window.

## Step 5: emit local pair result

1. union:
   - leading retained region(s)
   - trailing retained region(s)
2. do **not** emit the gap window itself as geometry
3. validate:
   - no overlap
   - no self-intersection
   - acceptable gap clear ratio
   - acceptable neighboring dash coverage

## Step 6: fallback rule

If validation fails:

- do not apply a weaker trim heuristic
- do not suppress caps generically
- return `null`

The caller must then keep the prior valid scenario result and record a failing
diagnostic, rather than silently degrading the geometry contract.

---

## Differences From Rejected Directions

### Not generic cap trim

Rejected because:

- it damages healthy round-cap scenarios
- it does not distinguish local pair from remote pollution

### Not cap-only suppression

Rejected because:

- some bad local gaps are body-dominated
- some bad global gaps are remote-pollution dominated

### Not pairwise postprocess after final geometry

Rejected because:

- it becomes workaround-shaped
- it treats invalid ownership as already final

### Not full polygon intersection as shared region

Rejected because:

- it creates overlap-heavy bridge shapes
- it does not preserve local gap ownership

---

## Feasibility Assessment

This algorithm is feasible if the runtime can already provide:

- neighboring terminal body/cap geometry
- local cross-sections
- local schedule distances
- remote-pollution diagnostics

Current evidence suggests this is already mostly available:

- authored schedule is trusted
- neighboring dash artifact diagnostics already exist
- body-only / cap-only contributions are already measurable

So the main implementation effort is not missing data. It is:

- choosing the right local gap window construction
- making local-region subtraction deterministic

---

## Validation Rules

For a successful local gap solution:

1. local neighboring dash coverage must remain valid
2. local gap clear ratio must improve relative to the prior final-face result
3. `maxRasterCoverage <= 1`
4. no self-intersection
5. no dependence on dash index, point id, or fixture identity

---

## Unit / Artifact Mapping

This algorithm should be covered by:

1. artifact diagnostics
   - local pair only
   - body-only contribution
   - cap-only contribution
   - remote contributor isolation

2. unit hard gates
   - local gap final clear ratio
   - neighboring leading/trailing retained coverage
   - no-overlap raster max

3. negative tests
   - remote pollution case must not be "fixed" by local gap policy
   - healthy comparator pair must remain healthy

---

## Immediate Next Implementation Target

When implementation starts, the first target should be:

- the true local pair:
  - `dash 25 -> gap 25 -> dash 26`
- not the globally worst gap contaminated by remote contributor `dash 28`

The implementation order should be:

1. add explicit local gap classifier
2. add local gap window builder
3. add retained-region subtraction
4. validate on local pair artifact
5. only then promote into final runtime path
