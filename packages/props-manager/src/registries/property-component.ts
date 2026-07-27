import { MapRegistry } from '@asyra/utils'
import type { PropertyComponentConstructor } from '../components'
import { clonePropertyDefinitionRecord } from './property-definition-value'
import type { PropertyRegistrationOptions } from './registration-options'

export interface PropertyChildRelationDefinition {
  key: string
  childType: string
  mode?: 'ids' | 'ids-or-objects'
  collection?: 'array' | 'array-or-record'
  toChildData?: (
    item: Record<string, unknown>,
    childId?: string
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

const batchRebindablePropertyComponentRelations = new WeakMap<
  PropertyComponentConstructor,
  PropertyChildRelationDefinition
>()

export const markPropertyComponentBatchRebindable = (
  component: PropertyComponentConstructor,
  relation: PropertyChildRelationDefinition | undefined
): void => {
  if (relation) {
    batchRebindablePropertyComponentRelations.set(component, { ...relation })
    return
  }
  batchRebindablePropertyComponentRelations.delete(component)
}

export const getPropertyComponentBatchRebindableRelation = (
  component: PropertyComponentConstructor
): PropertyChildRelationDefinition | undefined => {
  const relation = batchRebindablePropertyComponentRelations.get(component)
  return relation ? { ...relation } : undefined
}

export const arePropertyChildRelationsEqual = (
  left: PropertyChildRelationDefinition | undefined,
  right: PropertyChildRelationDefinition | undefined
): boolean => {
  if (!left || !right) {
    return left === right
  }
  return (
    left.key === right.key &&
    left.childType === right.childType &&
    (left.mode ?? 'ids') === (right.mode ?? 'ids') &&
    (left.collection ?? 'array') === (right.collection ?? 'array') &&
    left.toChildData === right.toChildData &&
    left.toValue === right.toValue
  )
}

export const isPropertyComponentBatchRebindable = (
  component: PropertyComponentConstructor,
  relation: PropertyChildRelationDefinition
): boolean =>
  arePropertyChildRelationsEqual(
    batchRebindablePropertyComponentRelations.get(component),
    relation
  )

class PropertyComponentRegistry {
  private registry = new MapRegistry<string, PropertyComponentConstructor>()
  private configDefinitions = new Map<
    string,
    PropertyComponentConfigRegistration
  >()
  private canonicalChildRelations = new Map<
    string,
    PropertyChildRelationDefinition
  >()
  private registrationRevisions = new Map<string, number>()

  private bumpRegistrationRevision(type: string): void {
    this.registrationRevisions.set(
      type,
      (this.registrationRevisions.get(type) ?? 0) + 1
    )
  }

  register(
    type: string,
    component: PropertyComponentConstructor,
    options: PropertyRegistrationOptions = {},
    configDefinition?: PropertyComponentConfigRegistration,
    canonicalChildRelation?: PropertyChildRelationDefinition
  ): void {
    if (!type) {
      return
    }

    const configChildRelation = configDefinition?.children
    if (
      configChildRelation &&
      canonicalChildRelation &&
      !arePropertyChildRelationsEqual(
        configChildRelation,
        canonicalChildRelation
      )
    ) {
      throw new Error(
        `Property component "${type}" has incoherent canonical child metadata`
      )
    }
    const childRelation = canonicalChildRelation ?? configChildRelation
    this.registry.register(type, component, {
      duplicateErrorMessage:
        options.duplicateErrorMessage ??
        `Property component "${type}" is already registered`
    })
    if (canonicalChildRelation) {
      markPropertyComponentBatchRebindable(component, canonicalChildRelation)
    }
    if (childRelation) {
      this.canonicalChildRelations.set(type, { ...childRelation })
    }
    if (configDefinition) {
      this.configDefinitions.set(
        type,
        clonePropertyComponentConfigRegistration(configDefinition)
      )
    }
    this.bumpRegistrationRevision(type)
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
    return definition
      ? clonePropertyComponentConfigRegistration(definition)
      : undefined
  }

  getCanonicalChildRelation(
    type: string
  ): PropertyChildRelationDefinition | undefined {
    const relation = this.canonicalChildRelations.get(type)
    return relation ? { ...relation } : undefined
  }

  getRegistrationRevision(type: string): number {
    return this.registrationRevisions.get(type) ?? 0
  }

  unregister(type: string): boolean {
    const removedConfig = this.configDefinitions.delete(type)
    const removedCanonicalRelation = this.canonicalChildRelations.delete(type)
    const removedComponent = this.registry.delete(type)
    if (removedConfig || removedCanonicalRelation || removedComponent) {
      this.bumpRegistrationRevision(type)
    }
    return removedComponent
  }

  restoreAfterFailedDeclarativeCommit(
    type: string,
    component: PropertyComponentConstructor,
    configDefinition: PropertyComponentConfigRegistration
  ): void {
    this.registry.set(type, component)
    this.configDefinitions.set(
      type,
      clonePropertyComponentConfigRegistration(configDefinition)
    )
    const childRelation = configDefinition.children
    if (childRelation) {
      this.canonicalChildRelations.set(type, { ...childRelation })
    } else {
      this.canonicalChildRelations.delete(type)
    }
    this.bumpRegistrationRevision(type)
  }

  clear(): void {
    const clearedTypes = this.registry.keys()
    this.registry.clear()
    this.configDefinitions.clear()
    this.canonicalChildRelations.clear()
    clearedTypes.forEach((type) => {
      this.bumpRegistrationRevision(type)
    })
  }
}

export const clonePropertyComponentConfigRegistration = (
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
  options?: PropertyRegistrationOptions,
  configDefinition?: PropertyComponentConfigRegistration,
  canonicalChildRelation?: PropertyChildRelationDefinition
) =>
  propertyComponentRegistry.register(
    type,
    component,
    options,
    configDefinition,
    canonicalChildRelation
  )

export const getPropertyComponent = (type: string) =>
  propertyComponentRegistry.get(type)

export const getPropertyComponentConfigDefinition = (type: string) =>
  propertyComponentRegistry.getConfigDefinition(type)

export const getPropertyComponentCanonicalChildRelation = (type: string) =>
  propertyComponentRegistryOwner.getCanonicalChildRelation(type)

export const getPropertyComponentRegistrationRevision = (type: string) =>
  propertyComponentRegistryOwner.getRegistrationRevision(type)

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

export type { PropertyComponentConstructor }
