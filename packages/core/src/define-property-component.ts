import propsManager, {
  BasePropertyComponent,
  getPropertyComponentAccessor,
  getPropertyComponent,
  getPropertyComponentConfigDefinition,
  propertyComponentRegistry,
  registerPropertyComponent,
  replacePropertyComponentRegistration,
  type PropertyChildRelationDefinition,
  type PropertyComponentConfigRegistration,
  type PropertyComponentConstructor,
  type RegisterPropertyComponentOptions,
  type PropsManager
} from '@asyra/props-manager'
import type {
  DataTypes,
  EvnetOptions,
  PropertyComponentInstanceDataTypes,
  PropertyComponentRawData,
  RegistrationContractErrorCode,
  RegistrationGraphOperation,
  RegistrationRelationMetadata,
  RelationOperationSuccess,
  Unit
} from '@asyra/utils'
import { RegistrationRelationError } from '@asyra/utils'

export interface PropertyComponentConstructorDefinition {
  type: string
  constructor: PropertyComponentConstructor
  options?: RegisterPropertyComponentOptions
}

export interface PropertyComponentConfigDefinition
  extends PropertyComponentConfigRegistration {
  options?: RegisterPropertyComponentOptions
}

export type PropertyComponentDefinition =
  | PropertyComponentConstructorDefinition
  | PropertyComponentConfigDefinition

export interface PropertyChildRelationMetadata
  extends RegistrationRelationMetadata,
    PropertyChildRelationDefinition {
  parentPropertyType: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toRecord = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {}

const cloneValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item))
  }

  if (isRecord(value)) {
    return Object.entries(value).reduce<Record<string, unknown>>(
      (acc, [key, item]) => {
        acc[key] = cloneValue(item)
        return acc
      },
      {}
    )
  }

  return value
}

const cloneRecord = (value: Record<string, unknown>) =>
  cloneValue(value) as Record<string, unknown>

const cloneConfigDefinition = (
  definition: PropertyComponentConfigRegistration
): PropertyComponentConfigDefinition => ({
  ...definition,
  defaults: definition.defaults ? cloneRecord(definition.defaults) : undefined,
  persistKeys: definition.persistKeys ? [...definition.persistKeys] : undefined,
  valueKeys: definition.valueKeys ? [...definition.valueKeys] : undefined,
  unitKeys: definition.unitKeys ? [...definition.unitKeys] : undefined,
  dynamicReservedKeys: definition.dynamicReservedKeys
    ? [...definition.dynamicReservedKeys]
    : undefined,
  children: definition.children ? { ...definition.children } : undefined
})

const uniqueKeys = (keys: string[]) => [...new Set(keys)]
const isString = (value: unknown): value is string => typeof value === 'string'

