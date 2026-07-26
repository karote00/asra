import {
  type DataTypes,
  PropertyTypes,
  isFiniteNumber,
  isRecord,
  type EVENT_OPTIONS,
  type StrokeAttrs
} from '@asyra/utils'
import type {
  VectorNetwork,
  VectorPointNode,
  VectorSegment,
  VectorTopology
} from '@asyra/core'
import { STROKE_PATCH_KEYS, type StrokeWritableKey } from '../constants'
import core from '../contexts'
import { calculateVectorBounds } from './element/vector-geometry'
import { getChangedDefinedPatchEntries } from './property-patch'
import { transactionApis } from './transaction'

export type StrokePatch = Partial<Pick<StrokeAttrs, StrokeWritableKey>>

const updateStrokePropertyById = core.updatePropertyById as <
  K extends StrokeWritableKey
>(
  propertyId: string,
  key: K,
  data: StrokeAttrs[K],
  owner: {
    ownerElementId: string
    ownerPropertyName: string
  },
  options?: EVENT_OPTIONS
) => void

const hasGeometryAffectingStrokePatch = (patch: StrokePatch) =>
  STROKE_PATCH_KEYS.some((key) => key !== 'fill' && key in patch)

const nearlyEqual = (left: unknown, right: number) =>
  isFiniteNumber(left) && Math.abs(left - right) <= 1e-6

const getVectorBoundsRepairPatch = (
  elementId: string
): Record<string, DataTypes> | null => {
  const element = core.deps.sceneTree.getElementById(elementId)
  if (!element || element.get('type') !== 'vector') {
    return null
  }

  const computed = element.getAllComputedData() as {
    x?: unknown
    y?: unknown
    width?: unknown
    height?: unknown
    pointCoordinateSpace?: unknown
    points?: unknown
    segments?: unknown
    networks?: unknown
  }

  if (
    computed.pointCoordinateSpace !== 'workspace' ||
    !isRecord(computed.points) ||
    !isRecord(computed.segments) ||
    !isRecord(computed.networks)
  ) {
    return null
  }

  const topology: VectorTopology = {
    points: computed.points as Record<string, VectorPointNode>,
    segments: computed.segments as Record<string, VectorSegment>,
    networks: computed.networks as Record<string, VectorNetwork>
  }
  const bounds = calculateVectorBounds(topology)
  const patch: Record<string, DataTypes> = {}

  if (!nearlyEqual(computed.x, bounds.x)) {
    patch.x = bounds.x
  }
  if (!nearlyEqual(computed.y, bounds.y)) {
    patch.y = bounds.y
  }
  if (!nearlyEqual(computed.width, bounds.width)) {
    patch.width = bounds.width
  }
  if (!nearlyEqual(computed.height, bounds.height)) {
    patch.height = bounds.height
  }

  return Object.keys(patch).length > 0 ? patch : null
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
  getPrimaryStrokeColor: (elementId: string): string | null => {
    const stroke = getPrimaryStroke(elementId)
    return typeof stroke?.fill?.color === 'string' ? stroke.fill.color : null
  },

  updatePrimaryStrokeColor: (
    elementId: string,
    color: string,
    options?: EVENT_OPTIONS
  ): boolean => {
    const stroke = getPrimaryStroke(elementId)
    if (
      !stroke ||
      typeof color !== 'string' ||
      color.length === 0 ||
      stroke.fill.color === color
    ) {
      return false
    }

    strokeApis.updateStrokeFields(
      elementId,
      stroke.id,
      stroke,
      {
        fill: {
          ...stroke.fill,
          color
        }
      },
      options
    )
    return true
  },

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
      const vectorBoundsRepairPatch = hasGeometryAffectingStrokePatch(patch)
        ? getVectorBoundsRepairPatch(elementId)
        : null
      if (vectorBoundsRepairPatch) {
        core.changeComputedData([elementId], vectorBoundsRepairPatch, options)
      }

      changedEntries.forEach(([key, value]) => {
        updateStrokePropertyById(
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
