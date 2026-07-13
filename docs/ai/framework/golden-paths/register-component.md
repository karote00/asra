# Golden Path: Register a Component

## Preconditions

- Component data shape is defined in framework/shared types.
- Ownership is clear: scene-tree entity data vs props-manager property components.

## Steps

1. Define component contract
- component type name
- id/name prefix strategy
- computed/default data shape
- required property definitions

2. Register component through core path
- register component definition
- register property definitions used by this component

3. Register schema validation
- add property schemas for each property component type used
- ensure runtime set/update and load behavior follow valid/reject/fallback rules

4. Register render strategy/layer usage
- map component type to render strategy via render registration path
- keep engine details inside render package

5. Integrate feature and selection behavior
- ensure selection and property editing APIs can resolve this component correctly

## Verification Checklist

- Create component -> appears in scene-tree and render output.
- Select component -> property/UI aggregates resolve expected values.
- Mutate properties -> updates are reflected in state and render.
- Save/load -> data round-trip preserves component shape.

## Common Failure Cases

- Component registered in scene-tree but missing render strategy.
- Property definitions exist but schema validation missing.
- App logic mutates component data directly instead of API path.
