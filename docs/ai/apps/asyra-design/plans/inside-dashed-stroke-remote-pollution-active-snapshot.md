# Inside Dashed Stroke Remote-Pollution Active Snapshot

**Status:** active snapshot  
**Scope:** current reported-sample remote-pollution case only  
**Purpose:** quick reference for the active remote case without opening test
files

Related documents:

- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-remote-pollution-spec.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-remote-pollution-spec.md)
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-correctness-standards.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-correctness-standards.md)
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-gate-matrix.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-gate-matrix.md)

Primary generated artifact:

- `packages/preset/artifacts/full-path-dash-gap/reported-sample-remote-pollution-active.json`

That JSON is the shortest machine-readable summary for the current active remote
case. Use it before opening the larger metrics artifact.

---

## Active Case

Current reported-sample active remote contributor:

- `dashIndex = 28`
- `boundarySourceKind = exact-cubic`
- `touchedSegmentIndices = [3]`

Current classification:

- `classification = remote-pollution`
- `remoteContributorCount > 0`
- local-gap promotion remains excluded

---

## Current Gate Status

### Production Hard Gates

- `remote-pollution` classification: active
- remote contributor identity preservation: active
- local-gap promotion exclusion for remote case: active

These are runtime-facing contracts and should stay hard-gated.

### Artifact Gates

- Family B explicit self-overlap decomposition is the only currently viable
  artifact family
- Family B is `artifact-ready` only when it preserves:
  - neighboring-exclusive region
  - remote-exclusive region
  - shared overlap region
- Family B recomposed contributor union must match the source contributor union
  in the local window
- Family B must not introduce raster overcoverage
- runtime reject contract must remain active

These are direction-selection / decomposition-quality contracts, not runtime
ownership contracts.

### Diagnostic Signals

Useful but not final correctness targets:

- `body-only`
- `cap-only`
- `raw`
- `wedge`
- `ownership`
- contributor intrusion ratios
- contributor counts

These help explain where the remote case enters the pipeline.

### Rejected Readings

- `artifact-ready` means `runtime-ready`
- every visible gap must be fully clear
- the neighbor pair must be the primary bug source

---

## Current Family Reading

### Family A: Global Overlap Ownership

- currently rejected as runtime-ready
- still useful as a comparison family
- blocked because it needs a priority rule and discards a competing contributor
  family

### Family B: Explicit Self-Overlap Decomposition

- currently selected as the only viable artifact family
- currently **not** runtime-ready
- blocked because overlap-region ownership is still undefined

### Family C: Authoritative Branch Projection

- currently rejected as runtime-ready
- blocked because single-branch authority erases a competing contributor family

---

## Current Runtime Reading

The current accepted runtime state for this active remote case is:

- `diagnostic-only`

Reason:

- multiple contributor families remain active in the same local window
- the decomposition can be artifact-ready while still lacking a valid runtime
  ownership policy for the overlap region

This is the current snapshot to use before proposing any runtime promotion.
