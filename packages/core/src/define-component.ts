import sceneTree, {
  componentRegistry,
  createDynamicComponent
} from '@asyra/scene-tree'
import {
  elementPropertyRegistry,
  getPropertyComponent,
  propertySchemaRegistry,
  registerPropertySchema,
  type PropertyDefinition
} from '@asyra/props-manager'
import { renderStrategyRegistry, type RenderStrategy } from '@asyra/render'
import {
  nameCounter,
  idCounter,
  type RegistrationDefinitionMetadata,
  type RegistrationRelationMetadata,
  type RelationOperationSuccess
} from '@asyra/utils'
import { failRegistrationRelation as relationFailure } from './registration-relation-failure'

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

  /** Optional package-owner metadata; ordinary app definitions may omit it. */
  registration?: RegistrationDefinitionMetadata
}

export interface UnregisterComponentSkippedEntry {
  item: string
  reason: string
}

export interface UnregisterComponentResult {
  ok: boolean
  removed: string[]
  skipped: UnregisterComponentSkippedEntry[]
}

export interface UnregisterComponentOptions {
  cascade?: boolean
  force?: boolean
  detailed?: boolean
}

export interface ComponentPropertyRelationMetadata
  extends RegistrationRelationMetadata {
  componentType: string
  propertyName: string
  property: PropertyDefinition
}

const createUnregisterResult = (): UnregisterComponentResult => ({
  ok: false,
  removed: [],
  skipped: []
})

const ensureRegistrationPreconditions = (
  type: string,
  renderStrategy: RenderStrategy | undefined,
  properties: PropertyDefinition[]
) => {
  // NOTE:
  // Base registries already reject duplicates via MapRegistry.register().
  // This preflight exists to fail before any side-effects (id/name/property writes),
  // so defineComponent remains all-or-nothing and does not leave partial state.
  if (componentRegistry.has(type)) {
    throw new Error(`Component "${type}" is already registered`)
  }

  if (renderStrategy && renderStrategyRegistry.has(type)) {
    throw new Error(`Render strategy for "${type}" is already registered`)
  }

  for (const property of properties) {
    const schemaType = property.schema?.type
    if (!schemaType) {
      continue
    }

    if (propertySchemaRegistry.has(schemaType)) {
      throw new Error(`Property schema "${schemaType}" is already registered`)
    }
  }

  for (let index = 0; index < properties.length; index += 1) {
    const schemaType = properties[index].schema?.type
    if (!schemaType) {
      continue
    }

    // Guard duplicate schema types inside one component definition early.
    // Even though registry-level checks exist, this catches local config issues
    // before any registration writes have started.
    for (
      let nextIndex = index + 1;
      nextIndex < properties.length;
      nextIndex += 1
    ) {
      if (properties[nextIndex].schema?.type === schemaType) {
        throw new Error(
          `[Core] Duplicate schema type "${schemaType}" in component "${type}" definition`
        )
      }
    }
  }
}

type ComponentRelationSceneTree = Pick<typeof sceneTree, 'getAllElements'>

const countActiveSceneInstances = (
  type: string,
  sceneTreeOwner: ComponentRelationSceneTree = sceneTree
): number => {
  // Runtime guard source:
  // unregister is blocked by default when scene instances still use this type.
  let count = 0
  sceneTreeOwner.getAllElements().forEach((element) => {
    if (element.get('type') === type) {
      count += 1
    }
  })
  return count
}

const clonePropertyDefinition = (
  property: PropertyDefinition
): PropertyDefinition => ({
  ...property,
  alias: property.alias ? [...property.alias] : undefined,
  schema: property.schema
    ? {
        ...property.schema,
        fields: property.schema.fields.map((field) => ({ ...field }))
      }
    : undefined
})

const createComponentDefaults = (
  properties: readonly PropertyDefinition[]
): Record<string, unknown> => {
  const defaults: Record<string, unknown> = {}
  properties.forEach((property) => {
    if (property.defaultValue !== undefined) {
      defaults[property.name] = property.defaultValue
    }
  })
  return defaults
}

const assertComponentRelationMutationAllowed = (
  componentType: string,
  operation: 'define-relation' | 'remove-relation',
  sceneTreeOwner: ComponentRelationSceneTree = sceneTree
) => {
  if (!componentRegistry.has(componentType)) {
    return relationFailure(
      'REGISTRATION_NOT_FOUND',
      operation,
      `Component "${componentType}" is not registered`,
      { source: { kind: 'component', key: componentType } }
    )
  }

  const activeInstances = countActiveSceneInstances(
    componentType,
    sceneTreeOwner
  )
  if (activeInstances > 0) {
    return relationFailure(
      'REGISTRATION_IN_USE',
      operation,
      `Component "${componentType}" has ${activeInstances} active instance(s)`,
      {
        registration: { kind: 'component', key: componentType },
        source: { kind: 'component', key: componentType }
      }
    )
  }
}

