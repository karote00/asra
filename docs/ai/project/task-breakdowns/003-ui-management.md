# Task Breakdown: UI & Property Management

**Status**: [Completed]

## 1. UI Context (View Model)
- [x] Create `@asra/ui-context`
- [x] Implement RxJS `BehaviorSubject`s for properties (x, y, width, etc.)
- [x] Implement "Mixed" value calculation for multi-selection

## 2. UI Application Shell
- [x] Create `apps/ui` (React + Vite + Tailwind)
- [x] Setup CSS Grid layout (Toolbar, Sidebar, Canvas, Right Panel)
- [x] Create `@asra/design-system` for shared components (`Button`, `Input`)

## 3. Properties Panel
- [x] Create `PropertiesPanel` component
- [x] Bind Input fields to `ui-context` Subjects (Read)
- [x] Bind Input `onChange` to `core.updateComputedData` (Write)

## 4. Tool Switching
- [x] Create `Toolbar` component
- [x] Implement tool switching logic (Select <-> Rectangle)
- [x] Bind keyboard shortcuts (R, V) via `input-system`
