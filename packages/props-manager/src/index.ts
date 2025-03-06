import { PropAlias, PropertyTypes } from '@asra/utils'
import type {
  PropertyComponentInstanceTypes,
  PropertyComponentRawData
} from '@asra/utils'
import { initPropXSubscribes } from './subscribes'
import { createProperty } from './utils'

initPropXSubscribes()

type PropRawData = Record<string, PropertyComponentRawData>

class PropsManager {
  _components: Map<string, PropertyComponentInstanceTypes> = new Map()
  _deletedMap: Map<string, PropertyComponentInstanceTypes> = new Map()

  constructor(data?: PropRawData) {
    if (data) {
      this.load(data)
    }
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

  load(data?: PropRawData) {
    // TODO: Load and create all props components
    console.log('props load data', data)
  }

  _createProperty(propName: PropertyTypes) {
    return createProperty(propName)
  }

  addProperty(propNames: PropertyTypes[]): Record<PropertyTypes, string> {
    const propComponents = propNames.map((propName) => {
      const propKey = (PropAlias[propName] || propName) as PropertyTypes
      const newProperty = this._createProperty(propKey)
      if (newProperty) {
        this.addToMap(newProperty)
      }
      return newProperty
    })

    return propComponents.reduce(
      (acc, com) => {
        if (!com) {
          return acc
        }

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
