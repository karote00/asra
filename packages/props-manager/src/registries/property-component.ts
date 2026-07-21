import { MapRegistry } from '@asyra/utils'
import type { PropertyComponentConstructor } from '../components'
import { clonePropertyDefinitionRecord } from './property-definition-value'

export interface PropertyChildRelationDefinition {
  key: string
  childType: string
  mode?: 'ids' | 'ids-or-objects'
  toChildData?: (
    item: Record<string, unknown>
  ) => Record<string, unknown> | null
  toValue?: (
    child: { get: (key: string) => unknown },
    childId: string
  ) => unknown
}

export interface PropertyComponentConfigRegistration {
  type: string
  defaults?: Record<string, unknown>
  persistKeys?: string[]
  valueKeys?: string[]
  unitKeys?: string[]
  allowDynamicKeys?: boolean
  dynamicReservedKeys?: string[]
  children?: PropertyChildRelationDefinition
}

interface RegisterOptions {
  duplicateErrorMessage?: string
}

class PropertyComponentRegistry {
  private registry = new MapRegistry<string, PropertyComponentConstructor>()
  private configDefinitions = new Map<
    string,
    PropertyComponentConfigRegistration
  >()

  register(
    type: string,
    component: PropertyComponentConstructor,
    options: RegisterOptions = {},
    configDefinition?: PropertyComponentConfigRegistration
  ): void {
    if (!type) {
      return
    }

    this.registry.register(type, component, {
      duplicateErrorMessage:
        options.duplicateErrorMessage ??
        `Property component "${type}" is already registered`
    })
    if (configDefinition) {
      this.configDefinitions.set(type, cloneConfigDefinition(configDefinition))
    }
  }

  get(type: string): PropertyComponentConstructor | undefined {
    return this.registry.get(type)
  }

  has(type: string): boolean {
    return this.registry.has(type)
  }

  getConfigDefinition(
    type: string
  ): PropertyComponentConfigRegistration | undefined {
    const definition = this.configDefinitions.get(type)
    return definition ? cloneConfigDefinition(definition) : undefined
  }

  unregister(type: string): boolean {
    this.configDefinitions.delete(type)
    return this.registry.delete(type)
  }

  restoreAfterFailedDeclarativeCommit(
    type: string,
    component: PropertyComponentConstructor,
    configDefinition: PropertyComponentConfigRegistration
  ): void {
    this.registry.set(type, component)
    this.configDefinitions.set(type, cloneConfigDefinition(configDefinition))
  }

  clear(): void {
    this.registry.clear()
    this.configDefinitions.clear()
  }
}

const cloneConfigDefinition = (
  definition: PropertyComponentConfigRegistration
): PropertyComponentConfigRegistration => ({
  ...definition,
  defaults: clonePropertyDefinitionRecord(definition.defaults),
  persistKeys: definition.persistKeys ? [...definition.persistKeys] : undefined,
  valueKeys: definition.valueKeys ? [...definition.valueKeys] : undefined,
  unitKeys: definition.unitKeys ? [...definition.unitKeys] : undefined,
  dynamicReservedKeys: definition.dynamicReservedKeys
    ? [...definition.dynamicReservedKeys]
    : undefined,
  children: definition.children ? { ...definition.children } : undefined
})

const propertyComponentRegistryOwner = new PropertyComponentRegistry()

export const propertyComponentRegistry = {
  register: propertyComponentRegistryOwner.register.bind(
    propertyComponentRegistryOwner
  ),
  get: propertyComponentRegistryOwner.get.bind(propertyComponentRegistryOwner),
  has: propertyComponentRegistryOwner.has.bind(propertyComponentRegistryOwner),
  getConfigDefinition: propertyComponentRegistryOwner.getConfigDefinition.bind(
    propertyComponentRegistryOwner
  ),
  unregister: propertyComponentRegistryOwner.unregister.bind(
    propertyComponentRegistryOwner
  ),
  clear: propertyComponentRegistryOwner.clear.bind(
    propertyComponentRegistryOwner
  )
}

export const registerPropertyComponent = (
  type: string,
  component: PropertyComponentConstructor,
  options?: RegisterOptions,
  configDefinition?: PropertyComponentConfigRegistration
) =>
  propertyComponentRegistry.register(type, component, options, configDefinition)

export const getPropertyComponent = (type: string) =>
  propertyComponentRegistry.get(type)

export const getPropertyComponentConfigDefinition = (type: string) =>
  propertyComponentRegistry.getConfigDefinition(type)

export const unregisterPropertyComponent = (type: string): boolean =>
  propertyComponentRegistry.unregister(type)

export const restorePropertyComponentAfterFailedDeclarativeCommit = (
  type: string,
  component: PropertyComponentConstructor,
  configDefinition: PropertyComponentConfigRegistration
): void =>
  propertyComponentRegistryOwner.restoreAfterFailedDeclarativeCommit(
    type,
    component,
    configDefinition
  )

export type {
  PropertyComponentConstructor,
  RegisterOptions as RegisterPropertyComponentOptions
}
