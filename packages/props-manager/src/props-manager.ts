import { OWNER, PropAlias, PropertyTypes, PROPS_ACTIONS } from '@asra/utils'
import type {
  PropertyComponentInstanceTypes,
  PropsChange,
  PropsComponentRawData
} from '@asra/utils'
import { initPropXSubscribes } from './subscribes'
import { createProperty } from './utils'
import { EventTypes } from '@asra/reactive-events'

initPropXSubscribes()

class PropsManager {
  _components: Map<string, PropertyComponentInstanceTypes> = new Map()
  _deletedMap: Map<string, PropertyComponentInstanceTypes> = new Map()
  changes: PropsChange[] = []

  load(data: PropsComponentRawData) {
    Object.keys(data).forEach((componentId) => {
      const newProperty = createProperty(
        data[componentId]
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

  getComponentById(
    componentId: string
  ): PropertyComponentInstanceTypes | undefined {
    return this._components.get(componentId)
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
    const component = this.getComponentById(componentId)
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
    const restoredComponent = this._deletedMap.get(componentId)
    return restoredComponent
  }

  addChangeForAddProperty(property: PropertyComponentInstanceTypes) {
    this.addChange({
      eventName: EventTypes.ADD_PROPERTY,
      data: [property.save()],
      action: PROPS_ACTIONS.ADD_PROPERTY,
      owner: OWNER.PROPS,
      undoType: EventTypes.REMOVE_PROPERTY,
      undoAction: EventTypes.REMOVE_PROPERTY
    })
  }

  addChangeForRemoveProperty(property: PropertyComponentInstanceTypes) {
    this.addChange({
      eventName: EventTypes.REMOVE_PROPERTY,
      data: [property.save()],
      action: PROPS_ACTIONS.REMOVE_PROPERTY,
      owner: OWNER.PROPS,
      undoType: EventTypes.ADD_PROPERTY,
      undoAction: EventTypes.ADD_PROPERTY
    })
  }

  createProperty(type: PropertyTypes) {
    const newProperty = createProperty({
      type
    }) as PropertyComponentInstanceTypes
    this.addChangeForAddProperty(newProperty)
    return newProperty
  }

  addProperty(
    propComponents: PropertyComponentInstanceTypes[]
  ): Record<PropertyTypes, string> {
    return propComponents.reduce(
      (acc, com) => {
        if (!com) {
          return acc
        }

        this.addToMap(com)
        acc[com.get('type')] = com.get('id')
        return acc
      },
      {} as Record<PropertyTypes, string>
    )
  }
}

const propsManager = new PropsManager()
console.log(propsManager)
export default propsManager
export { PropsManager }
