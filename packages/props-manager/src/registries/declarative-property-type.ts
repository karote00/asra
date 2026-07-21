import {
  isRecord,
  type DataTypes,
  type EvnetOptions,
  type PropertyComponentInstanceDataTypes,
  type PropertyComponentRawData,
  type PropertyFieldSchema,
  type PropertySchema,
  type PropertyUnitKind,
  type PropertyValueKind,
  type Unit
} from '@asyra/utils'
import { BasePropertyComponent } from '../components'
import type { PropertyComponentConstructor } from '../components'
import propsManager, { PropsManager } from '../manager/props-manager'
import { getPropertyComponentAccessor } from '../manager/component-accessor'
import {
  getPropertyComponent,
  getPropertyComponentConfigDefinition,
  propertyComponentRegistry,
  registerPropertyComponent,
  restorePropertyComponentAfterFailedDeclarativeCommit,
  type PropertyComponentConfigRegistration
} from './property-component'
import {
  clonePropertyDefinitionRecord,
  clonePropertyDefinitionValue
} from './property-definition-value'
import { PropertyRegistrationError } from './property-registration'
import {
  getPropertySchema,
  propertySchemaRegistry,
  registerPropertySchema,
  restorePropertySchemaAfterFailedDeclarativeCommit
} from './property-schema'
import { matchesPropertyValueKind } from './property-value-kind'

export interface PropertyTypeFieldDefinition<T = unknown> {
  readonly key: string
  readonly kind: PropertyValueKind
  readonly defaultValue: T
  readonly validate?: (value: unknown) => boolean
  readonly allowedUnits?: readonly PropertyUnitKind[]
  readonly persist: boolean
  readonly project: boolean
  readonly unit: boolean
}

export interface PropertyTypeDefinition<
  TFields extends object = Record<string, unknown>
> {
  readonly type: string
  readonly fields: readonly PropertyTypeFieldDefinition<
    TFields[keyof TFields]
  >[]
  readonly allowDynamicKeys: boolean
  readonly dynamicReservedKeys: readonly string[]
}

export const PROPERTY_TYPE_DEFINITION_ERROR_CODES = [
  'PROPERTY_TYPE_NOT_DECLARATIVE',
  'PROPERTY_TYPE_DEFINITION_DRIFT',
  'PROPERTY_TYPE_DEFINITION_INVALID',
  'PROPERTY_TYPE_DEFINITION_COMMIT_FAILED'
] as const

export type PropertyTypeDefinitionErrorCode =
  (typeof PROPERTY_TYPE_DEFINITION_ERROR_CODES)[number]

export interface PropertyTypeDefinitionFailure {
  readonly ok: false
  readonly code: PropertyTypeDefinitionErrorCode
  readonly type: string
  readonly message: string
}

export class PropertyTypeDefinitionError extends Error {
  readonly code: PropertyTypeDefinitionErrorCode
  readonly type: string
  readonly result: PropertyTypeDefinitionFailure
  readonly cause?: unknown

  constructor(result: PropertyTypeDefinitionFailure, cause?: unknown) {
    super(result.message)
    this.name = 'PropertyTypeDefinitionError'
    this.code = result.code
    this.type = result.type
    this.result = { ...result }
    this.cause = cause
  }
}

const failDefinition = (
  code: PropertyTypeDefinitionErrorCode,
  type: string,
  message: string,
  cause?: unknown
): never => {
  throw new PropertyTypeDefinitionError(
    { ok: false, code, type, message },
    cause
  )
}

const valuesEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => valuesEqual(item, right[index]))
    )
  }
  if (!isRecord(left) || !isRecord(right)) return false

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) &&
        valuesEqual(left[key], right[key])
    )
  )
}

const VALUE_KINDS = new Set<PropertyValueKind>([
  'number',
  'string',
  'boolean',
  'object',
  'array',
  'custom'
])
const UNIT_KINDS = new Set<PropertyUnitKind>(['px', 'pct', 'auto', 'custom'])
const FIXED_RESERVED_KEYS = new Set(['id', 'type'])

const hasDuplicates = (keys: readonly string[]) =>
  new Set(keys).size !== keys.length

