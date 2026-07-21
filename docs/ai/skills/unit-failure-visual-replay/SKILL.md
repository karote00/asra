---
name: unit-failure-visual-replay
description: Use when unit or integration tests emit source-space failure manifests and the user needs browser replay screenshots with markers showing where each failure appears in the app. Applies to canonical stroke tests and future geometry/UI tests that can map failures to fixture-local coordinates.
---

# Unit Failure Visual Replay

## Trigger Signals

Use this skill when:

- A unit/integration test fails and can emit a source-space failure manifest.
- The user asks to see where a unit failure appears on the actual app canvas.
- A test failure contains geometry coordinates, source segment IDs, anchor IDs, terminal IDs, or fixture-local points.
- A visual replay should be generated without making the unit test depend on browser/E2E runtime.

## Do Not Use When

- The failure cannot be mapped to fixture-local coordinates or a stable fixture.
- The user only needs the raw test log.
- The requested validation is already a normal E2E screenshot without a unit manifest.
- The replay would require operating outside the project artifact directories.

## Required Inputs

- Unit/integration test command that emits a manifest.
- Manifest path.
- E2E replay spec path.
- Existing app URL resolved from `ASYRA_DESIGN_APP_URL`.
- Fixture reconstruction rules keyed by `caseKey` and `fixtureKind`.

For canonical stroke matrix:

- Unit command:

```bash
yarn workspace @asyra/preset vitest run src/__tests__/stroke-canonical-matrix.test.ts --reporter=basic
```

- Replay command:

```bash
ASYRA_DESIGN_APP_URL=http://localhost:3000 yarn workspace @asyra/asyra-design test:e2e e2e/stroke-canonical-failure-replay.spec.ts --reporter=line
```

## Preflight

1. Resolve `ASYRA_DESIGN_APP_URL` and confirm the relevant app server is already available there.
2. Confirm the unit test writes or clears the manifest every run.
3. Confirm the replay spec reads JSON only, not unit test source.
4. Confirm artifact paths are inside the project.
5. Confirm stale manifest behavior: passing unit tests must remove or overwrite old failure data.

## Deterministic Procedure

1. Run the unit/integration test.
   - A non-zero exit code is expected when product bugs are present.
   - Do not weaken assertions or delete the manifest to make the command pass.

2. Inspect the manifest.
   - Read `failureCount`.
   - Confirm `failures.length === failureCount`.
   - Confirm every failure has `markerId`, `errorCode`, `caseKey`, `fixtureKind`, `localPoint`, and `recommendedViewport`.

3. Run the replay E2E spec.
   - Rebuild the fixture from `caseKey` and `fixtureKind`.
   - Focus the viewport using `recommendedViewport.zoom` and `recommendedViewport.center`.
   - Draw the marker at `localPoint`.
   - Screenshot each marker.
   - Write a report linking marker IDs to screenshots.

4. Check replay outputs.
   - Screenshot count should match manifest `failureCount`, unless the replay intentionally caps samples and documents the cap.
   - Marker labels must be visible.
   - Report rows must include marker ID, error code, case key, source location, summary, and screenshot link.

## Validation Matrix

Validate these conditions:

- Manifest generated from the current unit run, not stale.
- Replay E2E passes.
- Number of marker screenshots matches manifest failure count.
- Report exists and links to screenshots.
- At least one representative screenshot per `errorCode` is visually inspectable.
- Targeted lint passes for edited test/replay files.

## Required Output Format

Report concisely:

- Unit command result and failed test count.
- Manifest failure count.
- Replay E2E result.
- Marker screenshot count.
- Manifest/report paths.
- Representative screenshots when the user asks to see them.

## Guardrails

- Unit tests must remain browser-independent.
- E2E replay must not import unit test files.
- Do not use screenshot generation as a substitute for unit assertions.
- Do not start an extra dev server if `ASYRA_DESIGN_APP_URL` is already serving the app.
- Do not store artifacts outside the project.
- Keep repetitive failures capped deterministically so replay remains usable.

## Failure Policy

- If manifest is missing after a failing unit test, fix the manifest emission first.
- If replay cannot reconstruct a fixture, add explicit `fixtureKind`/`caseKey` handling.
- If marker placement is wrong, fix `localPoint` or fixture rect mapping before trusting screenshots.
- If E2E replay fails because the app is unavailable, report that environment issue separately from product failures.
- If the unit test passes, stale failure artifacts should not be treated as current evidence.

## Manifest Contract

Required per failure:

- `markerId`: stable marker like `F001`.
- `errorCode`: compact taxonomy such as `STROKE_OVERLAP`, `CAP_EXTENSION_MISSING`, `CAP_SHAPE_MISMATCH`, `SEGMENT_ENVELOPE_MISMATCH`, `JOIN_SIGNATURE_MISSING`, or `PIPELINE_INCOMPLETE`.
- `caseKey`: enough to rebuild fixture and stroke state.
- `summary`: one-line diagnosis.
- `fixtureKind`: fixture builder selector, such as `self-check-star` or `open-line`.
- `localPoint`: fixture-local marker point.
- `recommendedViewport`: `{ zoom, center }` in fixture-local coordinates.

Recommended:

- `sourceSegmentId`, `sourcePointId`, `nearestAnchorId`.
- `t` along source segment.
- `side`: `inside`, `outside`, `center`, `terminal`, `join`, or `overlap`.
- `expected` and `actual` compact values.
