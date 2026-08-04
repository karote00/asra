import core, { type PropertyTypeDefinition } from '@asyra/core'
import {
  PropertyTypes,
  type FillAttrs,
  type StrokeAttrs,
  type Unit
} from '@asyra/utils'
import { describe, expect, it } from 'vitest'
import { applyPreset, PresetDefaults, PresetProfiles } from '../index.js'

interface AppPositionFields {
  x: number
  y: number
  rotation: number
  xUnit: Unit
  yUnit: Unit
  customAxis: number
}

describe('preset property type redefinition integration', () => {
  it('redefines an official config-mode type through the public Core facade', () => {
    applyPreset(core, {
      profile: PresetProfiles.CUSTOM,
      defaults: [PresetDefaults.BASIC_SHAPES]
    })
    const relations = core.getRegistrationRelations()
    const presetOwner = core.getRegistration({
      kind: 'property',
      key: PropertyTypes.POSITION
    })?.owner

    const current = core.getPropertyTypeDefinition<AppPositionFields>(
      PropertyTypes.POSITION
    )
    const fill = core.getPropertyTypeDefinition<FillAttrs>(PropertyTypes.FILL)
    const stroke = core.getPropertyTypeDefinition<StrokeAttrs>(
      PropertyTypes.STROKE
    )

    expect(current?.fields.map((field) => field.key)).toEqual([
      'x',
      'y',
      'rotation',
      'xUnit',
      'yUnit'
    ])
    expect(fill?.fields.map((field) => field.key)).toEqual([
      'kind',
      'defaultColorFormat',
      'colorFormat',
      'color',
      'opacity',
      'visible',
      'gradient'
    ])
    expect(stroke?.fields.map((field) => field.key)).toEqual([
      'style',
      'position',
      'width',
      'dash',
      'gap',
      'fill',
      'joinType',
      'capType',
      'miterAngle'
    ])
    expect(presetOwner?.packageName).toBe('@asyra/preset')

    const committedFill = core.redefinePropertyType<FillAttrs>(
      PropertyTypes.FILL,
      (definition) => ({
        ...definition,
        fields: definition.fields.map((field) =>
          field.key === 'opacity'
            ? {
                ...field,
                validate: (value) =>
                  typeof value === 'number' && value >= 0 && value <= 2
              }
            : field
        )
      })
    )

    expect(
      committedFill.fields
        .find((field) => field.key === 'opacity')
        ?.validate?.(1.5)
    ).toBe(true)

    const committed = core.redefinePropertyType<AppPositionFields>(
      PropertyTypes.POSITION,
      (definition): PropertyTypeDefinition<AppPositionFields> => ({
        ...definition,
        fields: [
          ...definition.fields,
          {
            key: 'customAxis',
            kind: 'number',
            defaultValue: 0,
            validate: (value) =>
              typeof value === 'number' && Number.isFinite(value),
            persist: true,
            project: true,
            unit: false
          }
        ]
      })
    )

    expect(committed.fields[committed.fields.length - 1]).toMatchObject({
      key: 'customAxis',
      persist: true,
      project: true,
      unit: false
    })
    expect(
      core.getRegistration({
        kind: 'property',
        key: PropertyTypes.POSITION
      })?.owner
    ).toEqual({ packageName: 'app', name: PropertyTypes.POSITION })
    expect(core.getRegistrationRelations()).toEqual(relations)
  })
})
