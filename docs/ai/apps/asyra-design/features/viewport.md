# Feature: Viewport Navigation

## Sources

- `src/features/zoom/index.ts`
- `src/features/pan/index.ts`
- `src/features/zoom-fit/index.ts`
- `src/common-apis/viewport.ts`

## Zoom

- trigger: `input.wheel.scroll`
- priority: `5`
- exclusive: `true`
- active only when `meta` or `ctrl` is pressed
- updates `zoom` and `viewportPosition` via `viewportApis.zoomToCenter`

## Pan

- trigger: `input.wheel.scroll`
- priority: `4`
- exclusive: `false`
- active only when `meta` and `ctrl` are not pressed
- updates `viewportPosition` via wheel delta

## Zoom Fit

- trigger: `input.shortcut.zoomPreset`
- priority: `10`
- exclusive: `true`
- computes fit against `viewport-anchor` bounds and all element bounds

## State Contract

- viewport behavior is system-property-driven (`zoom`, `viewportPosition`)
- render/UI should consume resulting state updates
