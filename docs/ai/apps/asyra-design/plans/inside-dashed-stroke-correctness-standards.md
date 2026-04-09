# Inside Dashed Stroke Correctness Standards

**Status:** active working standard  
**Scope:** how to interpret `inside + dashed` correctness vs diagnostics  
**Purpose:** prevent the project from enforcing the wrong target while
continuing algorithm-first work

## Why This Exists

Recent work showed that several metrics are useful, but they are not all
correctness targets.

If they are mixed together, the project can get stuck in a false “almost fixed”
loop:

- a diagnostic metric improves
- a different legitimate behavior regresses
- the system still does not have a valid final-face ownership rule

This document separates:

- production correctness standards
- artifact-only viability standards
- diagnostic signals
- explicit non-standards

Quick matrix:

- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-gate-matrix.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-gate-matrix.md)

---

## 1. Production Correctness Standards

These are valid hard targets for runtime behavior.

### A. Schedule Ownership Remains Canonical

- authored dash/gap intervals are assigned on path arc length
- later stages may constrain width/shape
- later stages may not reinterpret interval length ownership

### B. Scenario Taxonomy Must Stay Explicit

- `promotable-local-gap`
- `round-cap-canonical-gap`
- `remote-pollution`
- `scenario-owned-gap`

Different scenario classes must not be forced through one repair rule.

### C. Local Repair Must Stay Narrow

- local-gap promotion may only apply to the current narrow promotable class
- canonical straight-side round-cap pairs must stay excluded
- remote-pollution must stay excluded
- scenario-owned gaps must stay excluded unless a higher-order scenario exports
  a safe trimming contract

### D. Final-Face Correctness Beats Intermediate Convenience

The valid runtime target is final visible ownership, not any one intermediate
debug stage.

Examples already accepted by current work:

- split-pair final coverage can be correct even when body-only is under-cover
- closed-seam final coverage can be correct even when ownership/body-only are
  not themselves legal final answers

### E. No Workarounds

- no sample-specific branches
- no point-specific branches
- no dash-index-specific runtime ownership patches
- no non-dash-layer fixes

---

## 2. Artifact-Only Viability Standards

These are valid standards for prototype evaluation, but they do **not** by
themselves authorize runtime ownership changes.

### A. Explicit Self-Overlap Decomposition May Be Artifact-Ready

For remote-pollution, a Family B prototype is artifact-ready only if it keeps:

- neighboring-exclusive region
- remote-exclusive region
- shared overlap region

and also proves:

- recomposed union matches the source contributor union inside the local window
- no raster overcoverage is introduced by the decomposition

### B. Artifact-Ready Is Not Runtime-Ready

Even if a prototype is artifact-ready, runtime remains blocked until there is a
real ownership rule for:

- which branch is authoritative, if any
- whether overlap is retained, excluded, or prioritized
- how that rule generalizes beyond the reported sample

If that ownership rule is missing, the correct runtime state is still:

- `diagnostic-only`

Concrete reject rule for the current remote-pollution line:

- if a decomposition still contains:
  - neighboring-exclusive region
  - remote-exclusive region
  - shared overlap region
  at the same time
- and there is still no runtime policy for how the overlap region is owned

then runtime promotion must still be rejected, even if the decomposition is
artifact-ready.

---

## 3. Diagnostic Signals

These signals are useful and should stay available, but they are not
standalone correctness targets.

### A. Stage Diagnostics

- `pre-constraint`
- `raw`
- `wedge`
- `ownership`
- `body-only`
- `cap-only`
- `final`

These stages are used to locate where a failure enters the pipeline.

### B. Contributor Diagnostics

For remote-pollution, these are valid diagnostics:

- contributor count
- contributor identity
- boundary source kind
- touched segment indices
- intrusion ratio

These are important because a remote case must not silently degrade into a fake
local case.

### C. Clear Ratios / Coverage Ratios

These are valuable comparison metrics, but they are not self-sufficient
correctness definitions.

They help answer:

- how much of a gap is visually occupied
- whether a prototype restores or regresses a local window
- whether a contributor materially intrudes

They do **not** alone answer:

- which branch owns the region
- whether a healthy round-cap case was wrongly “repaired”

---

## 4. Explicit Non-Standards

The following should **not** be treated as universal correctness goals.

### A. “Every visible gap must be fully clear”

This is too strong.

Reason:

- canonical straight-side round-cap pairs are allowed to keep ordinary round-cap
  symmetry
- strict gap preservation is not the universal answer

### B. “Body-only should match final”

This is false for current accepted geometry.

Body-only is a useful diagnostic baseline, not a universal final target.

### C. “Artifact-ready means safe to promote”

This is false.

Artifact viability only means the geometry decomposition is coherent enough to
study.

### D. “If a gap looks bad, the neighbor pair must be wrong”

This is false for remote-pollution.

A gap can be schedule-local but not 2D-isolated.

---

## 5. Current Working Rule

Until a remote-pollution runtime ownership family is selected:

- Family B may continue to improve as an artifact decomposition contract
- Family A and Family C remain rejected as runtime-ready directions
- remote-pollution remains `diagnostic-only`
- local-gap promotion remains narrow
- body-only / cap-only / stage metrics remain diagnostics, not final targets

This is the current standard to use when deciding whether a new test or metric
is enforcing the right thing.