const validateDefault = (
  type: string,
  field: PropertyTypeFieldDefinition,
  code: PropertyTypeDefinitionErrorCode
): void => {
  if (!matchesPropertyValueKind(field.kind, field.defaultValue)) {
    failDefinition(
      code,
      type,
      `Property field "${field.key}" has an invalid default for kind "${field.kind}"`
    )
  }

  if (
    field.allowedUnits &&
    !field.allowedUnits.includes(field.defaultValue as PropertyUnitKind)
  ) {
    failDefinition(
      code,
      type,
      `Property field "${field.key}" default is outside its allowed units`
    )
  }

  if (field.validate) {
    let valid = false
    try {
      valid = field.validate(field.defaultValue)
    } catch (error) {
      failDefinition(
        code,
        type,
        `Property field "${field.key}" validator rejected its default`,
        error
      )
    }
    if (!valid) {
      failDefinition(
        code,
        type,
        `Property field "${field.key}" validator rejected its default`
      )
    }
  }
}

const normalizeDefinition = <TFields extends object>(
  expectedType: string,
  definition: PropertyTypeDefinition<TFields>,
  code: PropertyTypeDefinitionErrorCode = 'PROPERTY_TYPE_DEFINITION_INVALID'
): PropertyTypeDefinition<TFields> => {
  if (!isRecord(definition) || definition.type !== expectedType) {
    failDefinition(
      code,
      expectedType,
      `Property definition identity must remain "${expectedType}"`
    )
  }
  if (
    typeof definition.allowDynamicKeys !== 'boolean' ||
    !Array.isArray(definition.dynamicReservedKeys) ||
    !definition.dynamicReservedKeys.every(
      (key) => typeof key === 'string' && key.length > 0
    ) ||
    hasDuplicates(definition.dynamicReservedKeys)
  ) {
    failDefinition(
      code,
      expectedType,
      'Property definition has invalid dynamic-key policy'
    )
  }
  if (!Array.isArray(definition.fields)) {
    failDefinition(
      code,
      expectedType,
      'Property definition fields must be an array'
    )
  }

  const seenKeys = new Set<string>()
  const fields = definition.fields.map((field) => {
    if (!isRecord(field)) {
      return failDefinition(
        code,
        expectedType,
        'Property field must be an object'
      )
    }
    if (
      typeof field.key !== 'string' ||
      field.key.length === 0 ||
      FIXED_RESERVED_KEYS.has(field.key) ||
      seenKeys.has(field.key)
    ) {
      return failDefinition(
        code,
        expectedType,
        `Property field key "${String(field.key)}" is duplicate or reserved`
      )
    }
    seenKeys.add(field.key)

    if (!VALUE_KINDS.has(field.kind as PropertyValueKind)) {
      return failDefinition(
        code,
        expectedType,
        `Property field "${field.key}" has an invalid kind`
      )
    }
    if (
      !Object.prototype.hasOwnProperty.call(field, 'defaultValue') ||
      field.defaultValue === undefined
    ) {
      return failDefinition(
        code,
        expectedType,
        `Property field "${field.key}" requires a default value`
      )
    }
    if (
      typeof field.persist !== 'boolean' ||
      typeof field.project !== 'boolean' ||
      typeof field.unit !== 'boolean' ||
      (field.project && field.unit)
    ) {
      return failDefinition(
        code,
        expectedType,
        `Property field "${field.key}" has contradictory projection flags`
      )
    }
    if (field.validate !== undefined && typeof field.validate !== 'function') {
      return failDefinition(
        code,
        expectedType,
        `Property field "${field.key}" has an invalid validator`
      )
    }
    if (
      field.allowedUnits !== undefined &&
      (!Array.isArray(field.allowedUnits) ||
        field.kind !== 'string' ||
        field.allowedUnits.some(
          (unit) => !UNIT_KINDS.has(unit as PropertyUnitKind)
        ) ||
        hasDuplicates(field.allowedUnits as readonly string[]))
    ) {
      return failDefinition(
        code,
        expectedType,
        `Property field "${field.key}" has invalid allowed units`
      )
    }

    const normalizedField: PropertyTypeFieldDefinition = {
      key: field.key,
      kind: field.kind as PropertyValueKind,
      defaultValue: clonePropertyDefinitionValue(field.defaultValue),
      validate: field.validate as ((value: unknown) => boolean) | undefined,
      allowedUnits: field.allowedUnits
        ? field.allowedUnits.length > 0
          ? ([...field.allowedUnits] as PropertyUnitKind[])
          : undefined
        : undefined,
      persist: field.persist,
      project: field.project,
      unit: field.unit
    }
    validateDefault(expectedType, normalizedField, code)
    return normalizedField
  })

  return {
    type: expectedType,
    fields,
    allowDynamicKeys: definition.allowDynamicKeys,
    dynamicReservedKeys: [...definition.dynamicReservedKeys]
  } as PropertyTypeDefinition<TFields>
}

