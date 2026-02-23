import {
  AnchorPointTypes,
  PropertySchema,
  PropertyTypes,
  Unit
} from '@asyra/utils'
import { registerPropertySchema } from '../registries/property-schema'

const isUnit = (value: unknown) => value === Unit.PX || value === Unit.PERCENT
const isFiniteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)

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

export const registerBuiltinPropertySchemas = () => {
  registerPropertySchema(positionSchema)
  registerPropertySchema(dimensionSchema)
  registerPropertySchema(anchorPointSchema)
  registerPropertySchema(anchorPointsSchema)
}