const createPropertyComponentFromConfig = (
  definition: PropertyComponentConfigDefinition
): PropertyComponentConstructor => {
  const defaults = toRecord(definition.defaults)
  const allowDynamicKeys = definition.allowDynamicKeys === true
  const reservedDynamicKeys = new Set(
    uniqueKeys(['id', 'type', ...(definition.dynamicReservedKeys ?? [])])
  )
  const children = definition.children
  const isAllowedDynamicKey = (key: string) => !reservedDynamicKeys.has(key)
  const inferredPersistKeys = Object.keys(defaults)
  if (children && !inferredPersistKeys.includes(children.key)) {
    inferredPersistKeys.push(children.key)
  }
  const persistKeys = uniqueKeys(definition.persistKeys ?? inferredPersistKeys)
  const inferredUnitKeys = persistKeys.filter((key) => key.endsWith('Unit'))
  const unitKeys = uniqueKeys(definition.unitKeys ?? inferredUnitKeys)
  const inferredValueKeys = persistKeys.filter((key) => !unitKeys.includes(key))
  const valueKeys = uniqueKeys(definition.valueKeys ?? inferredValueKeys)

  const normalizeChildrenValue = (value: unknown): string[] | null => {
    if (!children || !Array.isArray(value)) {
      return null
    }

    const mode = children.mode ?? 'ids'
    if (mode === 'ids') {
      return value.every(isString) ? (value as string[]) : null
    }

    const childIds: string[] = []
    const accessor = getPropertyComponentAccessor()

    value.forEach((item) => {
      if (isString(item)) {
        childIds.push(item)
        return
      }

      if (!isRecord(item)) {
        return
      }

      const mapped = children.toChildData ? children.toChildData(item) : item
      if (!isRecord(mapped)) {
        return
      }

      const childData: Record<string, unknown> = {
        ...mapped,
        type: children.childType
      }
      const childId = isString(childData.id)
        ? childData.id
        : isString(item.id)
          ? item.id
          : ''
      if (!childId && 'id' in childData) {
        delete childData.id
      }

      const existing = childId ? accessor.getPropertyById(childId) : undefined
      if (
        existing &&
        typeof existing.get === 'function' &&
        existing.get('type') === children.childType &&
        typeof existing.set === 'function'
      ) {
        Object.entries(childData).forEach(([key, childValue]) => {
          if (key === 'id' || key === 'type') {
            return
          }

          ;(
            existing as unknown as {
              set: (field: string, val: unknown) => void
            }
          ).set(key, childValue)
        })

        const existingId = existing.get('id')
        if (isString(existingId)) {
          childIds.push(existingId)
        }
        return
      }

      const created = accessor.createComponent(
        childId ? { id: childId, ...childData } : childData
      )
      if (!created) {
        return
      }

      accessor.addToMap(created)
      const createdId = created.get('id')
      if (isString(createdId)) {
        childIds.push(createdId)
      }
    })

    return childIds
  }

  const toChildrenValue = (value: unknown): unknown => {
    if (!children || !children.toValue || !Array.isArray(value)) {
      return value
    }

    const toValue = children.toValue
    const accessor = getPropertyComponentAccessor()
    return value
      .filter(isString)
      .map((childId) => {
        const child = accessor.getPropertyById(childId)
        if (!child || typeof child.get !== 'function') {
          return null
        }

        return toValue(
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
        ...cloneRecord(defaults)
      } as PropertyComponentInstanceDataTypes
      this.load(data as PropertyComponentRawData)
    }

    private syncChildSubscriptions(childIds: string[]) {
      if (!children) {
        return
      }

      const nextIds = new Set(childIds.filter(isString))
      this.childSubscriptions.forEach((unsubscribe, childId) => {
        if (nextIds.has(childId)) {
          return
        }

        unsubscribe()
        this.childSubscriptions.delete(childId)
      })

      const accessor = getPropertyComponentAccessor()
      nextIds.forEach((childId) => {
        if (this.childSubscriptions.has(childId)) {
          return
        }

        const child = accessor.getPropertyById(childId)
        if (!child || child.get('type') !== children.childType) {
          return
        }

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
      const rawData = toRecord(data)
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

        if (!(key in rawData)) {
          return
        }

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

      if (!allowDynamicKeys) {
        return
      }

      Object.entries(rawData).forEach(([key, value]) => {
        if (!isAllowedDynamicKey(key) || value === undefined) {
          return
        }

        ;(this.data as unknown as Record<string, unknown>)[key] = value
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
        if (current !== undefined) {
          saved[key] = current
        }
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
        if (current !== undefined) {
          units[key] = current as Unit
        }
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
        if (!normalized) {
          return
        }

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

      if (!(key in this.data)) {
        return
      }

      super.set(key, value, options)
    }

    dispose(): void {
      this.childSubscriptions.forEach((unsubscribe) => unsubscribe())
      this.childSubscriptions.clear()
    }
  }

  return ConfiguredPropertyComponent as PropertyComponentConstructor
}

const relationFailure = (
  code: RegistrationContractErrorCode,
  operation: RegistrationGraphOperation,
  message: string,
  details: Partial<RegistrationRelationError['result']> = {}
): never => {
  throw new RegistrationRelationError({
    ok: false,
    code,
    operation,
    message,
    ...details
  })
}

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
  replacePropertyComponentRegistration(
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
  replacePropertyComponentRegistration(
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
