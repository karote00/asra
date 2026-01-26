# Task Breakdown: Initial System Architecture

**Status**: [Completed]

## 1. Setup Monorepo Structure
- [x] Initialize Yarn Workspaces
- [x] Configure TypeScript (root `tsconfig.json` & package inheritance)
- [x] Create package directories (`core`, `utils`, `reactive-events`)

## 2. Core Event System
- [x] Implement `@asyra/reactive-events` (RxJS based)
- [x] Define standard Event Interfaces (Type, Payload)
- [x] Create `EventBus` singleton

## 3. Data Model (Scene Tree)
- [x] Implement `@asyra/scene-tree`
- [x] Define `Element` and `Workspace` classes
- [x] Integrate YJS for data persistence (`Y.Map`, `Y.Array`)

## 4. Input Handling
- [x] Implement `@asyra/input-system`
- [x] normalize Mouse/Keyboard events
- [x] Create KeyMap and Combination matchers

## 5. Rendering Engine
- [x] Implement `@asyra/render` using PixiJS
- [x] Create Viewport Layer (Pan/Zoom container)
- [x] Create Selection Layer (Selection box graphics)
