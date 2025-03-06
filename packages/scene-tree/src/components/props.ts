import { PropertyTypes } from '@asra/utils'
import type { PropsRawData } from '@asra/utils'
import propsManager from '@asra/props-manager'

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

  _init() {
    const propIdMap = propsManager.addProperty(PROP_NAMES)

    PROP_NAMES.forEach((propName) => {
      this[propName] = propIdMap[propName]
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
}

export default Props
