import {
  id,
  loadId,
  IDTypes,
  PropertyComponentRawData,
  isNil
} from '@asyra/utils'
import type { PropertyComponentInstanceTypes } from '@asyra/utils'
import type { PropertyComponentConstructor } from '../components/index.js'
import { getPropertyComponent } from '../registries/property-component.js'

export const createPropertyWithConstructor = (
  data: Partial<PropertyComponentRawData>,
  PropClass: PropertyComponentConstructor
): PropertyComponentInstanceTypes => {
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

export const createProperty = (data: Partial<PropertyComponentRawData>) => {
  const type = data.type as string
  const PropClass = getPropertyComponent(type)
  if (!PropClass) {
    throw new Error(
      `[props-manager] Property component type "${type}" is not registered.`
    )
  }

  return createPropertyWithConstructor(data, PropClass)
}
