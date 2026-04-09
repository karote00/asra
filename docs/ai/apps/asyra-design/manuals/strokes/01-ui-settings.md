# 01 — UI Settings

This chapter lists every stroke-related setting that a user can modify through the properties panel.

## Stroke Section Overview

When an element is selected, the **Stroke** section appears in the right-side properties panel. The section header includes an **Add (+)** button to add new strokes. Each stroke entry expands into three rows of controls.

## Settings Reference

### 1. Add / Remove Stroke

| Action | UI Element | Behavior |
|--------|-----------|----------|
| **Add stroke** | `+` button in section header | Appends a new stroke with default values to the element's stroke list |
| **Remove stroke** | `−` button on each stroke row | Removes the stroke at the specified index from the list |

- **Source**: `index.tsx` → `handleAddStroke` / `handleRemoveStroke`
- The add operation calls `createDefaultStroke()` to generate a new stroke object, then writes the updated stroke ID list via `changeElementComputedData('strokes', nextStrokes)`.
- The remove operation filters out the target index and writes the remaining stroke IDs.

---

### 2. Color

| Property | Key | Type | Default | UI Element |
|----------|-----|------|---------|------------|
| Color value | `color` | `string` (hex) | `'#000000'` | Text input + ColorPicker swatch |
| Color format | `colorFormat` | `FillColorFormat` | `'hex'` | Format selector inside ColorPicker |
| Default color format | `defaultColorFormat` | `FillColorFormat` | `'hex'` | Internal (not directly user-editable) |

**UI Components**: `stroke-color-row.tsx` → `stroke-color-controls.tsx`

The color input accepts hex values. The ColorPicker provides a visual color selection with format switching (HEX, RGB, HSL, HSB).

**Color Picker Transaction Model**:
- **Discrete change** (typing a hex value): wraps in a single transaction (`startTransaction` → write → `endTransaction`).
- **Drag change** (dragging inside the picker): on drag start, opens a long-running transaction. Each drag move writes `{ undoable: false }`. On drag end, the transaction replays the net change as a single undoable operation.

---

### 3. Opacity

| Property | Key | Type | Default | Range | UI Element |
|----------|-----|------|---------|-------|------------|
| Opacity | `opacity` | `number` | `1` (100%) | 0–1 (displayed as 0–100%) | Percentage input with `%` suffix |

- User enters a value 0–100. Internally stored as 0–1 (`parsed / 100`).
- Clamped: `Math.max(0, Math.min(100, parsed)) / 100`.

---

### 4. Visibility

| Property | Key | Type | Default | UI Element |
|----------|-----|------|---------|------------|
| Visible | `visible` | `boolean` | `true` | Eye icon toggle button |

- Toggles between `EyeOpenIcon` and `EyeClosedIcon`.
- When `visible` is `false`, the stroke is skipped during rendering (`getRenderableStroke` returns `null`).

---

### 5. Position (Placement)

| Property | Key | Type | Default | Options | UI Element |
|----------|-----|------|---------|---------|------------|
| Position | `position` | `StrokePosition` | `'center'` | Center, Inside, Outside | `<select>` dropdown |

**Values**:
- `'center'` — Stroke is centered on the path.
- `'inside'` — Stroke extends inward from the path boundary. Only meaningful for **closed** shapes.
- `'outside'` — Stroke extends outward from the path boundary. Only meaningful for **closed** shapes.

> **Important**: For open paths (e.g., unclosed vectors), position is always treated as `'center'` regardless of the UI value.

---

### 6. Join Type

| Property | Key | Type | Default | Options | UI Element |
|----------|-----|------|---------|---------|------------|
| Join Type | `joinType` | `StrokeJoinType` | `'miter'` | Miter, Bevel, Round | `<select>` dropdown |

**Values**:
- `'miter'` — Sharp corners. The sharpness is limited by the **Miter Angle**.
- `'bevel'` — Flat-cut corners.
- `'round'` — Rounded corners.

---

### 7. Miter Angle

| Property | Key | Type | Default | Range | UI Element |
|----------|-----|------|---------|-------|------------|
| Miter Angle | `miterAngle` | `number` | `28.96` | 0–180° | Numeric input with `°` suffix |

- Controls how far a miter join extends before being clipped.
- Internally converted to a **miter limit** via: `1 / sin(angle_in_radians / 2)`.
- A smaller angle → larger miter limit → sharper allowed corners.
- Clamped: `Math.max(0, Math.min(180, parsed))`.

---

### 8. Width

| Property | Key | Type | Default | Range | UI Element |
|----------|-----|------|---------|-------|------------|
| Width | `width` | `number` | `1` | ≥ 0 | Numeric input (no suffix) |

- Determines the stroke thickness in pixels.
- A width of `0` makes the stroke invisible (`getRenderableStroke` returns `null`).
- Clamped: `Math.max(0, parsed)`.

---

### 9. Style

| Property | Key | Type | Default | Options | UI Element |
|----------|-----|------|---------|---------|------------|
| Style | `style` | `StrokeStyle` | `'solid'` | Solid, Dashed | `<select>` dropdown |

- `'solid'` — A continuous stroke.
- `'dashed'` — A stroke broken into dash segments separated by gaps. When set to `'dashed'`, two additional inputs appear: **Dash** and **Gap**.

---

### 10. Dash (Dashed Style Only)

| Property | Key | Type | Default | Range | UI Element |
|----------|-----|------|---------|-------|------------|
| Dash | `dash` | `number` | `20` | ≥ 0 | Numeric input (visible only when style is `'dashed'`) |

- Length of each visible dash segment.
- Clamped: `Math.max(0, parsed)`.
- Internally constrained to a minimum of `0.1` (`MIN_DASH_LENGTH`).

---

### 11. Gap (Dashed Style Only)

| Property | Key | Type | Default | Range | UI Element |
|----------|-----|------|---------|-------|------------|
| Gap | `gap` | `number` | `20` | ≥ 0 | Numeric input (visible only when style is `'dashed'`) |

- Length of each invisible gap between dashes.
- Clamped: `Math.max(0, parsed)`.
- Internally constrained to a minimum of `0.1` (`MIN_DASH_LENGTH`).

---

## Layout Summary

The three rows of controls for each stroke are laid out as follows:

```
Row 1: [ColorPicker | Color Input | Opacity%]  [Eye Toggle]  [Remove −]
Row 2: [Position ▾]  [Join Type ▾]  [Miter Angle °]
Row 3: [Width]  [Style ▾]  [Dash]*  [Gap]*

* Dash and Gap only appear when Style = "Dashed"
```
