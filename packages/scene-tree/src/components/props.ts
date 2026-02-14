import { PropertyType, PropertyTypes } from '@asyra/utils'
import type {
  PropertyComponentInstanceDataTypes,
  PropsRawData
} from '@asyra/utils'
import { removeProperty } from '@asyra/reactive-events'
import propsManager from '@asyra/props-manager'

type PropsDataType = Partial<PropsRawData>

const PROP_NAMES: PropertyType[] = [
  PropertyTypes.POSITION,
  PropertyTypes.DIMENSION
]

type AliasKeys = 'x' | 'y' | 'width' | 'height'

const PROP_ALIAS: Record<AliasKeys, PropertyType> = {
  x: PropertyTypes.POSITION,
  y: PropertyTypes.POSITION,
  width: PropertyTypes.DIMENSION,
  height: PropertyTypes.DIMENSION
}

class Props {
  elementId: string
  position?: string
  dimension?: string

  constructor(elementId: string, data?: PropsDataType) {
    this.elementId = elementId

    if (data) {
      this.load(data)
    } else {
      this.init()
    }
  }

  init() {
    const propertyComponents = PROP_NAMES.map((propName) =>
      propsManager.createProperty({ type: propName })
    )
    const propIdsMap = propsManager.addProperty(propertyComponents)
    propsManager.commitChanges()
    if (!propIdsMap) {
      return
    }

    PROP_NAMES.forEach((propName) => {
      (this as any)[propName] = propIdsMap[propName]
    })
  }

  load(data: PropsDataType = {}): void {
    const propertyComponents = PROP_NAMES.map((propName) => {
      const propId = (data as any)[propName]
      const propComponent = propId
        ? propsManager.getComponentById(propId)
        : null
      if (propComponent) {
        // Restore existing prop component
        return propComponent
      } else {
        // Create new prop component
        return propsManager.createProperty({ type: propName })
      }
    })
    const propIdsMap = propsManager.addProperty(propertyComponents)
    if (!propIdsMap) {
      return
    }

    PROP_NAMES.forEach((propName) => {
      (this as any)[propName] = propIdsMap[propName]
    })
  }

  save(): PropsRawData {
    return PROP_NAMES.reduce((acc, propName) => {
      const key = propName as keyof PropsRawData
      acc[key] = this[key] as string
      return acc
    }, {} as PropsRawData)
  }

  updateData<K extends keyof PropertyComponentInstanceDataTypes>(
    key: K,
    data: PropertyComponentInstanceDataTypes[K]
  ) {
    const propName = (PROP_ALIAS[key as AliasKeys] || key) as PropertyType
    const propComponentId = (this as any)[propName]
    if (!propComponentId) {
      return
    }

    propsManager.updatePropsData(propComponentId, key, data)
  }

  cleanup() {
    const removedPropertyIds = PROP_NAMES.map((propName) => ({
      id: (this as any)[propName]
    }))
    removeProperty(removedPropertyIds)
  }
}

export default Props
