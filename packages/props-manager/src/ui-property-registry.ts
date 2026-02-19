interface PropertyDefinition {
  name: string
  type: string
  alias?: string[]
  defaultValue?: unknown
}

interface RegisteredProperty {
  definition: PropertyDefinition
  componentTypes: Set<string>
}

class UIPropertyRegistry {
  private registry = new Map<string, RegisteredProperty>()

  /**
   * Register a property type
   * @param definition - Property definition
   * @param componentType - Component type that uses this property
   */
  register(definition: PropertyDefinition, componentType: string): void {
    const existing = this.registry.get(definition.name)

    if (existing) {
      // Add component type to existing property
      existing.componentTypes.add(componentType)
    } else {
      // Create new property registration
      this.registry.set(definition.name, {
        definition,
        componentTypes: new Set([componentType])
      })
    }
  }

  /**
   * Get property definition by name
   */
  get(name: string): PropertyDefinition | undefined {
    return this.registry.get(name)?.definition
  }

  /**
   * Get all properties for a component type
   */
  getPropertiesForComponent(componentType: string): PropertyDefinition[] {
    const properties: PropertyDefinition[] = []

    for (const [, registered] of this.registry) {
      if (registered.componentTypes.has(componentType)) {
        properties.push(registered.definition)
      }
    }

    return properties
  }

  /**
   * Check if property exists
   */
  has(name: string): boolean {
    return this.registry.has(name)
  }

  /**
   * Unregister all properties for a component type
   */
  unregisterComponent(componentType: string): void {
    for (const [name, registered] of this.registry) {
      registered.componentTypes.delete(componentType)

      // Remove property if no components use it
      if (registered.componentTypes.size === 0) {
        this.registry.delete(name)
      }
    }
  }
}

export const uiPropertyRegistry = new UIPropertyRegistry()
export default uiPropertyRegistry
export type { PropertyDefinition }