const uniqueKeys = (keys: readonly string[]) => [...new Set(keys)]
const isString = (value: unknown): value is string => typeof value === 'string'

const getConfigRoles = (config: PropertyComponentConfigRegistration) => {
  const defaults = isRecord(config.defaults) ? config.defaults : {}
  const inferredPersistKeys = Object.keys(defaults)
  if (config.children && !inferredPersistKeys.includes(config.children.key)) {
    inferredPersistKeys.push(config.children.key)
  }
  const persistKeys = config.persistKeys ?? inferredPersistKeys
  const unitKeys =
    config.unitKeys ?? persistKeys.filter((key) => key.endsWith('Unit'))
  const valueKeys =
    config.valueKeys ?? persistKeys.filter((key) => !unitKeys.includes(key))
  return { defaults, persistKeys, valueKeys, unitKeys }
}

const projectRegisteredDefinition = <TFields extends object>(
  type: string,
  schema: PropertySchema,
  config: PropertyComponentConfigRegistration
): PropertyTypeDefinition<TFields> => {
  const { defaults, persistKeys, valueKeys, unitKeys } = getConfigRoles(config)
  const schemaKeys = schema.fields.map((field) => field.key)
  const defaultKeys = Object.keys(defaults)
  const knownKeys = new Set(schemaKeys)
  const drift = (message: string): never =>
    failDefinition('PROPERTY_TYPE_DEFINITION_DRIFT', type, message)

  if (
    schema.type !== type ||
    config.type !== type ||
    hasDuplicates(schemaKeys) ||
    hasDuplicates(defaultKeys) ||
    hasDuplicates(persistKeys) ||
    hasDuplicates(valueKeys) ||
    hasDuplicates(unitKeys) ||
    schemaKeys.length !== defaultKeys.length ||
    schemaKeys.some(
      (key) => !Object.prototype.hasOwnProperty.call(defaults, key)
    ) ||
    [...persistKeys, ...valueKeys, ...unitKeys].some(
      (key) => !knownKeys.has(key)
    ) ||
    valueKeys.some((key) => unitKeys.includes(key))
  ) {
    return drift(
      `Property type "${type}" schema and config runtime are not a complete matching definition`
    )
  }

  const persistSet = new Set(persistKeys)
  const valueSet = new Set(valueKeys)
  const unitSet = new Set(unitKeys)
  const fields = schema.fields.map((field) => {
    if (
      !Object.prototype.hasOwnProperty.call(field, 'defaultValue') ||
      !valuesEqual(field.defaultValue, defaults[field.key])
    ) {
      return drift(
        `Property field "${field.key}" schema and runtime defaults have drifted`
      )
    }

    return {
      key: field.key,
      kind: field.kind,
      defaultValue: clonePropertyDefinitionValue(field.defaultValue),
      validate: field.validate as ((value: unknown) => boolean) | undefined,
      allowedUnits: field.allowedUnits ? [...field.allowedUnits] : undefined,
      persist: persistSet.has(field.key),
      project: valueSet.has(field.key),
      unit: unitSet.has(field.key)
    }
  })

  return normalizeDefinition<TFields>(
    type,
    {
      type,
      fields,
      allowDynamicKeys: config.allowDynamicKeys === true,
      dynamicReservedKeys: [...(config.dynamicReservedKeys ?? [])]
    } as unknown as PropertyTypeDefinition<TFields>,
    'PROPERTY_TYPE_DEFINITION_DRIFT'
  )
}

export const getDeclarativePropertyTypeDefinition = <
  TFields extends object = Record<string, unknown>
