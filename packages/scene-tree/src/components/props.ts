import {
  IProps,
  PropertyType,
  PropertyTypes,
  type EvnetOptions
} from '@asyra/utils'
import type {
  PropertyComponentInstanceTypes,
  PropertyComponentInstanceDataTypes,
  PropsRawData
} from '@asyra/utils'
import { removeProperty } from '@asyra/reactive-events'
import propsManager, { type PropsManager } from '@asyra/props-manager'

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

  constructor(
    elementId: string,
    data?: PropsDataType,
    private readonly propsManagerOwner: PropsManager = propsManager
  ) {
    this.elementId = elementId

    if (data) {
      this.load(data)
    } else {
      this.init()
    }
  }

  get position() {
    return this.propertyIds.get(PropertyTypes.POSITION)
  }
  get dimension() {
    return this.propertyIds.get(PropertyTypes.DIMENSION)
  }

  getPropId(name: string): string | undefined {
    return this.propertyIds.get(name)
  }

  getCanonicalRootPropertyIds(): readonly string[] {
    return [...this.propertyIds.values()]
  }

  init() {
    const propertyComponents = PROP_NAMES.map((propName) =>
      this.propsManagerOwner.createProperty({ type: propName })
    )
    const propIdsMap = this.propsManagerOwner.addProperty(propertyComponents)
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
    const createdPropertyComponents: PropertyComponentInstanceTypes[] = []
    const propertyComponents = PROP_NAMES.map((propName) => {
      const propId = dataObj[propName]
      const propComponent = propId
        ? this.propsManagerOwner.getPropertyById(propId)
        : null
      if (propComponent) {
        // Restore existing prop component
        return propComponent
      } else {
        // Create new prop component
        const created = this.propsManagerOwner.createProperty({
          type: propName
        })
        createdPropertyComponents.push(created)
        return created
      }
    })
    if (createdPropertyComponents.length > 0) {
      this.propsManagerOwner.addProperty(createdPropertyComponents)
    }

    PROP_NAMES.forEach((propName, index) => {
      const id = propertyComponents[index]?.get('id')
      if (id) {
        this.propertyIds.set(propName, id)
      }
    })
  }

  save(): PropsRawData {
    const data = {} as PropsRawData
    this.propertyIds.forEach((id, propName) => {
      ;(data as PropsRawData)[propName] = id
    })
    return data
  }

  updateData<K extends keyof PropertyComponentInstanceDataTypes>(
    key: K,
    data: PropertyComponentInstanceDataTypes[K],
    options?: EvnetOptions
  ) {
    const propName = (PROP_ALIAS[key as AliasKeys] || key) as PropertyType
    const propComponentId = this.propertyIds.get(propName)
    if (!propComponentId) {
      return
    }

    this.propsManagerOwner.updatePropsData(propComponentId, key, data, options)
  }

  cleanup(options?: EvnetOptions) {
    const removedPropertyIds: { id: string }[] = []
    this.propertyIds.forEach((id) => {
      removedPropertyIds.push({ id })
    })
    removeProperty(removedPropertyIds, options)
  }
}

export default Props
