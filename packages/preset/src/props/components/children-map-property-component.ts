import {
  BasePropertyComponent,
  getPropertyComponentAccessor,
  type PropertyComponentDefinition
} from '@asyra/core'
import {
  id,
  isRecord,
  loadId,
  IDTypes,
  type DataTypes,
  type PropertyComponentRawData,
  type Unit
} from '@asyra/utils'
import { createPresetRegistration } from '../../registration'

interface ChildrenMapAttrs {
  id: string
  type: string
  [key: string]: unknown
}

interface ChildGetter {
  get: (key: string) => unknown
}

interface ChildEntry {
  id: string
  data: Record<string, unknown>
}

interface ChildrenMapPropertyConfig {
  type: string
  key: string
  childType: string
  childIdType?: string
  toChildData: (
    item: Record<string, unknown>,
    childId: string
  ) => Record<string, unknown> | null
  toValue: (
    child: ChildGetter,
    childId: string
  ) => Record<string, unknown> | null
}

const syncLoadedId = (childIdType: string | undefined, childId: string) => {
  if (!childIdType || childId.length === 0) {
    return
  }

  loadId(childId, childIdType)
}

const toStringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null
  }

  if (!value.every((item) => typeof item === 'string')) {
    return null
  }

  return [...value]
}

const toChildEntries = (
  value: unknown,
  toChildData: ChildrenMapPropertyConfig['toChildData']
): ChildEntry[] | null => {
  if (Array.isArray(value)) {
    const entries: ChildEntry[] = []
    value.forEach((item) => {
      if (!isRecord(item)) {
        return
      }

      const childId = typeof item.id === 'string' ? item.id : ''
      const childData = toChildData(item, childId)
      if (!childData) {
        return
      }

      entries.push({ id: childId, data: childData })
    })

    return entries
  }

  if (isRecord(value)) {
    const entries: ChildEntry[] = []
    Object.entries(value).forEach(([childId, child]) => {
      if (!isRecord(child)) {
        return
      }

      const childData = toChildData(child, childId)
      if (!childData) {
        return
      }

      entries.push({ id: childId, data: childData })
    })

    return entries
  }

  return null
}

export const createChildrenMapPropertyComponentDefinition = (
  config: ChildrenMapPropertyConfig
): PropertyComponentDefinition => {
  class ChildrenMapPropertyComponent extends BasePropertyComponent<ChildrenMapAttrs> {
    data: ChildrenMapAttrs = {
      id: '',
      type: config.type,
      [config.key]: []
    }
    private childSubscriptions = new Map<string, () => void>()

    constructor(data: Partial<ChildrenMapAttrs>) {
      super()
      this.data.id = typeof data.id === 'string' ? data.id : this.data.id
      this.data.type = config.type
      this.load(data as PropertyComponentRawData)
    }

    private getChildIds(): string[] {
      const raw = this.data[config.key]
      if (!Array.isArray(raw)) {
        return []
      }

      return raw.filter((value): value is string => typeof value === 'string')
    }

    private upsertChildren(entries: ChildEntry[]): string[] {
      const accessor = getPropertyComponentAccessor()
      const nextIds: string[] = []

      entries.forEach((entry) => {
        const childId = entry.id
        if (childId) {
          syncLoadedId(config.childIdType, childId)
        }

        const existing = childId ? accessor.getPropertyById(childId) : undefined
        if (
          existing &&
          typeof existing.get === 'function' &&
          typeof existing.set === 'function' &&
          existing.get('type') === config.childType
        ) {
          Object.entries(entry.data).forEach(([key, value]) => {
            if (key === 'id' || key === 'type') {
              return
            }

            ;(
              existing as unknown as {
                set: (field: string, val: unknown) => void
              }
            ).set(key, value)
          })

          const existingId = existing.get('id')
          if (typeof existingId === 'string' && existingId.length > 0) {
            nextIds.push(existingId)
          }
          return
        }

        const created = accessor.createComponent(
          childId
            ? {
                id: childId,
                type: config.childType,
                ...entry.data
              }
            : {
                id: id(config.childIdType || IDTypes.PROPS),
                type: config.childType,
                ...entry.data
              }
        )
        if (!created) {
          return
        }

        accessor.addToMap(created)
        const createdId = created.get('id')
        if (typeof createdId !== 'string' || createdId.length === 0) {
          return
        }

        syncLoadedId(config.childIdType, createdId)
        nextIds.push(createdId)
      })

      return nextIds
    }

    private syncChildSubscriptions(childIds: string[]) {
      const nextIds = new Set(childIds.filter((id) => typeof id === 'string'))
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
        if (!child || child.get('type') !== config.childType) {
          return
        }

        const unsubscribe = child.on((change) => {
          this.emitChange({
            id: this.get('id'),
            key: config.key,
            before: change.before,
            after: change.after,
            options: change.options
          })
        })

        this.childSubscriptions.set(childId, unsubscribe)
      })
    }

    private resolveChildIds(value: unknown): string[] | null {
      const stringIds = toStringArray(value)
      if (stringIds) {
        stringIds.forEach((childId) =>
          syncLoadedId(config.childIdType, childId)
        )
        return stringIds
      }

      const entries = toChildEntries(value, config.toChildData)
      if (!entries) {
        return null
      }

      return this.upsertChildren(entries)
    }

    protected isValidKey(key: keyof ChildrenMapAttrs): boolean {
      return typeof key === 'string' && key === config.key
    }

    set<K extends keyof ChildrenMapAttrs>(
      key: K,
      value: ChildrenMapAttrs[K]
    ): void {
      if (typeof key !== 'string' || key !== config.key) {
        return
      }

      const childIds = this.resolveChildIds(value)
      if (!childIds) {
        return
      }

      this.data[config.key] = childIds
      super.set(key, childIds as ChildrenMapAttrs[K])
      this.syncChildSubscriptions(childIds)
    }

    load(data: PropertyComponentRawData): void {
      this.data.id = typeof data.id === 'string' ? data.id : this.data.id
      const childIds = this.resolveChildIds(
        (data as Record<string, unknown>)[config.key]
      )
      this.data[config.key] = childIds ?? []
      this.syncChildSubscriptions(this.getChildIds())
    }

    save(): PropertyComponentRawData {
      return {
        ...super.save(),
        [config.key]: [...this.getChildIds()]
      } as PropertyComponentRawData
    }

    getValue(): Record<string, DataTypes> {
      const accessor = getPropertyComponentAccessor()
      const value: Record<string, unknown> = {}

      this.getChildIds().forEach((childId) => {
        const child = accessor.getPropertyById(childId)
        if (!child || child.get('type') !== config.childType) {
          return
        }

        const childValue = config.toValue(child as ChildGetter, childId)
        if (!childValue) {
          return
        }

        value[childId] = childValue
      })

      return {
        [config.key]: value
      }
    }

    getUnit(): Record<string, Unit> {
      return {}
    }
  }

  return {
    type: config.type,
    constructor: ChildrenMapPropertyComponent,
    registration: createPresetRegistration([
      {
        name: config.key,
        target: { kind: 'property', key: config.childType },
        onTargetUnregister: 'unregister-source'
      }
    ])
  }
}
