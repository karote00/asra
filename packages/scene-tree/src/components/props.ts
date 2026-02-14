import { IProps, PropertyType, PropertyTypes } from '@asyra/utils'
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

class Props implements IProps {
  elementId: string
  private propertyIds: Map<string, string> = new Map()

  constructor(elementId: string, data?: PropsDataType) {
    this.elementId = elementId

    if (data) {
      this.load(data)
    } else {
      this.init()
    }
  }

  get position() { return this.propertyIds.get(PropertyTypes.POSITION) }
  get dimension() { return this.propertyIds.get(PropertyTypes.DIMENSION) }

  getPropId(name: string): string | undefined {
    return this.propertyIds.get(name)
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
      const id = propIdsMap[propName]
      if (id) {
        this.propertyIds.set(propName, id)
      }
    })
  }

  load(data: PropsDataType = {}): void {
    const dataObj = data as Record<string, string | undefined>
    const propertyComponents = PROP_NAMES.map((propName) => {
      const propId = dataObj[propName]
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
      const id = propIdsMap[propName]
      if (id) {
        this.propertyIds.set(propName, id)
      }
    })
  }

  save(): PropsRawData {
    const data = {} as PropsRawData
    this.propertyIds.forEach((id, propName) => {
      (data as any)[propName] = id
    })
    return data
  }

  updateData<K extends keyof PropertyComponentInstanceDataTypes>(
    key: K,
    data: PropertyComponentInstanceDataTypes[K]
  ) {
    const propName = (PROP_ALIAS[key as AliasKeys] || key) as PropertyType
    const propComponentId = this.propertyIds.get(propName)
    if (!propComponentId) {
      return
    }

    propsManager.updatePropsData(propComponentId, key, data)
  }

  cleanup() {
    const removedPropertyIds: { id: string }[] = []
    this.propertyIds.forEach((id) => {
      removedPropertyIds.push({ id })
    })
    removeProperty(removedPropertyIds)
  }
}

export default Props
