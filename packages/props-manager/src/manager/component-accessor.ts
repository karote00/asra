import type { PropertyComponentInstanceTypes } from '@asyra/utils'

interface ComponentAccessor {
  getPropertyById: (
    propertyId: string
  ) => PropertyComponentInstanceTypes | undefined
  addToMap: (component: PropertyComponentInstanceTypes) => void
  createComponent: (
    data: Record<string, unknown>
  ) => PropertyComponentInstanceTypes | null
}

const noopAccessor: ComponentAccessor = {
  getPropertyById: () => undefined,
  addToMap: () => undefined,
  createComponent: () => null
}

let accessor: ComponentAccessor = noopAccessor

export const setComponentAccessor = (nextAccessor: ComponentAccessor) => {
  accessor = nextAccessor
}

export const getPropertyComponentAccessor = () => accessor

export type { ComponentAccessor as PropertyComponentAccessor }
