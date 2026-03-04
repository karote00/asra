import {
  id,
  loadId,
  IDTypes,
  PropertyComponentRawData,
  PropertyTypes,
  isNil
} from '@asyra/utils'
import type { PropertyComponentInstanceTypes } from '@asyra/utils'
import { getPropertyComponent } from '../registries/property-component'

export const createProperty = (data: Partial<PropertyComponentRawData>) => {
  const type = data.type as string
  const PropClass =
    getPropertyComponent(type) ?? getPropertyComponent(PropertyTypes.CUSTOM)
  if (!PropClass) {
    throw new Error(
      `[props-manager] Property component type "${type}" is not registered.`
    )
  }

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
