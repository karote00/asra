import { addProperty } from '@asra/reactive-events'
import type { PropsRawData } from '@asra/utils'

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

  async _init() {
    const result = await addProperty(this.elementId, PROP_NAMES)
    console.log(result)

    PROP_NAMES.forEach((propName) => {
      // this[propName] =
    })
  }

  load(data: PropsDataType = {}): void {
    PROP_NAMES.forEach((propName) => {
      this[propName] = data[propName]
    })
  }
}

export default Props
