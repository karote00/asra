import { PropertyTypes } from '@asra/utils'
import type { PropsRawData } from '@asra/utils'
import { addProperty, removeProperty } from '@asra/reactive-events'

type PropsDataType = Partial<PropsRawData>

const PROP_NAMES: PropertyTypes[] = [
  PropertyTypes.POSITION,
  PropertyTypes.DIMENSION
]

class Props {
  elementId: string
  position?: PropsRawData[PropertyTypes.POSITION]
  dimension?: PropsRawData[PropertyTypes.DIMENSION]

  constructor(elementId: string, data?: PropsDataType) {
    this.elementId = elementId

    if (data) {
      this.load(data)
    } else {
      this._init()
    }
  }

  async _init() {
    const propsTypeData = PROP_NAMES.map((propName) => ({ type: propName }))
    const propIdsMap = await addProperty(propsTypeData)
    if (!propIdsMap) {
      return
    }

    PROP_NAMES.forEach((propName) => {
      this[propName] = propIdsMap[propName]
    })
  }

  load(data: PropsDataType = {}): void {
    PROP_NAMES.forEach((propName) => {
      this[propName] = data[propName]
    })
  }

  save(): PropsRawData {
    return PROP_NAMES.reduce((acc, propName) => {
      const key = propName as keyof PropsRawData
      acc[key] = this[key] as string
      return acc
    }, {} as PropsRawData)
  }

  cleanup() {
    const removedPropertyIds = PROP_NAMES.map((propName) => ({
      id: this[propName]
    }))
    removeProperty(removedPropertyIds)
  }
}

export default Props
