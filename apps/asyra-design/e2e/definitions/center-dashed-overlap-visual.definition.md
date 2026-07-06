# Center Dashed Overlap / Ownership Debug Surface

Authority note: this file is non-authoritative reference material for later
E2E/debug review. It must not define current stroke semantics, correctness
gates, inspector owner stages, route conditions, or product output rules.

## Scope

This reference note records later-phase evidence for the first visible formal
overlap diagnostics debug surface on the real app/runtime path.

Current benchmark scope:

- selected single rectangle
- two overlapping `dashed + center` strokes
- overlap graph debug overlay
- ownership debug overlay
- component-local bailout debug overlay

## Reference Evidence Notes

- when formal overlap diagnostics debug mode is enabled, the selected element must show a visible
  overlap-component overlay
- when ownership mode is enabled, the selected element must show visible
  ownership regions derived from the same real packet diagnostics
- when bailout mode is enabled, the selected element must show visible
  preserved-preview polygons for the bailed component
- the overlay must come from the runtime-selected element diagnostics, not from
  a mocked stroke pipeline
- when the debug flag is disabled, the overlay must disappear

## Probe Strategy

- create a rectangle and add a second stroke
- configure both strokes as overlapping dashed-center strokes
- switch debug mode between `overlap`, `ownership`, and `bailout`
- capture the selected element raster
- measure debug-overlay color coverage inside the raster

## Pass Thresholds

- enabled overlay coverage must be `> 0.04`
- ownership overlay coverage must be `> 0.005`
- bailout overlay coverage must be `> 0.01`
- disabled overlay coverage must be `< 0.02`
