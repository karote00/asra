import { VECTOR_TOKENS } from '@asyra/core'
import {
  AnchorPointTypes,
  FillColorFormats,
  FillKinds,
  PropertySchema,
  PropertyTypes,
  StrokeJoinTypes,
  StrokeCapTypes,
  StrokePositions,
  StrokeStyles,
  createDefaultFill,
  createDefaultStroke,
  Unit
} from '@asyra/utils'
import type { PresetCoreAPIs } from '../types'

const isUnit = (value: unknown) => value === Unit.PX || value === Unit.PERCENT
const isFiniteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
const isStringArray = (value: unknown) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')
const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isOpacity = (value: unknown) =>
  isFiniteNumber(value) && (value as number) >= 0 && (value as number) <= 1

const COLOR_FORMAT_SET = new Set(Object.values(FillColorFormats))
const isFillColorFormat = (value: unknown) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  typeof value === 'string' && COLOR_FORMAT_SET.has(value as any)

const isGradientStop = (value: unknown): boolean => {
  if (!isObjectRecord(value)) {
    return false
  }

  const position = value.position
  const color = value.color
  const opacity = value.opacity

  return (
    isFiniteNumber(position) &&
    (position as number) >= 0 &&
    (position as number) <= 1 &&
    typeof color === 'string' &&
    color.length > 0 &&
    isOpacity(opacity)
  )
}

