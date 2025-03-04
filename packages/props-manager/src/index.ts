import { PropAlias, PropComponentDataType } from '@asra/utils'
import { initPropXSubscribes } from './subscribes'
import { createProperty } from './utils'

initPropXSubscribes()

type PropRawData = Record<string, PropComponentDataType>

class PropsManager {
  constructor(data?: PropRawData) {
    if (data) {
      this.load(data)
    }
  }

  load(data?: PropRawData) {
    console.log(data)
  }

  _createProperty(propName: string) {
    return createProperty(propName)
  }

  addProperty(propNames: string[]): Record<string, string> {
    const propComponents = propNames.map((propName) => {
      const propKey = PropAlias[propName] || propName
      return this._createProperty(propKey)
    })

    return propComponents.reduce((acc, com) => {
      // acc[com.get('type')] = acc[com.get('id')]
      return acc
    }, {})
  }
}

const propsManager = new PropsManager()
export default propsManager
export { PropsManager }
