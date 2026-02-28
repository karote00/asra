import sceneTree, {
  componentRegistry,
  createDynamicComponent
} from '@asyra/scene-tree'
import {
  elementPropertyRegistry,
  propertySchemaRegistry,
  registerPropertySchema,
  type PropertyDefinition
} from '@asyra/props-manager'
import { renderRegistry, type RenderStrategy } from '@asyra/render'
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

  if (renderStrategy && renderRegistry.has(type)) {
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

const countActiveSceneInstances = (type: string): number => {
  // Runtime guard source:
  // unregister is blocked by default when scene instances still use this type.
  let count = 0
  sceneTree.getAllElements().forEach((element) => {
    if (element.get('type') === type) {
      count += 1
    }
  })
  return count
}

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
  const defaults: Record<string, unknown> = {}
  for (const prop of properties) {
    elementPropertyRegistry.register(prop, type)
    if (prop.defaultValue !== undefined) {
      defaults[prop.name] = prop.defaultValue
    }
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
    renderRegistry.register(type, renderStrategy)
  }
}

/**
 * Unregister a custom component type
 * By default this runs cascade cleanup for component-owned registrations.
 *
 * @param type - The component type to unregister
 * @param options - Optional cascade/force/detailed controls
 * @returns boolean compatibility result, or detailed result when `detailed: true`
 */
export function unregisterComponent(type: string): boolean
export function unregisterComponent(
  type: string,
  options: UnregisterComponentOptions & { detailed: true }
): UnregisterComponentResult
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
  const hasRenderRegistration = renderRegistry.has(type)
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
    const owners = elementPropertyRegistry.getComponentTypesForProperty(
      propertyName
    )
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

  if (renderRegistry.unregister(type)) {
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
