# Rule: UI Data Flow

## Read Path

- UI should read from providers/hooks that subscribe to derived state.
- Avoid reading mutable runtime internals directly in components.

## Write Path

- UI writes should go through controllers/common APIs.
- Numeric/typed fields should parse and validate before write.

## Property Panel Rule

- When element is selected: show element layout properties.
- When vector point is selected in path-editing context: show point properties.

## Contents Panel Rule

- Contents list should read flattened ids + selection state from providers.
- Row click writes selection through controller/common API boundary.
- Empty-area click in contents panel should clear selection explicitly.

## Toolbar Rule

- Toolbar tool buttons should read active tool from provider state.
- Tool switching should route through app controller/feature API, not direct local state mutation.
- Zoom display should read derived zoom property (`zoom`) from provider state.

## Canvas/Render Rule

- Render canvas is initialized through app startup path (`core.start(...)`), not ad-hoc UI effects.
- Pointer/keyboard interactions should flow through input mappings -> features -> APIs -> state.
- UI components should not treat render objects as source-of-truth for app state.

## Startup Event Rule

- App startup side effects should remain in init/context modules.
- Render-ready/load-complete bridging logic should live in `data-change` context layer, not scattered in UI components.

## Aggregation Rule

- Aggregate values (`x/y/width/height/rotation`) are app-registered UI properties.
- Mixed-selection behavior should be handled through registered aggregate policies.