type ComponentRegistryEntry = NonNullable<
  ReturnType<typeof componentRegistry.get>
>

const commitComponentRegistration = (
  current: ComponentRegistryEntry,
  next: ComponentRegistryEntry
): void => {
  const restoreProperties = (properties: readonly PropertyDefinition[]) => {
    elementPropertyRegistry.unregisterComponent(current.type)
    properties.forEach((property) =>
      elementPropertyRegistry.register(property, current.type)
    )
  }

  componentRegistry.unregister(current.type)
  try {
    componentRegistry.register(next)
    restoreProperties(next.properties)
  } catch (error) {
    componentRegistry.unregister(current.type)
    componentRegistry.register(current)
    restoreProperties(current.properties)
    throw error
  }
}

const rebuildComponentProperties = (
  componentType: string,
  properties: PropertyDefinition[]
) => {
  const registration = componentRegistry.get(componentType)
  if (!registration) {
    return relationFailure(
      'REGISTRATION_NOT_FOUND',
      'define-relation',
      `Component "${componentType}" is not registered`,
      { registration: { kind: 'component', key: componentType } }
    )
  }

  const defaults = createComponentDefaults(properties)
  const Constructor = createDynamicComponent(
    registration.type,
    registration.idPrefix,
    registration.namePrefix,
    properties,
    defaults,
    registration.isContainer
  )
  const nextRegistration = {
    ...registration,
    constructor: Constructor,
    properties,
    defaults
  }

  commitComponentRegistration(registration, nextRegistration)
}

export const getComponentPropertyRelations = (
  componentType: string
): readonly ComponentPropertyRelationMetadata[] => {
  const registration = componentRegistry.get(componentType)
  if (!registration) {
    return relationFailure(
      'REGISTRATION_NOT_FOUND',
      'define-relation',
      `Component "${componentType}" is not registered`,
      { registration: { kind: 'component', key: componentType } }
    )
  }

  return registration.properties.map((property) => ({
    source: { kind: 'component', key: componentType },
    name: property.name,
    target: { kind: 'property', key: property.type },
    onTargetUnregister: 'detach' as const,
    componentType,
    propertyName: property.name,
    property: clonePropertyDefinition(property)
  }))
}

const removeComponentPropertyRelationWithOwner = (
  componentType: string,
  propertyName: string,
  sceneTreeOwner: ComponentRelationSceneTree
): RelationOperationSuccess => {
  assertComponentRelationMutationAllowed(
    componentType,
    'remove-relation',
    sceneTreeOwner
  )
  const registration = componentRegistry.get(componentType)
  if (!registration) {
    return relationFailure(
      'REGISTRATION_NOT_FOUND',
      'remove-relation',
      `Component "${componentType}" is not registered`,
      { source: { kind: 'component', key: componentType } }
    )
  }
  const property = registration.properties.find(
    (candidate) => candidate.name === propertyName
  )
  if (!property) {
    return relationFailure(
      'RELATION_NOT_FOUND',
      'remove-relation',
      `Component property relation "${componentType}/${propertyName}" was not found`,
      {
        source: { kind: 'component', key: componentType },
        relationName: propertyName
      }
    )
  }

  const properties = registration.properties.filter(
    (candidate) => candidate.name !== propertyName
  )
  rebuildComponentProperties(componentType, properties)

  const relation: RegistrationRelationMetadata = {
    source: { kind: 'component', key: componentType },
    name: property.name,
    target: { kind: 'property', key: property.type },
    onTargetUnregister: 'detach'
  }
  return {
    ok: true,
    operation: 'remove-relation',
    source: relation.source,
    relation
  }
}

export const removeComponentPropertyRelation = (
  componentType: string,
  propertyName: string
): RelationOperationSuccess =>
  removeComponentPropertyRelationWithOwner(
    componentType,
    propertyName,
    sceneTree
  )

export const removeComponentPropertyRelationForSceneTree =
  removeComponentPropertyRelationWithOwner

