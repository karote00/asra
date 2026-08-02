import {
  PropertyTypes,
  createDefaultStroke,
  id,
  type EVENT_OPTIONS,
  type StrokeAttrs
} from '@asyra/utils'
import type { ElementPropertyPatchUpdate } from '@asyra/core'
import { STROKE_PATCH_KEYS, type StrokeWritableKey } from '../constants'
import core from '../contexts'
import { getChangedDefinedPatchEntries } from './property-patch'
import { transactionApis } from './transaction'

export type StrokePatch = Partial<Pick<StrokeAttrs, StrokeWritableKey>>

export interface PrimaryStrokeColorUpdate {
  readonly color: string
  readonly elementId: string
}

const createStrokeRecordPatch = (
  elementId: string,
  strokeId: string,
  fields: Readonly<Record<string, unknown>>
): ElementPropertyPatchUpdate => {
  if (fields.id !== strokeId) {
    throw new Error(`Stroke record key "${strokeId}" does not match its id`)
  }
  const recordFields: Record<string, unknown> = {}
  for (const key of STROKE_PATCH_KEYS) {
    const value = fields[key]
    if (value !== undefined) {
      recordFields[key] = value
    }
  }

  return {
    elementId,
    records: [
      {
        key: PropertyTypes.STROKES,
        set: {
          [strokeId]: recordFields
        }
      }
    ]
  }
}

const getPrimaryStroke = (elementId: string): StrokeAttrs | null => {
  const element = core.deps.sceneTree.getElementById(elementId)
  if (!element) {
    return null
  }
  const computed = element.getAllComputedData() as {
    strokes?: unknown
  }
  if (!Array.isArray(computed.strokes)) {
    return null
  }
  const stroke = computed.strokes[0]
  return stroke && typeof stroke === 'object' ? (stroke as StrokeAttrs) : null
}

export const strokeApis = {
  addStroke: (elementId: string, options?: EVENT_OPTIONS): string | null => {
    if (!core.deps.sceneTree.getElementById(elementId)) {
      return null
    }
    const stroke = createDefaultStroke({ id: id() })
    transactionApis.runTransaction(() => {
      core.patchElementProperties(
        [createStrokeRecordPatch(elementId, stroke.id, stroke)],
        options
      )
    })
    return stroke.id
  },

  removeStroke: (
    elementId: string,
    strokeId: string,
    options?: EVENT_OPTIONS
  ): boolean => {
    const element = core.deps.sceneTree.getElementById(elementId)
    const strokes = element?.getAllComputedData?.()?.strokes
    if (
      !strokeId ||
      !Array.isArray(strokes) ||
      !strokes.some(
        (candidate) =>
          candidate &&
          typeof candidate === 'object' &&
          (candidate as { id?: unknown }).id === strokeId
      )
    ) {
      return false
    }

    transactionApis.runTransaction(() => {
      core.patchElementProperties(
        [
          {
            elementId,
            records: [
              {
                key: PropertyTypes.STROKES,
                remove: [strokeId]
              }
            ]
          }
        ],
        options
      )
    })
    return true
  },

  getPrimaryStrokeColor: (elementId: string): string | null => {
    const stroke = getPrimaryStroke(elementId)
    return typeof stroke?.fill?.color === 'string' ? stroke.fill.color : null
  },

  updatePrimaryStrokeColors: (
    updates: readonly PrimaryStrokeColorUpdate[],
    options?: EVENT_OPTIONS
  ): readonly boolean[] => {
    const prepared = updates.map(({ color, elementId }) => {
      const stroke = getPrimaryStroke(elementId)
      if (
        !stroke ||
        typeof color !== 'string' ||
        color.length === 0 ||
        stroke.fill.color === color
      ) {
        return null
      }
      return {
        elementId,
        nextStroke: {
          ...stroke,
          fill: {
            ...stroke.fill,
            color
          }
        },
        strokeId: stroke.id
      }
    })
    if (!prepared.some((update) => update !== null)) {
      return Object.freeze(prepared.map(() => false))
    }

    transactionApis.runTransaction(() => {
      core.patchElementProperties(
        prepared.flatMap((update) =>
          update
            ? [
                createStrokeRecordPatch(update.elementId, update.strokeId, {
                  ...update.nextStroke
                })
              ]
            : []
        ),
        options
      )
    })
    return Object.freeze(prepared.map((update) => update !== null))
  },

  updatePrimaryStrokeColor: (
    elementId: string,
    color: string,
    options?: EVENT_OPTIONS
  ): boolean =>
    strokeApis.updatePrimaryStrokeColors(
      [
        {
          color,
          elementId
        }
      ],
      options
    )[0] ?? false,

  updateStrokeFields: (
    elementId: string,
    strokeId: string,
    currentStroke: StrokeAttrs,
    patch: StrokePatch,
    options?: EVENT_OPTIONS
  ) => {
    const changedEntries = getChangedDefinedPatchEntries(
      STROKE_PATCH_KEYS,
      currentStroke,
      patch
    )
    if (changedEntries.length === 0) {
      return
    }

    transactionApis.runTransaction(() => {
      const nextStroke = {
        ...currentStroke,
        ...Object.fromEntries(changedEntries)
      } as Readonly<Record<string, unknown>>
      core.patchElementProperties(
        [createStrokeRecordPatch(elementId, strokeId, nextStroke)],
        options
      )
    })
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
