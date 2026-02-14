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
} from '@asyra/utils'
import {
  PositionComponent,
  DimensionComponent,
  CustomComponent,
  PropertyComponentType
} from './components'

const PropClassMap: Record<string, PropertyComponentType> = {
  [PropertyTypes.POSITION]: PositionComponent,
  [PropertyTypes.DIMENSION]: DimensionComponent,
  [PropertyTypes.CUSTOM]: CustomComponent
}
const DefaultDataMap: Record<string, object> = {
  [PropertyTypes.POSITION]: DefaultPositionData,
  [PropertyTypes.DIMENSION]: DefaultDimensionData,
  [PropertyTypes.CUSTOM]: {}
}

export const createProperty = (data: Partial<PropertyComponentRawData>) => {
  const type = data.type as string
  // Use specific class if mapped, otherwise default to CustomComponent
  const PropClass = PropClassMap[type] || CustomComponent

  let comId = data.id
  if (isNil(comId)) {
    comId = id(IDTypes.PROPS)
  } else {
    loadId(data.id as string, IDTypes.PROPS)
  }
  const defaultData = DefaultDataMap[type] || {}

  return new PropClass({
    id: comId,
    ...defaultData,
    ...data
  }) as PropertyComponentInstanceTypes
}
