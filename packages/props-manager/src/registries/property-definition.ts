import type { PropertySchema } from '@asyra/utils'

interface PropertyDefinition {
  name: string
  type: string
  alias?: string[]
  defaultValue?: unknown
  schema?: PropertySchema
}

interface RegisteredProperty {
  definition: PropertyDefinition
  componentTypes: Set<string>
}

class ElementPropertyRegistry {
  private registry = new Map<string, RegisteredProperty>()
  private definitionsByComponent = new Map<
    string,
    Map<string, PropertyDefinition>
  >()

  /**
   * Register a property type
   * @param definition - Property definition
   * @param componentType - Component type that uses this property
   */
  register(definition: PropertyDefinition, componentType: string): void {
    let componentDefinitions = this.definitionsByComponent.get(componentType)
    if (!componentDefinitions) {
      componentDefinitions = new Map<string, PropertyDefinition>()
      this.definitionsByComponent.set(componentType, componentDefinitions)
    }
    componentDefinitions.set(definition.name, definition)

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
   * Get the exact definition declared by one component.
   */
  getForComponent(
    componentType: string,
    name: string
  ): PropertyDefinition | undefined {
    return this.definitionsByComponent.get(componentType)?.get(name)
  }

  /**
   * Get all properties for a component type
   */
  getPropertiesForComponent(componentType: string): PropertyDefinition[] {
    return Array.from(
      this.definitionsByComponent.get(componentType)?.values() ?? []
    )
  }

  /**
   * Check if property exists
   */
  has(name: string): boolean {
    return this.registry.has(name)
  }

  /**
   * Get component types that currently own a property definition.
   */
  getComponentTypesForProperty(name: string): string[] {
    const registered = this.registry.get(name)
    if (!registered) {
      return []
    }

    return Array.from(registered.componentTypes).sort()
  }

  /**
   * Replace one component's complete declarative property set.
   * Callers prebuild the owning component class before invoking this method.
   */
  replaceComponentProperties(
    componentType: string,
    definitions: readonly PropertyDefinition[]
  ): void {
    const names = new Set<string>()
    for (const definition of definitions) {
      if (names.has(definition.name)) {
        throw new Error(
          `Property "${definition.name}" is duplicated in component "${componentType}"`
        )
      }
      names.add(definition.name)
    }

    this.unregisterComponent(componentType)
    definitions.forEach((definition) =>
      this.register(definition, componentType)
    )
  }

  unregisterRelation(componentType: string, name: string): boolean {
    const componentDefinitions = this.definitionsByComponent.get(componentType)
    if (!componentDefinitions?.delete(name)) {
      return false
    }
    if (componentDefinitions.size === 0) {
      this.definitionsByComponent.delete(componentType)
    }

    this.removeReverseOwner(name, componentType)
    return true
  }

  /**
   * Unregister all properties for a component type
   */
  unregisterComponent(componentType: string): void {
    const definitions = this.definitionsByComponent.get(componentType)
    if (!definitions) {
      return
    }

    for (const name of definitions.keys()) {
      this.removeReverseOwner(name, componentType)
    }
    this.definitionsByComponent.delete(componentType)
  }

  private removeReverseOwner(name: string, componentType: string): void {
    const registered = this.registry.get(name)
    if (!registered) return

    registered.componentTypes.delete(componentType)
    if (registered.componentTypes.size === 0) {
      this.registry.delete(name)
      return
    }

    const nextOwner = Array.from(registered.componentTypes).sort()[0]
    const nextDefinition = this.definitionsByComponent.get(nextOwner)?.get(name)
    if (nextDefinition) {
      registered.definition = nextDefinition
    }
  }
}

export const elementPropertyRegistry = new ElementPropertyRegistry()
export default elementPropertyRegistry
export type { PropertyDefinition }
