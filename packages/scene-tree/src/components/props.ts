import { PropertyTypes } from '@asra/utils'
import type { PropsRawData } from '@asra/utils'
import propsManager from '@asra/props-manager'

type PropsDataType = Partial<PropsRawData>

const PROP_NAMES: PropertyTypes[] = [
  PropertyTypes.POSITION,
  PropertyTypes.DIMENSION
]

class Props implements PropsDataType {
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
    console.log('props init')
    const propIds = propsManager.addProperty(PROP_NAMES)
    console.log('propIds', propIds)
    PROP_NAMES.forEach((propName) => {
      this[propName] = propIds[propName]
    })
  }

  load(data: PropsDataType = {}): void {
    PROP_NAMES.forEach((propName) => {
      this[propName] = data[propName]
    })
  }
}

export default Props
