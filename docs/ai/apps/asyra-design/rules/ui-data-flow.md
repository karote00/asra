# Rule: UI Data Flow

## Read Path

- UI should read from providers/hooks that subscribe to derived state.
- Avoid reading mutable runtime internals directly in components.

## Write Path

- UI writes should go through controllers/common APIs.
- Numeric/typed fields should parse and validate before write.

## Property Panel Rule

- When element is selected: show element layout + fills properties.
- When element is selected: show element layout + fills + strokes properties.
- When vector point is selected in path-editing context: show point properties.
- Fill and stroke add/remove replace the complete canonical field once through
  plural `core.updateElementProperties(...)`.
- Fill and stroke field edits replace the affected typed record once through
  plural `core.patchElementProperties(...)`; callers do not run per-child
  update/commit loops or write computed data as canonical source.
- Transaction ownership for fill edits belongs to feature/UI behavior:
  - discrete field commits open/close one transaction in the properties UI
  - color-picker drag sessions open/close one transaction in the picker interaction handlers
- Transaction ownership for stroke edits mirrors fills:
  - discrete field commits open/close one transaction in the properties UI
  - color-picker drag sessions open/close one transaction in the picker interaction handlers
- Owner element `fills` recompute should happen from the committed props transaction bridge, not from manual UI refresh calls.
- Owner element `strokes` recompute should happen from the committed props transaction bridge, not from manual UI refresh calls.
- Fills selection aggregation belongs to ui-context `compute` for the `fills` property.
- Strokes selection aggregation belongs to ui-context `compute` for the `strokes` property.
- `useFills()` / `useFill()` should be selectors over ui-context `fills`, not hooks with local selection/transaction subscriptions.
- `useStrokes()` / `useStroke()` should be selectors over ui-context `strokes`, not hooks with local selection/transaction subscriptions.
- Custom color-picker preview open/close must stay UI-local and must not start model transactions.
- Custom color-picker palette/slider drags own their transaction boundary: pointer-down starts one outer transaction, live frame updates write with `undoable: false` and `sharedDelivery: 'immediate'`, finalize replays one undoable value write, then pointer-up ends the transaction.

## Contents Panel Rule

- Contents list should read flattened ids + selection state from providers.
- An ADD_ELEMENT projected with `sharedDelivery: 'immediate'` must flush the existing flattened-id and element-map derivations immediately so create-tool pointer sessions show the new row before pointer-up; transaction-end delivery remains batched.
- Row click writes selection through controller/common API boundary.
- Empty-area click in contents panel should clear selection explicitly.
- Row action toggles (`lock`, `visible`) write through controller/common APIs and must not trigger row selection.

## Toolbar Rule

- Toolbar tool buttons should read active tool from provider state.
- Tool switching should route through app controller/feature API, not direct local state mutation.
- Zoom display should read derived zoom property (`zoom`) from provider state.

## Canvas/Render Rule

- Render canvas is initialized through app startup path (`core.start(...)`), not ad-hoc UI effects.
- Pointer/keyboard interactions should flow through input mappings -> features -> APIs -> state.
- Create resize, element move, vector-point/handle drag, and gradient-handle/stop drag frames that must project before pointer-up explicitly use `sharedDelivery: 'immediate'`; `undoable: false` alone never selects immediate delivery.
- UI components should not treat render objects as source-of-truth for app state.

## Startup Event Rule

- App startup side effects should remain in init/context modules.
- Render-ready/load-complete bridging logic should live in `data-change` context layer, not scattered in UI components.

## Aggregation Rule

- Aggregate values (`x/y/width/height/rotation`) are app-registered UI properties.
- `fills` is a custom computed UI property, not a provider-local adapter.
- `strokes` is a custom computed UI property, not a provider-local adapter.
- Current `fills` contract returns `FillRowAttrs[]` for single selection and `MIX` for non-single selection.
- Current `strokes` contract returns `StrokeRowAttrs[]` for single selection and `MIX` for non-single selection.
- Each fill row must carry underlying `ids` so follow-up multi-selection fanout can target the owning fill properties deterministically.
- Each stroke row must carry underlying `ids` so follow-up multi-selection fanout can target the owning stroke properties deterministically.
