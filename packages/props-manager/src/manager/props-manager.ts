import {
  PropertyType,
  PROPS_ACTIONS,
  SharedDataChannelNames,
  isRecord
} from '@asyra/utils'
import type {
  EVENT_OPTIONS,
  UpdatePropertyChange,
  PropertyComponentInstanceDataTypes,
  PropertyComponentInstanceTypes,
  PropertyComponentRawData,
  PropsChange,
  PropsComponentRawData,
  EvnetOptions
} from '@asyra/utils'
import { EventTypes, updateTransaction } from '@asyra/reactive-events'
import { createProperty } from '../factories/create-property'
import { setComponentAccessor } from './component-accessor'

export interface PropsLoadDiagnostic {
  path: string
  message: string
}

class PropsManager {
  _components: Map<string, PropertyComponentInstanceTypes> = new Map()
  _deletedMap: Map<string, PropertyComponentInstanceTypes> = new Map()
  changes: PropsChange[] = []

  constructor() {
    setComponentAccessor({
      getPropertyById: (propertyId) => this.getPropertyById(propertyId),
      addToMap: (component) => this.addToMap(component),
      createComponent: (data) =>
        createProperty(
          data as Partial<PropertyComponentRawData>
        ) as PropertyComponentInstanceTypes
    })
  }

  validateLoadData(data: unknown): {
    data: PropsComponentRawData
    diagnostics: PropsLoadDiagnostic[]
  } {
    const diagnostics: PropsLoadDiagnostic[] = []
    const sanitized: PropsComponentRawData = {}

    if (!isRecord(data)) {
      diagnostics.push({
        path: 'props',
        message: 'Expected object map for props data'
      })
      return { data: sanitized, diagnostics }
    }

    Object.entries(data).forEach(([componentId, rawComponent]) => {
      if (!isRecord(rawComponent)) {
        diagnostics.push({
          path: `props.${componentId}`,
          message: 'Skipped non-object property component during load'
        })
        return
      }

      const rawType = rawComponent.type
      if (typeof rawType !== 'string' || rawType.length === 0) {
        diagnostics.push({
          path: `props.${componentId}.type`,
          message: 'Skipped property component with invalid type during load'
        })
        return
      }

      const normalizedId =
        typeof rawComponent.id === 'string' && rawComponent.id.length > 0
          ? rawComponent.id
          : componentId

      sanitized[normalizedId] = {
        ...rawComponent,
        id: normalizedId,
        type: rawType
      } as PropertyComponentRawData
    })

    return { data: sanitized, diagnostics }
  }

  load(data: PropsComponentRawData | unknown) {
    const validated = this.validateLoadData(data).data
    this.dispose()

    Object.keys(validated).forEach((componentId) => {
      const newProperty = createProperty(
        validated[componentId]
      ) as PropertyComponentInstanceTypes
      this.addToMap(newProperty)
    })
  }

  save(): PropsComponentRawData {
    const data = {} as PropsComponentRawData
    this._components.forEach((component, componentId) => {
      data[componentId] = component.save()
    })

    return data
  }

  addChange(change: PropsChange) {
    this.changes.push(change)
  }

  cleanChanges() {
    this.changes = []
  }

  getPropertyById(
    propertyId: string
  ): PropertyComponentInstanceTypes | undefined {
    return this._components.get(propertyId)
  }

  addToMap(component: PropertyComponentInstanceTypes) {
    const comId = component.get('id')
    if (!component || !comId) {
      return
    }

    this.removeFromDeletedMap(comId)
    this._components.set(comId, component)
  }

  removeFromMap(componentId: string) {
    const component = this.getPropertyById(componentId)
    if (!component) {
      return
    }

    this.addToDeletedMap(component)
    this._components.delete(componentId)
  }

  addToDeletedMap(component: PropertyComponentInstanceTypes) {
    this._deletedMap.set(component.get('id'), component)
  }

  removeFromDeletedMap(componentId: string) {
    this._deletedMap.delete(componentId)
  }

  getRestoreComponentById(componentId: string) {
    return this._deletedMap.get(componentId)
  }

  addChangeForAddProperty(property: PropertyComponentInstanceTypes) {
    this.addChange({
      eventName: EventTypes.ADD_PROPERTY,
      data: [property.save()],
      action: PROPS_ACTIONS.ADD_PROPERTY,
      undoType: EventTypes.REMOVE_PROPERTY,
      undoAction: EventTypes.REMOVE_PROPERTY
    })
  }

  addChangeForRemoveProperty(property: PropertyComponentInstanceTypes) {
    this.addChange({
      eventName: EventTypes.REMOVE_PROPERTY,
      data: [property.save()],
      action: PROPS_ACTIONS.REMOVE_PROPERTY,
      undoType: EventTypes.ADD_PROPERTY,
      undoAction: EventTypes.ADD_PROPERTY
    })
  }

  createProperty(propData: Partial<PropertyComponentRawData>) {
    if (!propData.type) {
      throw new Error('Type is required!')
    }

    const newProperty = createProperty({
      ...propData,
      type: propData.type as PropertyType
    }) as PropertyComponentInstanceTypes
    this.addChangeForAddProperty(newProperty)
    return newProperty
  }

  addProperty(
    propComponents: PropertyComponentInstanceTypes[]
  ): Record<PropertyType, string> {
    return propComponents.reduce(
      (acc, com) => {
        if (!com) {
          return acc
        }

        this.addToMap(com)
        acc[com.get('type')] = com.get('id')
        return acc
      },
      {} as Record<PropertyType, string>
    )
  }

  removeProperty(propComponentIds: string[], _options?: EVENT_OPTIONS) {
    propComponentIds.forEach((propComponentId) => {
      this.removeFromMap(propComponentId)
    })
  }

  updatePropsData<K extends string>(
    componentId: string,
    key: K,
    data: any,
    options?: EvnetOptions
  ) {
    const component = this.getPropertyById(componentId)
    if (!component) {
      return
    }

    const comp = component as any
    if (options) {
      comp.set(key, data, options)
      return
    }

    comp.set(key, data)
  }

  updatePropertyById<K extends string>(
    propertyId: string,
    key: K,
    data: PropertyComponentInstanceDataTypes[K],
    owner?: {
      ownerElementId: string
      ownerPropertyName: string
    },
    options?: EvnetOptions
  ) {
    const previousChangeCount = this.changes.length
    this.updatePropsData(propertyId, key, data, options)

    if (!owner || this.changes.length <= previousChangeCount) {
      return
    }

    const nextChange = this.changes[this.changes.length - 1]
    if (nextChange?.action !== PROPS_ACTIONS.UPDATE_PROPERTY) {
      return
    }

    const updateChange = nextChange as UpdatePropertyChange
    if (updateChange.id !== propertyId || updateChange.key !== key) {
      return
    }

    Object.assign(updateChange, owner)
  }

  commitChanges(options?: EVENT_OPTIONS) {
    this.changes.forEach((change) => {
      const changeOptions = change.options ?? options
      const routedOptions: EVENT_OPTIONS = {
        ...(changeOptions ?? {}),
        shared: changeOptions?.shared ?? SharedDataChannelNames.PROPS
      }
      updateTransaction(change.eventName, change, routedOptions)
    })
    this.cleanChanges()
  }

  dispose() {
    this._components.clear()
    this._deletedMap.clear()
    this.changes = []
  }

  reset() {
    this.dispose()
  }
}

const propsManager = new PropsManager()

export default propsManager
export { PropsManager }
