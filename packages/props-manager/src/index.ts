import { PropAlias, PropertyTypes } from '@asra/utils'
import type { PropertyComponentRawData } from '@asra/utils'
import { initPropXSubscribes } from './subscribes'
import { createProperty } from './utils'
import { DimensionComponent, PositionComponent } from './components'

initPropXSubscribes()

type PropRawData = Record<string, PropertyComponentRawData>

class PropsManager {
  constructor(data?: PropRawData) {
    if (data) {
      this.load(data)
    }
  }

  load(data?: PropRawData) {
    // TODO: Load and create all props components
    console.log(data)
  }

  _createProperty(
    propName: PropertyTypes
  ): PositionComponent | DimensionComponent | undefined {
    return createProperty(propName)
  }

  addProperty(propNames: string[]): Record<string, string> {
    console.log('props manager add property', propNames)
    const propComponents = propNames.map((propName) => {
      const propKey = (PropAlias[propName] || propName) as PropertyTypes
      return this._createProperty(propKey)
    })

    console.log('propComponents')
    console.log(propComponents)

    return propComponents.reduce((acc, com) => {
      console.log(com)
      console.log(com?.get('type'))

      // acc[com.get('type')] = acc[com.get('id')]
      return acc
    }, {})
  }
}

const propsManager = new PropsManager()
export default propsManager
export { PropsManager }
