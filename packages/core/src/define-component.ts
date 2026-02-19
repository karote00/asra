import { componentRegistry } from '@asyra/scene-tree'
import {
  uiPropertyRegistry,
  type PropertyDefinition
} from '@asyra/props-manager'
import { renderRegistry, RenderStrategy } from '@asyra/render'
import { createDynamicComponent } from '@asyra/scene-tree'
import { nameCounter, idCounter } from '@asyra/utils'

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

  /**
   * Whether this component acts as a container (can have children)
   */
  isContainer?: boolean
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
  const {
    type,
    idPrefix,
    namePrefix,
    properties,
    renderStrategy,
    isContainer
  } = definition

  // 0. Register type with nameCounter for auto-numbering
  // This allows app-level components to register without modifying framework NameTypes
  nameCounter.registerType(type, namePrefix, undefined, { override: true })

  // 1. Register type with idCounter for auto-numbering
  // This allows app-level components to register without modifying framework IDTypes
  idCounter.registerType(type, idPrefix, undefined, { override: true })

  // 2. Register properties with UIPropertyRegistry
  for (const prop of properties) {
    uiPropertyRegistry.register(prop, type)
  }

  // 2. Build defaults object from properties
  const defaults: Record<string, unknown> = {}
  for (const prop of properties) {
    if (prop.defaultValue !== undefined) {
      defaults[prop.name] = prop.defaultValue
    }
  }

  // 3. Create dynamic component class
  const ComponentClass = createDynamicComponent(
    type,
    idPrefix,
    namePrefix,
    properties,
    defaults,
    isContainer
  )

  // 4. Register component with ComponentRegistry
  componentRegistry.register({
    type,
    idPrefix,
    namePrefix,
    constructor: ComponentClass,
    properties,
    defaults,
    isContainer
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
  uiPropertyRegistry.unregisterComponent(type) // void return
  const renderUnregistered = renderRegistry.unregister(type)

  return componentUnregistered || renderUnregistered
}