>(
  type: string
): Readonly<PropertyTypeDefinition<TFields>> | undefined => {
  const schema = getPropertySchema(type)
  const component = getPropertyComponent(type)
  const config = getPropertyComponentConfigDefinition(type)

  if (!schema && !component && !config) return undefined
  if (component && !config) {
    return failDefinition(
      'PROPERTY_TYPE_NOT_DECLARATIVE',
      type,
      `Property type "${type}" uses constructor mode and cannot be redefined declaratively`
    )
  }
  if (!schema || !component || !config) {
    return failDefinition(
      'PROPERTY_TYPE_DEFINITION_DRIFT',
      type,
      `Property type "${type}" has an incomplete schema/runtime registration`
    )
  }

  return projectRegisteredDefinition<TFields>(type, schema, config)
}

const toPropertySchema = <TFields extends object>(
  definition: PropertyTypeDefinition<TFields>
): PropertySchema => ({
  type: definition.type,
  fields: definition.fields.map(
    (field): PropertyFieldSchema => ({
      key: field.key,
      kind: field.kind,
      defaultValue: clonePropertyDefinitionValue(field.defaultValue),
      validate: field.validate,
      allowedUnits: field.allowedUnits ? [...field.allowedUnits] : undefined
    })
  )
})

const toConfigRegistration = <TFields extends object>(
  definition: PropertyTypeDefinition<TFields>,
  current: PropertyComponentConfigRegistration
): PropertyComponentConfigRegistration => ({
  type: definition.type,
  defaults: definition.fields.reduce<Record<string, unknown>>(
    (defaults, field) => {
      defaults[field.key] = clonePropertyDefinitionValue(field.defaultValue)
      return defaults
    },
    {}
  ),
  persistKeys: definition.fields
    .filter((field) => field.persist)
    .map((field) => field.key),
  valueKeys: definition.fields
    .filter((field) => field.project)
    .map((field) => field.key),
  unitKeys: definition.fields
    .filter((field) => field.unit)
    .map((field) => field.key),
  allowDynamicKeys: definition.allowDynamicKeys,
  dynamicReservedKeys: [...definition.dynamicReservedKeys],
  children: current.children ? { ...current.children } : undefined
})