const defineComponentPropertyRelationWithOwner = (
  componentType: string,
  property: PropertyDefinition,
  sceneTreeOwner: ComponentRelationSceneTree
): RelationOperationSuccess => {
  assertComponentRelationMutationAllowed(
    componentType,
    'define-relation',
    sceneTreeOwner
  )
  const registration = componentRegistry.get(componentType)
  if (!registration) {
    return relationFailure(
      'REGISTRATION_NOT_FOUND',
      'define-relation',
      `Component "${componentType}" is not registered`,
      { source: { kind: 'component', key: componentType } }
    )
  }
  if (
    registration.properties.some(
      (candidate) => candidate.name === property.name
    )
  ) {
    return relationFailure(
      'DUPLICATE_RELATION',
      'define-relation',
      `Component property relation "${componentType}/${property.name}" is already defined`,
      {
        source: { kind: 'component', key: componentType },
        relationName: property.name
      }
    )
  }
  if (!getPropertyComponent(property.type)) {
    return relationFailure(
      'RELATION_TARGET_NOT_FOUND',
      'define-relation',
      `Property runtime "${property.type}" is not registered`,
      {
        source: { kind: 'component', key: componentType },
        relationName: property.name,
        target: { kind: 'property', key: property.type }
      }
    )
  }
  if (
    property.schema?.type &&
    propertySchemaRegistry.has(property.schema.type)
  ) {
    throw new Error(
      `Property schema "${property.schema.type}" is already registered`
    )
  }

  const properties = [
    ...registration.properties,
    clonePropertyDefinition(property)
  ]
  const defaults = createComponentDefaults(properties)
  const Constructor = createDynamicComponent(
    registration.type,
    registration.idPrefix,
    registration.namePrefix,
    properties,
    defaults,
    registration.isContainer
  )

  if (property.schema?.type) {
    registerPropertySchema(property.schema)
  }
  commitComponentRegistration(registration, {
    ...registration,
    constructor: Constructor,
    properties,
    defaults
  })

  const relation: RegistrationRelationMetadata = {
    source: { kind: 'component', key: componentType },
    name: property.name,
    target: { kind: 'property', key: property.type },
    onTargetUnregister: 'detach'
  }
  return {
    ok: true,
    operation: 'define-relation',
    source: relation.source,
    relation
  }
}

export const defineComponentPropertyRelation = (
  componentType: string,
  property: PropertyDefinition
): RelationOperationSuccess =>
  defineComponentPropertyRelationWithOwner(componentType, property, sceneTree)

export const defineComponentPropertyRelationForSceneTree =
  defineComponentPropertyRelationWithOwner

const addUniqueRemoved = (
  result: UnregisterComponentResult,
  removedSet: Set<string>,
  item: string
) => {
  // Keep removed report deterministic and duplicate-free.
  if (removedSet.has(item)) {
    return
  }
  removedSet.add(item)
  result.removed.push(item)
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
  // Phase A: preflight checks before any writes.
  ensureRegistrationPreconditions(type, renderStrategy, properties)

  // 0. Register type with nameCounter for auto-numbering
  // This allows app-level components to register without modifying framework NameTypes
  nameCounter.registerType(type, namePrefix, undefined, { override: true })

  // 1. Register type with idCounter for auto-numbering
  // This allows app-level components to register without modifying framework IDTypes
  idCounter.registerType(type, idPrefix, undefined, { override: true })

  // Phase B: register counters + properties, and derive default values.
  const defaults = createComponentDefaults(properties)
  for (const prop of properties) {
    elementPropertyRegistry.register(prop, type)
  }

  // Phase C: register schema types declared by this component definition.
  for (const prop of properties) {
    const schema = prop.schema
    if (!schema?.type) {
      continue
    }
    registerPropertySchema(schema)
  }
  // Phase D: construct runtime class and register component metadata.
  const ComponentClass = createDynamicComponent(
    type,
    idPrefix,
    namePrefix,
    properties,
    defaults,
    isContainer
  )

  componentRegistry.register({
    type,
    idPrefix,
    namePrefix,
    constructor: ComponentClass,
    properties,
    defaults,
    isContainer
  })

  // Phase E: optional render strategy registration.
  if (renderStrategy) {
    renderStrategyRegistry.register(type, renderStrategy)
  }
}

/**
 * Graph-owned component cleanup. Property capabilities and render strategies
 * are independent registration nodes and are intentionally preserved.
 */
export const unregisterComponentGraphRegistration = (type: string): boolean => {
  if (!componentRegistry.unregister(type)) return false
  elementPropertyRegistry.unregisterComponent(type)
  idCounter.unregisterType(type)
  nameCounter.unregisterType(type)
  return true
}

/**
 * Unregister a custom component type
 * By default this runs cascade cleanup for component-owned registrations.
 *
 * @param type - The component type to unregister
 * @param options - Optional cascade/force/detailed controls
 * @returns boolean compatibility result, or detailed result when `detailed: true`
 */
