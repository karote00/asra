import {
  PropertyTypes,
  type EVENT_OPTIONS,
  type StrokeAttrs
} from '@asyra/utils'
import { isEqual } from 'lodash'
import { STROKE_PATCH_KEYS, type StrokeWritableKey } from '../constants'
import core from '../contexts'

export type StrokePatch = Partial<Pick<StrokeAttrs, StrokeWritableKey>>

const getChangedPatchEntries = (
  currentStroke: StrokeAttrs,
  patch: StrokePatch
) =>
  STROKE_PATCH_KEYS.flatMap((key) => {
    if (!(key in patch)) {
      return []
    }

    const nextValue = patch[key]
    return isEqual(currentStroke[key], nextValue)
      ? []
      : ([[key, nextValue]] as const)
  })

export const strokeApis = {
  updateStrokeFields: (
    elementId: string,
    strokeId: string,
    currentStroke: StrokeAttrs,
    patch: StrokePatch,
    options?: EVENT_OPTIONS
  ) => {
    const changedEntries = getChangedPatchEntries(currentStroke, patch)
    if (changedEntries.length === 0) {
      return
    }

    changedEntries.forEach(([key, value]) => {
      core.updatePropertyById(
        strokeId,
        key,
        value,
        {
          ownerElementId: elementId,
          ownerPropertyName: PropertyTypes.STROKES
        },
        options
      )
    })
    core.commitPropertyChanges(options)
  },

  updateStrokeField: <K extends StrokeWritableKey>(
    elementId: string,
    strokeId: string,
    currentStroke: StrokeAttrs,
    key: K,
    value: StrokeAttrs[K],
    options?: EVENT_OPTIONS
  ) => {
    strokeApis.updateStrokeFields(
      elementId,
      strokeId,
      currentStroke,
      {
        [key]: value
      } as StrokePatch,
      options
    )
  }
}
