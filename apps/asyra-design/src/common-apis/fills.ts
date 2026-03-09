import { PropertyTypes, type EVENT_OPTIONS, type FillAttrs } from '@asyra/utils'
import { isEqual } from 'lodash'
import { FILL_PATCH_KEYS, type FillWritableKey } from '../constants'
import core from '../contexts'

export type FillPatch = Partial<Pick<FillAttrs, FillWritableKey>>

const getChangedPatchEntries = (currentFill: FillAttrs, patch: FillPatch) =>
  FILL_PATCH_KEYS.flatMap((key) => {
    if (!(key in patch)) {
      return []
    }

    const nextValue = patch[key]
    return isEqual(currentFill[key], nextValue)
      ? []
      : ([[key, nextValue]] as const)
  })

export const fillApis = {
  updateFillFields: (
    elementId: string,
    fillId: string,
    currentFill: FillAttrs,
    patch: FillPatch,
    options?: EVENT_OPTIONS
  ) => {
    const changedEntries = getChangedPatchEntries(currentFill, patch)
    if (changedEntries.length === 0) {
      return
    }

    changedEntries.forEach(([key, value]) => {
      core.updatePropertyById(
        fillId,
        key,
        value,
        {
          ownerElementId: elementId,
          ownerPropertyName: PropertyTypes.FILLS
        },
        options
      )
    })
    core.commitPropertyChanges(options)
  },
  updateFillField: <K extends FillWritableKey>(
    elementId: string,
    fillId: string,
    currentFill: FillAttrs,
    key: K,
    value: FillAttrs[K],
    options?: EVENT_OPTIONS
  ) => {
    fillApis.updateFillFields(
      elementId,
      fillId,
      currentFill,
      {
        [key]: value
      } as FillPatch,
      options
    )
  }
}
