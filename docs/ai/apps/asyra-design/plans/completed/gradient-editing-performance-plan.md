# Plan: Gradient Editing Drag Performance Remediation

## Goal

Make gradient handle and stop dragging responsive on both canvas and the properties panel without changing behavior or undo semantics.

## Context

Gradient edits currently update fill data on every pointer move, which can trigger expensive computed-data reads, render updates, and UI re-renders. Canvas handle/stop hit testing also recomputes geometry frequently, and the overlay render layer re-parses stop colors every frame. The result is visible lag while dragging.

## Scope

In scope:
- throttle drag-time writes to once per animation frame
- reduce repeated geometry computation during drag
- avoid redundant system property writes for hover/selection
- cache stop color parsing in overlay rendering
- maintain one undo commit per drag session

Out of scope:
- changing gradient UX behavior
- redesigning fill rendering or gradient data contracts
- switching render engines or scene-tree storage format

## Known Performance Hotspots (Baseline)

1. Drag-time fill updates on every pointer move  
`/Users/asa/Desktop/workspace/asra/apps/asyra-design/src/features/gradient-fill-handles/index.ts`

2. Repeated computed-data reads for fill + size during drag/hit testing  
`/Users/asa/Desktop/workspace/asra/apps/asyra-design/src/common-apis/fills.ts`

3. Unthrottled properties-panel stop dragging writes  
`/Users/asa/Desktop/workspace/asra/apps/asyra-design/src/properties/fills/use-gradient-interactions.ts`

4. Overlay render layer re-parsing stop colors every frame  
`/Users/asa/Desktop/workspace/asra/apps/asyra-design/src/render-layers/gradient-fill-handles-render-layer.ts`

5. Gradient fill rendering recomputed for each drag tick  
`/Users/asa/Desktop/workspace/asra/packages/preset/src/components/fills.ts`

## Target Behavior

1. Canvas handle/stop dragging stays visually responsive (~60 FPS).
2. Properties panel stop dragging stays responsive without input lag.
3. Drag sessions keep one intended undo commit on release.
4. Hover/selection and overlay visuals remain accurate.

## Completion (2026-03-17)

- outcome: drag updates are throttled to animation frames with cached geometry to reduce per-move overhead
- outcome: properties-panel stop dragging uses rAF throttling for responsive updates
- outcome: overlay rendering caches stop color parsing and avoids redundant hover/selection writes

## Implementation Slices

1. Canvas drag throttling + cached geometry
- throttle drag updates with `requestAnimationFrame`
- reuse cached gradient geometry + element dimensions during drag
- add movement thresholds for gradient handle/stop drags

2. Properties panel drag throttling
- throttle stop strip drag updates to animation frames
- avoid repeated layout queries during active drag

3. Render overlay micro-optimizations
- cache stop color parsing for overlay render
- avoid redundant hover/selection system property updates

## Success Criteria

- Dragging gradient handles/stops on canvas feels smooth with no visible lag.
- Dragging stop positions in the properties panel is responsive.
- Undo/redo behavior remains unchanged (single commit per drag).

## Risks

1. Over-throttling could make drag feedback feel less immediate.
2. Cached geometry might drift if element transforms change mid-drag.
3. Render layer caching must stay consistent with stop color edits.
