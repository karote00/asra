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
let scopedAccessor: ComponentAccessor | undefined

export const setComponentAccessor = (nextAccessor: ComponentAccessor) => {
  accessor = nextAccessor
}

export const getPropertyComponentAccessor = () => scopedAccessor ?? accessor

export const runWithPropertyComponentAccessor = <T>(
  nextAccessor: ComponentAccessor,
  callback: () => T
): T => {
  const previousAccessor = scopedAccessor
  scopedAccessor = nextAccessor
  try {
    return callback()
  } finally {
    scopedAccessor = previousAccessor
  }
}

export type { ComponentAccessor as PropertyComponentAccessor }
