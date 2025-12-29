# API Reference: @asra/props-manager

The `@asra/props-manager` package handles the properties of components/elements, supporting loading, saving, and granular updates.

## Lifecycle

### `load()`
-   **Description**: Hydrates the properties manager from serialized data.
-   **Signature**: `load(data: PropsComponentRawData): void`

### `save()`
-   **Description**: Serializes the current properties state.
-   **Signature**: `save(): PropsComponentRawData`

## Property Management

### `createProperty()`
-   **Description**: Creates a new property instance.
-   **Signature**: `createProperty(propData: Partial<PropertyComponentRawData>): PropertyComponentInstanceTypes`

### `addProperty()`
-   **Description**: Registers multiple property component instances.
-   **Signature**: `addProperty(propComponents: PropertyComponentInstanceTypes[]): Record<PropertyTypes, string>`

### `removeProperty()`
-   **Description**: Removes property components by ID.
-   **Signature**: `removeProperty(propComponentIds: string[]): void`

### `updatePropsData()`
-   **Description**: Updates a specific key-value pair of a property component.
-   **Signature**: `updatePropsData(componentId: string, key: string, data: any): void`
