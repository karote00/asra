import {
  PropertyTypes,
  DefaultPositionData,
  id,
  IDTypes,
  DefaultDimensionData
} from '@asra/utils'
import {
  PositionComponent,
  DimensionComponent,
  AllPropertyComponents,
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

export const createProperty = (
  propName: PropertyTypes
): PositionComponent | DimensionComponent | undefined => {
  console.warn('create componenet')
  console.log({ propName })
  const PropClass = PropClassMap[propName]
  console.log({ PropClass })
  if (!PropClass) {
    return
  }

  const comId = id(IDTypes.PROPS)
  const defaultData = DefaultDataMap[propName]

  return new PropClass({
    id: comId,
    ...defaultData
  })
}
