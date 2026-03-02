import {
  AnchorPointTypes,
  PropertySchema,
  PropertyTypes,
  Unit
} from '@asyra/utils'
import type { PresetCoreAPIs } from '../types'

const isUnit = (value: unknown) => value === Unit.PX || value === Unit.PERCENT
const isFiniteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
const isStringArray = (value: unknown) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

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
      validate: (value) => value === 'anchor' || value === 'control',
      defaultValue: 'anchor'
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
      validate: (value) => value === 'in' || value === 'out'
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