export const createPropertyComponentFromConfig = (
  definition: PropertyComponentConfigRegistration
): PropertyComponentConstructor => {
  const defaults = isRecord(definition.defaults) ? definition.defaults : {}
  const allowDynamicKeys = definition.allowDynamicKeys === true
  const children = definition.children
  const fixedKeys = new Set(Object.keys(defaults))
  if (children) fixedKeys.add(children.key)
  const reservedDynamicKeys = new Set(
    uniqueKeys([
      'id',
      'type',
      ...fixedKeys,
      ...(definition.dynamicReservedKeys ?? [])
    ])
  )
  const isAllowedDynamicKey = (key: string) => !reservedDynamicKeys.has(key)
  const { persistKeys, valueKeys, unitKeys } = getConfigRoles(definition)

  const normalizeChildrenValue = (value: unknown): string[] | null => {
    if (!children || !Array.isArray(value)) return null
    const mode = children.mode ?? 'ids'
    if (mode === 'ids') return value.every(isString) ? value : null

    const childIds: string[] = []
    const accessor = getPropertyComponentAccessor()
    value.forEach((item) => {
      if (isString(item)) {
        childIds.push(item)
        return
      }
      if (!isRecord(item)) return

      const mapped = children.toChildData ? children.toChildData(item) : item
      if (!isRecord(mapped)) return
      const childData: Record<string, unknown> = {
        ...mapped,
        type: children.childType
      }
      const childId = isString(childData.id)
        ? childData.id
        : isString(item.id)
          ? item.id
          : ''
      if (!childId && 'id' in childData) delete childData.id

      const existing = childId ? accessor.getPropertyById(childId) : undefined
      if (
        existing &&
        typeof existing.get === 'function' &&
        existing.get('type') === children.childType &&
        typeof existing.set === 'function'
      ) {
        Object.entries(childData).forEach(([key, childValue]) => {
          if (key === 'id' || key === 'type') return
          ;(
            existing as unknown as {
              set: (field: string, value: unknown) => void
            }
          ).set(key, childValue)
        })
        const existingId = existing.get('id')
        if (isString(existingId)) childIds.push(existingId)
        return
      }

      const created = accessor.createComponent(
        childId ? { id: childId, ...childData } : childData
      )
      if (!created) return
      accessor.addToMap(created)
      const createdId = created.get('id')
      if (isString(createdId)) childIds.push(createdId)
    })
    return childIds
  }

  const toChildrenValue = (value: unknown): unknown => {
    if (!children?.toValue || !Array.isArray(value)) return value
    const accessor = getPropertyComponentAccessor()
    return value
      .filter(isString)
      .map((childId) => {
        const child = accessor.getPropertyById(childId)
        if (!child || typeof child.get !== 'function') return null
        return children.toValue?.(
          child as unknown as { get: (key: string) => unknown },
          childId
        )
      })
      .filter((item) => item !== null)
  }

  class ConfiguredPropertyComponent extends BasePropertyComponent<PropertyComponentInstanceDataTypes> {
    data!: PropertyComponentInstanceDataTypes
    private childSubscriptions = new Map<string, () => void>()

    constructor(data: Partial<PropertyComponentRawData>) {
      super()
      this.data = {
        id: '',
        type: definition.type,
        ...clonePropertyDefinitionRecord(defaults)
      } as PropertyComponentInstanceDataTypes
      this.load(data as PropertyComponentRawData)
    }

    private syncChildSubscriptions(childIds: string[]): void {
      if (!children) return
      const nextIds = new Set(childIds.filter(isString))
      this.childSubscriptions.forEach((unsubscribe, childId) => {
        if (nextIds.has(childId)) return
        unsubscribe()
        this.childSubscriptions.delete(childId)
      })

      const accessor = getPropertyComponentAccessor()
      nextIds.forEach((childId) => {
        if (this.childSubscriptions.has(childId)) return
        const child = accessor.getPropertyById(childId)
        if (!child || child.get('type') !== children.childType) return
        const unsubscribe = child.on((change) => {
          this.emitChange({
            id: this.get('id'),
            key: children.key,
            before: change.before,
            after: change.after,
            options: change.options
          })
        })
        this.childSubscriptions.set(childId, unsubscribe)
      })
    }

    load(data: PropertyComponentRawData): void {
      this.data.id = typeof data.id === 'string' ? data.id : this.data.id
      const rawData: Record<string, unknown> = isRecord(data) ? data : {}
      let nextChildIds: string[] | null = null
      persistKeys.forEach((key) => {
        if (children && key === children.key) {
          const normalized = normalizeChildrenValue(rawData[key])
          if (normalized) {
            this.data[key as keyof PropertyComponentInstanceDataTypes] =
              normalized as never
            nextChildIds = normalized
          }
          return
        }
        if (!(key in rawData)) return
        this.assignLoadedValue(
          key as keyof PropertyComponentInstanceDataTypes,
          rawData[key]
        )
      })

      if (children) {
        const fallbackIds =
          nextChildIds ??
          ((this.data as unknown as Record<string, unknown>)[children.key] as
            | string[]
            | undefined) ??
          []
        this.syncChildSubscriptions(
          Array.isArray(fallbackIds) ? fallbackIds : []
        )
      }

      if (!allowDynamicKeys) return
      Object.entries(rawData).forEach(([key, value]) => {
        if (!isAllowedDynamicKey(key) || value === undefined) return
        ;(this.data as unknown as Record<string, unknown>)[key] =
          clonePropertyDefinitionValue(value)
      })
    }

    save(): PropertyComponentRawData {
      const saved = super.save() as Record<string, unknown>
      const data = this.data as unknown as Record<string, unknown>
      const dynamicPersistKeys = allowDynamicKeys
        ? Object.keys(data).filter(isAllowedDynamicKey)
        : []
      uniqueKeys([...persistKeys, ...dynamicPersistKeys]).forEach((key) => {
        const current = data[key]
        if (current !== undefined) saved[key] = current
      })
      return saved as PropertyComponentRawData
    }

    getValue(): Record<string, DataTypes> {
      const value: Record<string, DataTypes> = {}
      const data = this.data as unknown as Record<string, unknown>
      const dynamicValueKeys = allowDynamicKeys
        ? Object.keys(data).filter(isAllowedDynamicKey)
        : []
      uniqueKeys([...valueKeys, ...dynamicValueKeys]).forEach((key) => {
        const current = this.get(
          key as keyof PropertyComponentInstanceDataTypes
        )
        if (current !== undefined) {
          value[key] = toChildrenValue(current) as DataTypes
        }
      })
      return value
    }

    getUnit(): Record<string, Unit> {
      const units: Record<string, Unit> = {}
      unitKeys.forEach((key) => {
        const current = this.get(
          key as keyof PropertyComponentInstanceDataTypes
        )
        if (current !== undefined) units[key] = current as Unit
      })
      return units
    }

    set<K extends keyof PropertyComponentInstanceDataTypes>(
      key: K,
      value: PropertyComponentInstanceDataTypes[K],
      options?: EvnetOptions
    ): void {
      if (children && key === (children.key as K)) {
        const normalized = normalizeChildrenValue(value)
        if (!normalized) return
        super.set(
          key,
          normalized as unknown as PropertyComponentInstanceDataTypes[K],
          options
        )
        this.syncChildSubscriptions(normalized)
        return
      }
      if (
        allowDynamicKeys &&
        typeof key === 'string' &&
        isAllowedDynamicKey(key)
      ) {
        if (!(key in this.data)) {
          ;(this.data as unknown as Record<string, unknown>)[key] = value
        }
        super.set(key, value, options)
        return
      }
      if (!(key in this.data)) return
      super.set(key, value, options)
    }

    dispose(): void {
      this.childSubscriptions.forEach((unsubscribe) => unsubscribe())
      this.childSubscriptions.clear()
    }
  }

  return ConfiguredPropertyComponent as PropertyComponentConstructor
}

