# Implementation Plan - ColorPicker Generalization

Decouple `ColorPicker` from hardcoded color format definitions and move configuration to the application level.

## Proposed Changes

### 1. Design System Enhancements
- **Path**: `packages/design-system/src/components/ColorPicker/ColorPicker.tsx`
  - Refactor `ColorPickerProps` to include `formatDefinitions` and `showAlpha`.
  - Rewrite state management to use a single `draftValues: string[]` array.
  - Update `handleInputChange` and `handleInputBlur` to delegate to active `formatDefinitions`.
  - Export `ColorFormatDefinition` interface.
- **Path**: `packages/design-system/src/components/ColorPicker/color-utils.ts`
  - Add `hsvaToHwb`, `hwbToHsva` conversions.
  - Add `hsvaToOklch`, `oklchToHsva` conversions.
  - Ensure all necessary types (`HSVAColor`, etc.) are exported.

### 2. Application-Level Configuration
- **Path**: `apps/asyra-design/src/properties/fills/color-picker-config.ts`
  - Define `COLOR_PICKER_FORMAT_DEFINITIONS` containing:
    - HEX, RGB, HSL, HSB, HWB, OKLCH, and CSS formats.
    - Path-specific `toValues` and `fromValues` logic.
    - Input formatting rules.

### 3. Property Panel Integration
- **Path**: `apps/asyra-design/src/properties/fills/fill-color-controls.tsx`
  - Pass `COLOR_PICKER_FORMAT_DEFINITIONS` to `ColorPicker`.
  - Enable `showAlpha`.

## Verification Plan

### Automated Tests
- Run `yarn react:build` to ensure cross-package type safety and builds.
- Run `yarn test:e2e` for selection and gradient-fill-handles to verify picker interaction remains stable.

### Manual Verification
- Open Color Picker in Asyra Design.
- Switch between all formats (HEX, RGB, HSL, HSB, HWB, OKLCH, CSS).
- Verify typing values in each format updates the palette correctly.
- Verify alpha slider works and is reflected in the opacity input.
- Verify EyeDropper successfully picks colors.
