import { componentRegistry } from '@asyra/scene-tree'
import { propertyRegistry, PropertyDefinition } from '@asyra/props-manager'
import { renderRegistry, RenderStrategy } from '@asyra/render'
import { createDynamicComponent } from '@asyra/scene-tree'

export interface ComponentDefinition {
    /**
     * Unique type identifier for the component (e.g., 'star', 'polygon')
     */
    type: string

    /**
     * Prefix for ID generation (e.g., 'star' -> 'star-1', 'star-2')
     */
    idPrefix: string

    /**
     * Prefix for name generation (e.g., 'Star' -> 'Star 1', 'Star 2')
     */
    namePrefix: string

    /**
     * Properties that this component should have
     */
    properties: PropertyDefinition[]

    /**
     * Optional render strategy for this component type
     * If not provided, will use default rectangle rendering
     */
    renderStrategy?: RenderStrategy
}

/**
 * Define a custom component type that can be used in the scene tree
 * 
 * @example
 * ```ts
 * defineComponent({
 *   type: 'star',
 *   idPrefix: 'star',
 *   namePrefix: 'Star',
 *   properties: [
 *     { name: 'count', type: PropertyTypes.CUSTOM, defaultValue: 5 },
 *     { name: 'x', type: PropertyTypes.NUMBER, defaultValue: 0 },
 *     { name: 'y', type: PropertyTypes.NUMBER, defaultValue: 0 },
 *     { name: 'width', type: PropertyTypes.NUMBER, defaultValue: 100 },
 *     { name: 'height', type: PropertyTypes.NUMBER, defaultValue: 100 }
 *   ],
 *   renderStrategy: (graphic, data) => {
 *     // Custom star rendering logic
 *     const count = data.count || 5
 *     // ... draw star with 'count' points
 *   }
 * })
 * ```
 */
export function defineComponent(definition: ComponentDefinition): void {
    const { type, idPrefix, namePrefix, properties, renderStrategy } = definition

    // 1. Register properties with PropertyRegistry
    for (const prop of properties) {
        propertyRegistry.register(prop, type)
    }

    // 2. Build defaults object from properties
    const defaults: Record<string, any> = {}
    for (const prop of properties) {
        if (prop.defaultValue !== undefined) {
            defaults[prop.name] = prop.defaultValue
        }
    }

    // 3. Create dynamic component class
    const ComponentClass = createDynamicComponent(type, idPrefix, namePrefix, properties, defaults)

    // 4. Register component with ComponentRegistry
    componentRegistry.register({
        type,
        idPrefix,
        namePrefix,
        constructor: ComponentClass,
        properties,
        defaults
    })

    // 5. Register render strategy if provided
    if (renderStrategy) {
        renderRegistry.register(type, renderStrategy)
    }
}

/**
 * Unregister a custom component type
 * This will remove the component from all registries
 * 
 * @param type - The component type to unregister
 * @returns true if component was unregistered, false if it didn't exist
 */
export function unregisterComponent(type: string): boolean {
    // Unregister from all registries
    const componentUnregistered = componentRegistry.unregister(type)
    propertyRegistry.unregisterComponent(type) // void return
    const renderUnregistered = renderRegistry.unregister(type)

    return componentUnregistered || renderUnregistered
}
