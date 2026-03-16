# Implementation Plan - ColorPicker and GradientStops UI Refinement

Fine-tune ColorPicker styles and fix UI inconsistencies by creating a reusable `FillColorRow` component for use in both the main Properties panel and the Gradient Editor.

## Proposed Changes

### 1. New Component: `FillColorRow`
- **Path**: `apps/asyra-design/src/properties/fills/fill-color-row.tsx`
- **Purpose**: Encapsulate the Swatch (ColorPicker), Hex/Summary text, and Opacity input into a single `PropertyControl` container.
- **Design**:
  - Container: `PropertyControl` (provides consistent border and background).
  - Left: `FillColorControls` (handles Swatch + Hex/Summary).
  - Middle: Divider line.
  - Right: Opacity `Input` (percentage).

### 2. Refactor `FillItem`
- **Path**: `apps/asyra-design/src/properties/fills/fill.tsx`
- **Changes**:
  - Replace the inline `PropertyControl` and `FillColorControls` with the new `FillColorRow`.

### 3. Refactor `GradientStopsList`
- **Path**: `apps/asyra-design/src/properties/fills/gradient-stops-list.tsx`
- **Changes**:
  - Update row grid to `grid-cols-[60px_1fr_28px]`.
  - Column 1: Position input.
  - Column 2: `FillColorRow`.
  - Column 3: Remove button.
  - Remove redundant `div` and `bg-panel-surface` wrappers for inputs.

## Verification Plan

### Automated Tests
- Run `yarn test:local` in `apps/asyra-design` to ensure no regressions in property panel interactions.
- Specifically check `fill` and `gradient` related tests.

### Manual Verification
- Open Properties panel.
- Add a gradient fill.
- Click the fill preview to open the Gradient Editor.
- Verify each stop row:
  - Position (%) is correctly displayed and editable.
  - Fill color row (Swatch + Hex + Opacity) is within a single rounded container.
  - Swatch opens the ColorPicker.
  - Hex is editable.
  - Opacity is correctly displayed and editable.
  - Hovering over the row or inputs shows consistent styling.
  - Remove button works and is disabled when only 2 stops remain.
