import {
  PropertyTypes,
  PropertyComponentInstanceTypes,
  DefaultPositionData,
  DefaultDimensionData,
  id,
  IDTypes
} from '@asra/utils'
import {
  PositionComponent,
  DimensionComponent,
  PropertyComponentType
} from './components'

const PropClassMap: Record<PropertyTypes, PropertyComponentType> = {
  [PropertyTypes.POSITION]: PositionComponent,
  [PropertyTypes.DIMENSION]: DimensionComponent
}
const DefaultDataMap: Record<PropertyTypes, object> = {
  [PropertyTypes.POSITION]: DefaultPositionData,
  [PropertyTypes.DIMENSION]: DefaultDimensionData
}

export const createProperty = (propName: PropertyTypes) => {
  const PropClass = PropClassMap[propName]
  if (!PropClass) {
    return
  }

  const comId = id(IDTypes.PROPS)
  const defaultData = DefaultDataMap[propName]

  return new PropClass({
    id: comId,
    ...defaultData
  }) as PropertyComponentInstanceTypes
}