export function unregisterComponent(
  type: string,
  options: UnregisterComponentOptions & { detailed: true }
): UnregisterComponentResult
export function unregisterComponent(
  type: string,
  options?: UnregisterComponentOptions
): boolean
export function unregisterComponent(
  type: string,
  options: UnregisterComponentOptions = {}
): boolean | UnregisterComponentResult {
  const { cascade = true, force = false, detailed = false } = options
  const result = createUnregisterResult()
  const removedSet = new Set<string>()

  let didMutate = false
  const registration = componentRegistry.get(type)
  const activeInstances = countActiveSceneInstances(type)

  // Phase 1: runtime safety guard.
  if (activeInstances > 0 && !force) {
    result.skipped.push({
      item: `component:${type}`,
      reason: `Blocked because ${activeInstances} active scene instance(s) still use this type. Pass { force: true } to override.`
    })
    return detailed ? result : false
  }

  const hasComponentRegistration = componentRegistry.has(type)
  const hasRenderRegistration = renderStrategyRegistry.has(type)
  const hasPropertyRegistration =
    elementPropertyRegistry.getPropertiesForComponent(type).length > 0
  const hasCounterRegistration =
    idCounter.hasType(type) || nameCounter.hasType(type)

  // Phase 2: no-op fast exit for unknown component type.
  if (
    !hasComponentRegistration &&
    !hasRenderRegistration &&
    !hasPropertyRegistration &&
    !hasCounterRegistration
  ) {
    result.skipped.push({
      item: `component:${type}`,
      reason: 'No component-related registrations found'
    })
    return detailed ? result : false
  }

  if (componentRegistry.unregister(type)) {
    didMutate = true
    addUniqueRemoved(result, removedSet, `component:${type}`)
  } else {
    result.skipped.push({
      item: `component:${type}`,
      reason: 'Component registry entry not found'
    })
  }

  if (!cascade) {
    // Compatibility path: only remove the component registry entry.
    result.ok = didMutate
    return detailed ? result : didMutate
  }

  // Phase 3 (cascade): discover what this component owns from its own record.
  const registeredProperties =
    registration?.properties ??
    elementPropertyRegistry.getPropertiesForComponent(type)
  const ownedPropertyNames: string[] = []
  for (const property of registeredProperties) {
    const propertyName = property.name
    if (!propertyName) {
      continue
    }
    const owners =
      elementPropertyRegistry.getComponentTypesForProperty(propertyName)
    if (owners.includes(type)) {
      ownedPropertyNames.push(propertyName)
    }
  }

  if (ownedPropertyNames.length > 0) {
    // Remove component ownership from property definitions.
    elementPropertyRegistry.unregisterComponent(type)

    for (const propertyName of ownedPropertyNames) {
      didMutate = true
      addUniqueRemoved(
        result,
        removedSet,
        `property-owner:${type}.${propertyName}`
      )

      if (!elementPropertyRegistry.has(propertyName)) {
        // Last owner removed => property definition removed from registry.
        addUniqueRemoved(
          result,
          removedSet,
          `property-definition:${propertyName}`
        )
        continue
      }

      const ownersAfter =
        elementPropertyRegistry.getComponentTypesForProperty(propertyName)
      // Shared definition: keep it and report remaining owners.
      result.skipped.push({
        item: `property-definition:${propertyName}`,
        reason: `Kept because shared by: ${ownersAfter.join(', ')}`
      })
    }
  }

  for (const property of registration?.properties ?? []) {
    const schemaType = property.schema?.type
    if (!schemaType) {
      continue
    }

    if (propertySchemaRegistry.has(schemaType)) {
      // Schema ownership is defined by component property declaration.
      propertySchemaRegistry.unregister(schemaType)
      didMutate = true
      addUniqueRemoved(result, removedSet, `property-schema:${schemaType}`)
      continue
    }

    result.skipped.push({
      item: `property-schema:${schemaType}`,
      reason: 'Schema registry entry not found'
    })
  }

  if (renderStrategyRegistry.unregister(type)) {
    didMutate = true
    addUniqueRemoved(result, removedSet, `render:${type}`)
  } else if (hasRenderRegistration) {
    result.skipped.push({
      item: `render:${type}`,
      reason: 'Render strategy entry not found'
    })
  }

  if (idCounter.unregisterType(type)) {
    didMutate = true
    addUniqueRemoved(result, removedSet, `id-counter:${type}`)
  } else {
    result.skipped.push({
      item: `id-counter:${type}`,
      reason: 'ID counter entry not found'
    })
  }

  if (nameCounter.unregisterType(type)) {
    didMutate = true
    addUniqueRemoved(result, removedSet, `name-counter:${type}`)
  } else {
    result.skipped.push({
      item: `name-counter:${type}`,
      reason: 'Name counter entry not found'
    })
  }

  // Phase 4: finalize compatibility + detailed reporting.
  result.ok = didMutate
  return detailed ? result : didMutate
}