const isGradientHandle = (value: unknown): boolean => {
  if (!isObjectRecord(value)) {
    return false
  }

  return isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

const isGradientData = (value: unknown): boolean => {
  if (value === null) {
    return true
  }

  if (!isObjectRecord(value)) {
    return false
  }

  const gradientType = value.gradientType
  const gradientStops = value.gradientStops
  const gradientHandles = value.gradientHandles

  return (
    typeof gradientType === 'string' &&
    gradientType.length > 0 &&
    Array.isArray(gradientStops) &&
    gradientStops.every(isGradientStop) &&
    Array.isArray(gradientHandles) &&
    gradientHandles.every(isGradientHandle)
  )
}

const isFillPayload = (value: unknown): boolean => {
  if (value === null) {
    return true
  }

  if (!isObjectRecord(value)) {
    return false
  }

  return (
    (value.kind === FillKinds.SOLID || value.kind === FillKinds.GRADIENT) &&
    isFillColorFormat(value.defaultColorFormat) &&
    isFillColorFormat(value.colorFormat) &&
    typeof value.color === 'string' &&
    value.color.length > 0 &&
    isOpacity(value.opacity) &&
    typeof value.visible === 'boolean' &&
    isGradientData(value.gradient)
  )
}

const fillDefaults = createDefaultFill()
const strokeDefaults = createDefaultStroke()

const fillSchema: PropertySchema = {
  type: PropertyTypes.FILL,
  fields: [
    {
      key: 'kind',
      kind: 'string',
      validate: (value) =>
        value === FillKinds.SOLID || value === FillKinds.GRADIENT,
      defaultValue: fillDefaults.kind
    },
    {
      key: 'defaultColorFormat',
      kind: 'string',
      validate: isFillColorFormat,
      defaultValue: fillDefaults.defaultColorFormat
    },
    {
      key: 'colorFormat',
      kind: 'string',
      validate: isFillColorFormat,
      defaultValue: fillDefaults.colorFormat
    },
    {
      key: 'color',
      kind: 'string',
      validate: (value) => typeof value === 'string' && value.length > 0,
      defaultValue: fillDefaults.color
    },
    {
      key: 'opacity',
      kind: 'number',
      validate: isOpacity,
      defaultValue: fillDefaults.opacity
    },
    {
      key: 'visible',
      kind: 'boolean',
      defaultValue: fillDefaults.visible
    },
    {
      key: 'gradient',
      kind: 'object',
      validate: isGradientData,
      defaultValue: fillDefaults.gradient
    }
  ]
}

const fillsSchema: PropertySchema = {
  type: PropertyTypes.FILLS,
  fields: [
    {
      key: 'fills',
      kind: 'array',
      validate: isStringArray,
      defaultValue: []
    }
  ]
}

const strokeSchema: PropertySchema = {
  type: PropertyTypes.STROKE,
  fields: [
    {
      key: 'kind',
      kind: 'string',
      validate: (value) =>
        value === FillKinds.SOLID || value === FillKinds.GRADIENT,
      defaultValue: strokeDefaults.kind
    },
    {
      key: 'style',
      kind: 'string',
      validate: (value) =>
        value === StrokeStyles.SOLID || value === StrokeStyles.DASHED,
      defaultValue: strokeDefaults.style
    },
    {
      key: 'position',
      kind: 'string',
      validate: (value) =>
        value === StrokePositions.CENTER ||
        value === StrokePositions.INSIDE ||
        value === StrokePositions.OUTSIDE,
      defaultValue: strokeDefaults.position
    },
    {
      key: 'width',
      kind: 'number',
      validate: (value) => isFiniteNumber(value) && (value as number) >= 0,
      defaultValue: strokeDefaults.width
    },
    {
      key: 'dashPattern',
      kind: 'array',
      validate: (value) =>
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((entry) => isFiniteNumber(entry) && (entry as number) > 0),
      defaultValue: strokeDefaults.dashPattern
    },
    {
      key: 'dashOffset',
      kind: 'number',
      validate: (value) => isFiniteNumber(value),
      defaultValue: strokeDefaults.dashOffset
    },
    {
      key: 'fill',
      kind: 'object',
      validate: isFillPayload,
      defaultValue: strokeDefaults.fill
    },
    {
      key: 'defaultColorFormat',
      kind: 'string',
      validate: isFillColorFormat,
      defaultValue: strokeDefaults.defaultColorFormat
    },
    {
      key: 'colorFormat',
      kind: 'string',
      validate: isFillColorFormat,
      defaultValue: strokeDefaults.colorFormat
    },
    {
      key: 'color',
      kind: 'string',
      validate: (value) => typeof value === 'string' && value.length > 0,
      defaultValue: strokeDefaults.color
    },
    {
      key: 'opacity',
      kind: 'number',
      validate: isOpacity,
      defaultValue: strokeDefaults.opacity
    },
    {
      key: 'visible',
      kind: 'boolean',
      defaultValue: strokeDefaults.visible
    },
    {
      key: 'gradient',
      kind: 'object',
      validate: isGradientData,
      defaultValue: strokeDefaults.gradient
    },
    {
      key: 'joinType',
      kind: 'string',
      validate: (value) =>
        value === StrokeJoinTypes.MITER ||
        value === StrokeJoinTypes.BEVEL ||
        value === StrokeJoinTypes.ROUND,
      defaultValue: strokeDefaults.joinType
    },
    {
      key: 'capType',
      kind: 'string',
      validate: (value) =>
        value === StrokeCapTypes.BUTT ||
        value === StrokeCapTypes.SQUARE ||
        value === StrokeCapTypes.ROUND,
      defaultValue: strokeDefaults.capType
    },
    {
      key: 'miterAngle',
      kind: 'number',
      validate: (value) =>
        isFiniteNumber(value) &&
        (value as number) >= 0 &&
        (value as number) <= 180,
      defaultValue: strokeDefaults.miterAngle
    }
  ]
}

const strokesSchema: PropertySchema = {
  type: PropertyTypes.STROKES,
  fields: [
    {
      key: 'strokes',
      kind: 'array',
      validate: isStringArray,
      defaultValue: []
    }
  ]
}

const positionSchema: PropertySchema = {
  type: PropertyTypes.POSITION,
  fields: [
    {
      key: 'x',
      kind: 'number',
      validate: isFiniteNumber,
      defaultValue: 0
    },
    {
      key: 'y',
      kind: 'number',
      validate: isFiniteNumber,
      defaultValue: 0
    },
    {
      key: 'xUnit',
      kind: 'string',
      validate: isUnit,
      defaultValue: Unit.PX
    },
    {
      key: 'yUnit',
      kind: 'string',
      validate: isUnit,
      defaultValue: Unit.PX
    }
  ]
}

const dimensionSchema: PropertySchema = {
  type: PropertyTypes.DIMENSION,
  fields: [
    {
      key: 'width',
      kind: 'number',
      validate: isFiniteNumber,
      defaultValue: 0.1
    },
    {
      key: 'height',
      kind: 'number',
      validate: isFiniteNumber,
      defaultValue: 0.1
    },
    {
      key: 'widthUnit',
      kind: 'string',
      validate: isUnit,
      defaultValue: Unit.PX
    },
    {
      key: 'heightUnit',
      kind: 'string',
      validate: isUnit,
      defaultValue: Unit.PX
    }
  ]
}

const anchorPointSchema: PropertySchema = {
  type: PropertyTypes.ANCHOR_POINT,
  fields: [
    {
      key: 'x',
      kind: 'number',
      validate: isFiniteNumber,
      defaultValue: 0
    },
    {
      key: 'y',
      kind: 'number',
      validate: isFiniteNumber,
      defaultValue: 0
    },
    {
      key: 'pointType',
      kind: 'string',
      validate: (value) =>
        value === AnchorPointTypes.SHARP || value === AnchorPointTypes.SMOOTH,
      defaultValue: AnchorPointTypes.SHARP
    },
    {
      key: 'isMove',
      kind: 'boolean'
    },
    {
      key: 'inHandle',
      kind: 'object',
      validate: (value) =>
        value === null ||
        (typeof value === 'object' &&
          value !== null &&
          Number.isFinite((value as { x?: unknown }).x) &&
          Number.isFinite((value as { y?: unknown }).y)),
      defaultValue: null
    },
    {
      key: 'outHandle',
      kind: 'object',
      validate: (value) =>
        value === null ||
        (typeof value === 'object' &&
          value !== null &&
          Number.isFinite((value as { x?: unknown }).x) &&
          Number.isFinite((value as { y?: unknown }).y)),
      defaultValue: null
    }
  ]
}

const anchorPointsSchema: PropertySchema = {
  type: PropertyTypes.ANCHOR_POINTS,
  fields: [
    {
      key: 'anchorPoints',
      kind: 'array',
      validate: (value) => Array.isArray(value),
      defaultValue: []
    }
  ]
}

const vectorPointSchema: PropertySchema = {
  type: PropertyTypes.VECTOR_POINT,
  fields: [
    {
      key: 'kind',
      kind: 'string',
      validate: (value) =>
        value === VECTOR_TOKENS.POINT.KIND.ANCHOR ||
        value === VECTOR_TOKENS.POINT.KIND.CONTROL,
      defaultValue: VECTOR_TOKENS.POINT.KIND.ANCHOR
    },
    {
      key: 'x',
      kind: 'number',
      validate: isFiniteNumber,
      defaultValue: 0
    },
    {
      key: 'y',
      kind: 'number',
      validate: isFiniteNumber,
      defaultValue: 0
    },
    {
      key: 'anchorType',
      kind: 'string',
      validate: (value) =>
        value === AnchorPointTypes.SHARP || value === AnchorPointTypes.SMOOTH,
      defaultValue: AnchorPointTypes.SHARP
    },
    {
      key: 'controlForId',
      kind: 'string'
    },
    {
      key: 'controlRole',
      kind: 'string',
      validate: (value) =>
        value === VECTOR_TOKENS.CONTROL.ROLE.IN ||
        value === VECTOR_TOKENS.CONTROL.ROLE.OUT
    }
  ]
}

const vectorPointsSchema: PropertySchema = {
  type: PropertyTypes.VECTOR_POINTS,
  fields: [
    {
      key: 'points',
      kind: 'array',
      validate: isStringArray,
      defaultValue: []
    }
  ]
}

const vectorSegmentSchema: PropertySchema = {
  type: PropertyTypes.VECTOR_SEGMENT,
  fields: [
    {
      key: 'startId',
      kind: 'string',
      defaultValue: ''
    },
    {
      key: 'endId',
      kind: 'string',
      defaultValue: ''
    },
    {
      key: 'outControlId',
      kind: 'custom',
      validate: (value) => value === null || typeof value === 'string',
      defaultValue: null
    },
    {
      key: 'inControlId',
      kind: 'custom',
      validate: (value) => value === null || typeof value === 'string',
      defaultValue: null
    }
  ]
}

const vectorSegmentsSchema: PropertySchema = {
  type: PropertyTypes.VECTOR_SEGMENTS,
  fields: [
    {
      key: 'segments',
      kind: 'array',
      validate: isStringArray,
      defaultValue: []
    }
  ]
}

const vectorNetworkSchema: PropertySchema = {
  type: PropertyTypes.VECTOR_NETWORK,
  fields: [
    {
      key: 'pointIds',
      kind: 'array',
      validate: isStringArray,
      defaultValue: []
    },
    {
      key: 'segmentIds',
      kind: 'array',
      validate: isStringArray,
      defaultValue: []
    },
    {
      key: 'closed',
      kind: 'boolean',
      defaultValue: false
    }
  ]
}

const vectorNetworksSchema: PropertySchema = {
  type: PropertyTypes.VECTOR_NETWORKS,
  fields: [
    {
      key: 'networks',
      kind: 'array',
      validate: isStringArray,
      defaultValue: []
    }
  ]
}

export const registerPropertySchemas = (
  core: Pick<PresetCoreAPIs, 'registerPropertySchema'>
) => {
  core.registerPropertySchema(fillSchema)
  core.registerPropertySchema(fillsSchema)
  core.registerPropertySchema(strokeSchema)
  core.registerPropertySchema(strokesSchema)
  core.registerPropertySchema(positionSchema)
  core.registerPropertySchema(dimensionSchema)
  core.registerPropertySchema(anchorPointSchema)
  core.registerPropertySchema(anchorPointsSchema)
  core.registerPropertySchema(vectorPointSchema)
  core.registerPropertySchema(vectorPointsSchema)
  core.registerPropertySchema(vectorSegmentSchema)
  core.registerPropertySchema(vectorSegmentsSchema)
  core.registerPropertySchema(vectorNetworkSchema)
  core.registerPropertySchema(vectorNetworksSchema)
}
