import { type FillAttrs } from '@asyra/utils'
import { isEqual } from 'lodash'
import type { FillPatch } from '../../common-apis'
import { FILL_PATCH_KEYS } from '../../constants'

export const hasFillPatch = (patch: FillPatch): boolean =>
  Object.keys(patch).length > 0

export const applyFillPatch = (
  sourceFill: FillAttrs,
  patch: FillPatch
): FillAttrs => ({
  ...sourceFill,
  ...patch
})

export const getChangedFillPatch = (
  sourceFill: FillAttrs,
  nextFill: FillAttrs
): FillPatch =>
  FILL_PATCH_KEYS.reduce<FillPatch>((patch, key) => {
    const nextValue = nextFill[key]
    if (!isEqual(sourceFill[key], nextValue)) {
      Object.assign(patch, { [key]: nextValue })
    }

    return patch
  }, {})
