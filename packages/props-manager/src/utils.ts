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
  AnchorPointComponent,
  AnchorPointsComponent,
  PropertyComponentType
} from './components'

const PropClassMap: Record<string, PropertyComponentType> = {
  [PropertyTypes.POSITION]: PositionComponent,
  [PropertyTypes.DIMENSION]: DimensionComponent,
  [PropertyTypes.CUSTOM]: CustomComponent,
  [PropertyTypes.ANCHOR_POINT]: AnchorPointComponent,
  [PropertyTypes.ANCHOR_POINTS]: AnchorPointsComponent
}
const DefaultDataMap: Record<string, object> = {
  [PropertyTypes.POSITION]: DefaultPositionData,
  [PropertyTypes.DIMENSION]: DefaultDimensionData,
  [PropertyTypes.CUSTOM]: {},
  [PropertyTypes.ANCHOR_POINT]: {},
  [PropertyTypes.ANCHOR_POINTS]: {}
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
