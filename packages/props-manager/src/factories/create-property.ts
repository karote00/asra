import {
  id,
  loadId,
  IDTypes,
  PropertyComponentRawData,
  isNil
} from '@asyra/utils'
import type { PropertyComponentInstanceTypes } from '@asyra/utils'
import CustomComponent from '../components/custom'
import { getPropertyComponent } from '../registries/property-component'

export const createProperty = (data: Partial<PropertyComponentRawData>) => {
  const type = data.type as string
  // Uses registry-owned components. Fallback is generic custom component.
  const PropClass = getPropertyComponent(type) ?? CustomComponent

  let comId = data.id
  if (isNil(comId)) {
    comId = id(IDTypes.PROPS)
  } else {
    loadId(data.id as string, IDTypes.PROPS)
  }

  return new PropClass({
    id: comId,
    ...data
  }) as PropertyComponentInstanceTypes
}
