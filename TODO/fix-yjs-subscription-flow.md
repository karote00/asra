# TODO: Fix YJS Subscription Flow for Element Creation

## Problem

The feature system doesn't properly handle YJS subscriptions. When `createElement` feature creates a rectangle:

1. ✅ Feature calls `sceneTree.addNewElement()`
2. ✅ Scene tree adds element and commits transaction
3. ❌ Changes should flow to `factory.sceneTreeMap` (YJS array)
4. ❌ Render should observe YJS array and create graphics
5. ❌ Rectangle should appear on canvas

## Definition of Done

### ✅ YJS Subscription Flow

#### Phase 1: Verify Scene Tree → Factory Flow

- [ ] When feature calls `sceneTree.addNewElement()`, it:
  - [ ] Adds element to internal state
  - [ ] Calls `commitSceneTreeTransaction()`
  - [ ] Changes are pushed to `factory.sceneTreeMap` (YJS array)
- [ ] Verify `factory.sceneTreeMap` has the new element change

#### Phase 2: Verify Render → Factory Observation

- [ ] Render subscribes to `factory.sceneTreeMap.observe(handleSceneTreeChange)`
- [ ] `handleSceneTreeChange` processes ADD_ELEMENT actions
- [ ] `renderSceneTree.addElementById()` is called
- [ ] `render.addElement()` creates new graphics
- [ ] Graphics are added to `viewportLayer`

#### Phase 3: Verify Element Appears on Canvas

- [ ] Rectangle graphic created with correct properties (x, y, width, height, color)
- [ ] Graphic added to render layer
- [ ] Graphic is visible in DOM/canvas
- [ ] Selection box appears around new rectangle

### ✅ Testing

- [ ] Unit test: `sceneTree.addNewElement()` → YJS array has change
- [ ] Integration test: YJS array observe → render.addElement() called
- [ ] Visual test: Mouse drag creates visible rectangle on canvas
- [ ] Edge cases: Multiple rectangles, undo/redo

## Implementation Plan

### Phase 1: Debug Scene Tree → Factory Flow

1. Add logging to `sceneTree.addNewElement()`
2. Add logging to `sceneTree.addChangeForAddElement()`
3. Add logging to `commitSceneTreeTransaction()`
4. Add logging to `factory.updateTransaction()`
5. Check if `factory.sceneTreeMap` receives changes

**Expected**: When element created, `factory.sceneTreeMap` should have new entry with:

```typescript
{
  eventName: 'addElement',
  data: { type: 'rectangle', x: ..., y: ..., width: 0, height: 0, ... },
  action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
  owner: OWNER.SCENE_TREE,
  ...
}
```

### Phase 2: Debug Render → Factory Observation

1. Verify `render/src/subscribes/scene-tree.ts` calls `initSceneTreeDataContext()`
2. Check if `factory.sceneTreeMap.observe(handleSceneTreeChange)` is called
3. Add logging to `handleSceneTreeChange()`
4. Add logging to `updateRenderSceneTree()`
5. Add logging to `renderSceneTree.addElementById()`
6. Add logging to `render.addElement()`

**Expected**: When YJS array changes:

- `handleSceneTreeChange()` triggered
- `updateRenderSceneTree()` called with ADD_ELEMENT action
- `renderSceneTree.addElementById(data.id)` called
- `render.addElement(data)` creates new Graphics
- Graphic added to viewport

### Phase 3: Debug Render Layer

1. Check if `render.viewport.view` has children
2. Check if workspace container exists
3. Check if graphics are added to workspace
4. Check if Canvas is rendering the graphics

**Expected**:

```
viewportLayer.view (Container)
  └── renderLayer.view (Container) aka workspace
      └── Graphics (rectangle with label = elementId)
```

## Hypotheses

### Hypothesis 1: Render Not Initialized

- **Problem**: `render.init()` not called before feature attempts to create element
- **Test**: Check if `render.app` is not null

### Hypothesis 2: YJS Observer Not Attached

- **Problem**: `initSceneTreeDataContext()` not called, or called after elements created
- **Test**: Check if `factory.sceneTreeMap._observers.length > 0`

### Hypothesis 3: Scene Tree Changes Not Committed

- **Problem**: `commitSceneTreeTransaction()` not pushing changes to YJS
- **Test**: Check `factory.sceneTreeMap.toJSON()` for changes

### Hypothesis 4: Render Store Not Processing Changes

- **Problem**: `renderSceneTree` store not calling `render.addElement()`
- **Test**: Add logging to verify call chain

## Debugging Checklist

- [ ] Check `factory.sceneTreeMap.toJSON()` - are there changes?
- [ ] Check `factory.sceneTreeMap._observers.length` - is render observing?
- [ ] Check `render.app` - is render initialized?
- [ ] Check `render.viewport.view.children.length` - are there graphics?
- [ ] Check console logs for YJS observe events

## Status

- Phase 1: 🏗️ Not Started
- Phase 2: 🏗️ Not Started
- Phase 3: 🏗️ Not Started
