# Reference Dashed Stroke Rendering E2E Definition

## Purpose

This E2E test defines a visual oracle for dashed stroke rendering on a fixed
vector path. Its job is to verify the rendered image on canvas, not just the
scene data or property payload.

This test exists to answer one question:

`When a known path is rendered with a known dashed stroke configuration, does the final canvas output match the stroke contract?`

## Why This Test Exists

Dashed stroke regressions are difficult to detect by data-only assertions.
The scene tree can contain the correct stroke properties while the canvas still
renders the wrong result.

This test therefore treats the canvas as the source of truth and uses geometry
only to locate where pixels should be sampled.

## Scope

The test verifies:

- first dash rendered length on the first path segment
- first gap rendered length after the first dash
- inside stroke placement relative to point order
- outside side remains unpainted
- stroke color is visually dominant on the inside sample
- debug render logs are absent

The test does not verify:

- every dash on the full path
- every join and cap on every segment
- exact pixel-perfect raster output
- internal implementation details of the renderer

## Input Contract

The fixture is defined by explicit rendering inputs:

- path geometry is constructed from the reference point sequence
- the first segment is `tp-22 -> tp-23`
- stroke width is `10`
- stroke style is `dashed`
- dash length is `30`
- gap length is `40`
- stroke position is `inside`
- stroke join type is `round`
- stroke color is `#d90909`
- stroke opacity is `0.5`

These values are input assumptions only.
They do not prove correctness by themselves.

## Derived Observables

Correctness is derived from visual observables that follow from the input
contract:

1. The first visible dash on the first segment should be approximately the
   configured dash length after raster tolerance is accounted for.
2. The first dash should begin at the start of the first segment, which means
   the painted phase should begin near `tp-22`.
3. The first visible gap after that dash should be approximately the configured
   gap length after raster tolerance is accounted for.
4. The side defined as `inside` by point order should contain red stroke pixels.
5. The opposite side should not contain stroke pixels.

## Test Fixture Construction

The test must create the fixture through real UI actions.
It must not import a prebuilt vector object into the app state.

Required fixture steps:

1. Open the app and reset the canvas.
2. Select the Pen tool.
3. Create the fixed closed path by clicking and dragging the reference anchors
   and handles in order.
4. Stay in path editing only long enough to finish geometry creation.
5. Clear point selection with one `Escape` so vector stroke properties are shown.
6. Apply the stroke properties through the properties panel.
7. Exit path editing.
8. Use `Cmd+1` zoom-fit before screenshot capture.

## Viewport Normalization Rule

Zoom is part of the measurement model.

The test does not measure abstract model-space values directly from the canvas.
It measures rasterized pixels after model-space geometry has been projected
through the current zoom and viewport.

Because of that, rendering E2E tests must normalize the viewport before
measurement.

For this test, the normalization rule is:

1. finish fixture construction
2. exit editing overlays that would pollute the image
3. apply `Cmd+1` zoom-fit
4. read fresh zoom and viewport values after normalization
5. convert workspace probe points into screenshot coordinates using those fresh
   values

Any benchmark-oriented rendering E2E must define its viewport normalization
strategy explicitly.

## Independent Curve Oracle Rule

When the render subject contains curves, the test must use an independent
curve oracle to decide where to measure.

That means:

- the test may compute Bezier positions, tangents, normals, arc length tables,
  and probe locations
- the test may use scene geometry as fixture input
- the test may not call the production renderer to decide whether the output is
  correct
- the test may not reuse production pass/fail logic as its oracle

The purpose of the independent oracle is not to reimplement the entire renderer.
Its purpose is only to compute stable, explainable probe locations and expected
visual behavior.

For this test, the independent curve oracle is responsible for:

- converting the first cubic segment into an arc-length table
- locating sample points along the first segment
- treating `tp-22 -> tp-23` as the traversal origin and first segment direction
- computing the inward side from point order
- offsetting probe points inward and outward for coverage checks

## Visual Measurement Protocol

The test measures rendering with a geometry-guided probe pipeline:

1. Read the selected vector snapshot only to obtain:
   - element position
   - element bounds
   - ordered points and handles
   - zoom and viewport values
2. Convert local point coordinates into workspace coordinates.
3. Build an arc-length table for the first Bezier segment.
4. Sample the first segment at regular distance intervals.
5. For each sample point, compute the local inward normal using point order.
6. Offset the sample point inward by a fixed probe distance.
7. Capture a clipped screenshot around the element.
8. Probe a small pixel neighborhood around each inward sample point.
9. Convert those sampled pixels into a boolean coverage sequence.
10. Normalize tiny raster gaps and isolated hits.
11. Reduce the sequence into runs of painted and unpainted regions.

## Measurement Ownership

The measurement is performed by the E2E oracle, not by Playwright itself and
not by the production renderer.

Measurement responsibilities are split as follows:

- Playwright builds the fixture, normalizes the viewport, and captures the
  screenshot.
- Test-side geometry helpers compute probe locations.
- Test-side pixel sampling logic measures whether expected pixels are present.
- Assertions compare measured observables against the visual contract.

## Pass Criteria

The test passes only if all of the following are true:

- the first painted run length is within the accepted dash tolerance
- the first dash begins within the accepted start-distance tolerance from the
  first segment origin
- the first unpainted run length is within the accepted gap tolerance
- the inside probe is covered by red-dominant pixels
- the outside probe is not covered by stroke pixels
- no debug console logs are emitted

## Failure Meaning

If this test fails, it should be interpreted as a rendering failure, not a
fixture-building failure, unless the path itself could not be created.

Examples:

- first dash too short -> dash placement or flattening precision regression
- inside probe empty -> inside/outside offset regression
- outside probe painted -> stroke side regression
- no red dominance -> color or opacity regression

## Reuse Pattern

This file is the template for future difficult render E2E tests.

Future tests should follow the same structure:

1. define a rendering contract
2. define derived observables
3. define viewport normalization
4. define an independent oracle for difficult geometry
5. build the fixture through UI actions
6. capture the canvas
7. measure pixels with geometry-guided probes
8. assert semantic render behavior, not raw implementation details

## Non-Negotiable Rule

Do not let the production renderer define its own oracle.

The test may use production geometry only to locate probes on the canvas.
It must not reuse production pass/fail logic to decide whether rendering is
correct.
