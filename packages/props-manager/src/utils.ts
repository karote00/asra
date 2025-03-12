import {
  PropertyTypes,
  PropertyComponentInstanceTypes,
  DefaultPositionData,
  DefaultDimensionData,
  id,
  loadId,
  IDTypes,
  PropertyComponentRawData,
  isNil
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

export const createProperty = (data: Partial<PropertyComponentRawData>) => {
  const type = data.type as PropertyTypes
  const PropClass = PropClassMap[type]
  if (!PropClass) {
    return
  }

  let comId = data.id
  if (isNil(comId)) {
    comId = id(IDTypes.PROPS)
  } else {
    loadId(data.id as string, IDTypes.PROPS)
  }
  const defaultData = DefaultDataMap[type]

  return new PropClass({
    id: comId,
    ...defaultData
  }) as PropertyComponentInstanceTypes
}