const restoreRegistrations = (
  type: string,
  schema: PropertySchema,
  component: PropertyComponentConstructor,
  config: PropertyComponentConfigRegistration
): void => {
  restorePropertySchemaAfterFailedDeclarativeCommit(schema)
  restorePropertyComponentAfterFailedDeclarativeCommit(type, component, config)
}

const assertPropertyTypeUnused = (
  type: string,
  manager: PropsManager
): void => {
  const propertyIds = manager.getPropertyIdsByType(type)
  if (propertyIds.length === 0) return

  throw new PropertyRegistrationError({
    ok: false,
    code: 'PROPERTY_TYPE_IN_USE',
    type,
    propertyIds,
    removedSchema: false,
    removedComponent: false
  })
}

export const commitDeclarativePropertyTypeDefinition = <
  TFields extends object = Record<string, unknown>
>(
  type: string,
  definition: PropertyTypeDefinition<TFields>,
  manager: PropsManager = propsManager
): Readonly<PropertyTypeDefinition<TFields>> => {
  const current = getDeclarativePropertyTypeDefinition<TFields>(type)
  if (!current) {
    return failDefinition(
      'PROPERTY_TYPE_DEFINITION_DRIFT',
      type,
      `Property type "${type}" is not registered`
    )
  }

  assertPropertyTypeUnused(type, manager)

  const currentSchema = getPropertySchema(type)
  const currentComponent = getPropertyComponent(type)
  const currentConfig = getPropertyComponentConfigDefinition(type)
  if (!currentSchema || !currentComponent || !currentConfig) {
    return failDefinition(
      'PROPERTY_TYPE_DEFINITION_DRIFT',
      type,
      `Property type "${type}" changed while preparing redefinition`
    )
  }

  const normalized = normalizeDefinition<TFields>(type, definition)
  const nextSchema = toPropertySchema(normalized)
  const nextConfig = toConfigRegistration(normalized, currentConfig)
  const nextComponent = createPropertyComponentFromConfig(nextConfig)

  // Definition validators are app-provided synchronous callbacks. Recheck
  // usage after every staging callback and immediately before registry writes.
  assertPropertyTypeUnused(type, manager)

  try {
    propertySchemaRegistry.unregister(type)
    propertyComponentRegistry.unregister(type)
    registerPropertySchema(nextSchema)
    registerPropertyComponent(type, nextComponent, undefined, nextConfig)
  } catch (error) {
    restoreRegistrations(type, currentSchema, currentComponent, currentConfig)
    return failDefinition(
      'PROPERTY_TYPE_DEFINITION_COMMIT_FAILED',
      type,
      `Property type "${type}" commit failed and the previous definition was restored`,
      error
    )
  }
  return normalized
}
