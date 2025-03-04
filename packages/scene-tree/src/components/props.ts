import type { PropsRawData } from '@asra/utils'
import propsManager from '@asra/props-manager'

type PropsDataType = Partial<PropsRawData>
type PropName = 'position' | 'dimension'

const PROP_NAMES: PropName[] = ['position', 'dimension']

class Props implements PropsDataType {
  elementId: string
  position?: PropsRawData['position']
  dimension?: PropsRawData['dimension']

  constructor(elementId: string, data?: PropsDataType) {
    this.elementId = elementId

    if (data) {
      this.load(data)
    } else {
      this._init()
    }
  }

  _init() {
    const propIds = propsManager.addProperty(PROP_NAMES)
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
