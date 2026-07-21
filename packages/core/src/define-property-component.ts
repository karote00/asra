import propsManager, {
  createPropertyComponentFromConfig as createPropertyComponentFromConfigOwner,
  clonePropertyDefinitionRecord,
  getPropertyComponent,
  getPropertyComponentConfigDefinition,
  propertyComponentRegistry,
  registerPropertyComponent,
  type PropertyChildRelationDefinition,
  type PropertyComponentConfigRegistration,
  type PropertyComponentConstructor,
  type RegisterPropertyComponentOptions,
  type PropsManager
} from '@asyra/props-manager'
import {
  type RegistrationDefinitionMetadata,
  type RegistrationRelationMetadata,
  type RelationOperationSuccess
} from '@asyra/utils'
import { failRegistrationRelation as relationFailure } from './registration-relation-failure'

export interface PropertyComponentConstructorDefinition {
  type: string
  constructor: PropertyComponentConstructor
  options?: RegisterPropertyComponentOptions
  registration?: RegistrationDefinitionMetadata
}

export interface PropertyComponentConfigDefinition
  extends PropertyComponentConfigRegistration {
  options?: RegisterPropertyComponentOptions
  registration?: RegistrationDefinitionMetadata
}

export type PropertyComponentDefinition =
  | PropertyComponentConstructorDefinition
  | PropertyComponentConfigDefinition

export interface PropertyChildRelationMetadata
  extends RegistrationRelationMetadata,
    PropertyChildRelationDefinition {
  parentPropertyType: string
}

const cloneConfigDefinition = (
  definition: PropertyComponentConfigRegistration
): PropertyComponentConfigDefinition => ({
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

const createPropertyComponentFromConfig = createPropertyComponentFromConfigOwner

const assertPropertyRelationMutationAllowed = (
  parentPropertyType: string,
  operation: 'define-relation' | 'remove-relation',
  manager: PropsManager
): PropertyComponentConfigDefinition => {
  if (!getPropertyComponent(parentPropertyType)) {
    return relationFailure(
      'REGISTRATION_NOT_FOUND',
      operation,
      `Property runtime "${parentPropertyType}" is not registered`,
      { source: { kind: 'property', key: parentPropertyType } }
    )
  }

  const propertyIds = manager.getPropertyIdsByType(parentPropertyType)
  if (propertyIds.length > 0) {
    return relationFailure(
      'REGISTRATION_IN_USE',
      operation,
      `Property runtime "${parentPropertyType}" is in use by: ${propertyIds.join(', ')}`,
      {
        registration: { kind: 'property', key: parentPropertyType },
        source: { kind: 'property', key: parentPropertyType }
      }
    )
  }

  const definition = getPropertyComponentConfigDefinition(parentPropertyType)
  if (!definition) {
    return relationFailure(
      'RELATION_REMOVE_FAILED',
      operation,
      `Property runtime "${parentPropertyType}" does not use a declarative config definition`,
      { source: { kind: 'property', key: parentPropertyType } }
    )
  }
  return cloneConfigDefinition(definition)
}

const commitPropertyComponentRegistration = (
  type: string,
  component: PropertyComponentConstructor,
  configDefinition: PropertyComponentConfigRegistration
): void => {
  const currentComponent = getPropertyComponent(type)
  const currentDefinition = getPropertyComponentConfigDefinition(type)
  if (!currentComponent) {
    return relationFailure(
      'REGISTRATION_NOT_FOUND',
      'define-relation',
      `Property runtime "${type}" is not registered`,
      { registration: { kind: 'property', key: type } }
    )
  }

  propertyComponentRegistry.unregister(type)
  try {
    propertyComponentRegistry.register(
      type,
      component,
      undefined,
      configDefinition
    )
  } catch (error) {
    propertyComponentRegistry.register(
      type,
      currentComponent,
      undefined,
      currentDefinition
    )
    throw error
  }
}

export const getPropertyChildRelations = (
  parentPropertyType: string
): readonly PropertyChildRelationMetadata[] => {
  if (!getPropertyComponent(parentPropertyType)) {
    return relationFailure(
      'REGISTRATION_NOT_FOUND',
      'define-relation',
      `Property runtime "${parentPropertyType}" is not registered`,
      { registration: { kind: 'property', key: parentPropertyType } }
    )
  }
  const children =
    getPropertyComponentConfigDefinition(parentPropertyType)?.children
  if (!children) return []

  return [
    {
      source: { kind: 'property', key: parentPropertyType },
      name: children.key,
      target: { kind: 'property', key: children.childType },
      onTargetUnregister: 'detach',
      parentPropertyType,
      ...children
    }
  ]
}

export const removePropertyChildRelation = (
  parentPropertyType: string,
  key: string,
  manager: PropsManager = propsManager
): RelationOperationSuccess => {
  const definition = assertPropertyRelationMutationAllowed(
    parentPropertyType,
    'remove-relation',
    manager
  )
  const children = definition.children
  if (!children || children.key !== key) {
    return relationFailure(
      'RELATION_NOT_FOUND',
      'remove-relation',
      `Property child relation "${parentPropertyType}/${key}" was not found`,
      {
        source: { kind: 'property', key: parentPropertyType },
        relationName: key
      }
    )
  }

  const nextDefinition = { ...definition, children: undefined }
  const Constructor = createPropertyComponentFromConfig(nextDefinition)
  commitPropertyComponentRegistration(
    parentPropertyType,
    Constructor,
    nextDefinition
  )

  const relation: RegistrationRelationMetadata = {
    source: { kind: 'property', key: parentPropertyType },
    name: children.key,
    target: { kind: 'property', key: children.childType },
    onTargetUnregister: 'detach'
  }
  return {
    ok: true,
    operation: 'remove-relation',
    source: relation.source,
    relation
  }
}

export const definePropertyChildRelation = (
  parentPropertyType: string,
  relationDefinition: PropertyChildRelationDefinition,
  manager: PropsManager = propsManager
): RelationOperationSuccess => {
  const definition = assertPropertyRelationMutationAllowed(
    parentPropertyType,
    'define-relation',
    manager
  )
  if (definition.children) {
    return relationFailure(
      'DUPLICATE_RELATION',
      'define-relation',
      `Property runtime "${parentPropertyType}" already defines child relation "${definition.children.key}"`,
      {
        source: { kind: 'property', key: parentPropertyType },
        relationName: relationDefinition.key
      }
    )
  }
  if (!getPropertyComponent(relationDefinition.childType)) {
    return relationFailure(
      'RELATION_TARGET_NOT_FOUND',
      'define-relation',
      `Child property runtime "${relationDefinition.childType}" is not registered`,
      {
        source: { kind: 'property', key: parentPropertyType },
        relationName: relationDefinition.key,
        target: { kind: 'property', key: relationDefinition.childType }
      }
    )
  }

  const nextDefinition = {
    ...definition,
    children: { ...relationDefinition }
  }
  const Constructor = createPropertyComponentFromConfig(nextDefinition)
  commitPropertyComponentRegistration(
    parentPropertyType,
    Constructor,
    nextDefinition
  )

  const relation: RegistrationRelationMetadata = {
    source: { kind: 'property', key: parentPropertyType },
    name: relationDefinition.key,
    target: { kind: 'property', key: relationDefinition.childType },
    onTargetUnregister: 'detach'
  }
  return {
    ok: true,
    operation: 'define-relation',
    source: relation.source,
    relation
  }
}

/**
 * Define a property component constructor for a property type.
 */
export function definePropertyComponent(
  definition: PropertyComponentDefinition
): PropertyComponentConstructor {
  const hasConstructor =
    Object.prototype.hasOwnProperty.call(definition, 'constructor') &&
    typeof (definition as PropertyComponentConstructorDefinition)
      .constructor === 'function'

  const constructor = hasConstructor
    ? (definition as PropertyComponentConstructorDefinition).constructor
    : createPropertyComponentFromConfig(definition)

  registerPropertyComponent(
    definition.type,
    constructor,
    definition.options,
    hasConstructor
      ? undefined
      : (definition as PropertyComponentConfigDefinition)
  )

  return constructor
}

/**
 * Unregister a property component constructor by property type.
 */
export function unregisterPropertyComponent(type: string): boolean {
  if (!propertyComponentRegistry.has(type)) {
    return false
  }

  propertyComponentRegistry.unregister(type)
  return true
}
