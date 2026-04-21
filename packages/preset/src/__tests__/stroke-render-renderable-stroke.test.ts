import { describe, expect, it } from 'vitest'
import {
  StrokeJoinTypes,
  StrokeCapTypes,
  createDefaultStroke,
  FillColorFormats
} from '@asyra/utils'
import {
  getRenderableStrokes,
  getStrokeHitWidth
} from '../components/stroke-render/renderable-stroke'

describe('stroke renderable normalization', () => {
  it('should run: normalize visible stroke entries into canonical renderable strokes', () => {
    const [stroke] = getRenderableStrokes([
      createDefaultStroke({
        style: 'solid',
        width: 6,
        color: '#3366ff',
        opacity: 0.5,
        joinType: StrokeJoinTypes.BEVEL,
        capType: StrokeCapTypes.SQUARE
      })
    ])

    expect(stroke).toMatchObject({
      style: 'solid',
      position: 'center',
      width: 6,
      dashPattern: [20, 20],
      dashOffset: 0,
      join: 'bevel',
      cap: 'square',
      color: 0x3366ff,
      alpha: 0.5
    })
    expect(stroke.miterLimit).toBeGreaterThan(3.9)
    expect(stroke.miterLimit).toBeLessThan(4.1)
  })

  it('should run: normalize dashed pattern arrays and offset into canonical renderable strokes', () => {
    const [stroke] = getRenderableStrokes([
      createDefaultStroke({
        style: 'dashed',
        dashPattern: [12, 6, 3],
        dashOffset: 48
      })
    ])

    expect(stroke).toMatchObject({
      style: 'dashed',
      dashPattern: [12, 6, 3, 12, 6, 3],
      dashOffset: 6
    })
  })

  it('should not run: reject invalid or non-renderable entries from normalization output', () => {
    const strokes = getRenderableStrokes([
      createDefaultStroke({
        visible: false
      }),
      createDefaultStroke({
        width: 0
      }),
      {
        ...createDefaultStroke({
          color: '#000000'
        }),
        color: 'not-a-color',
        colorFormat: FillColorFormats.HEX,
        defaultColorFormat: FillColorFormats.HEX
      },
      null
    ])

    expect(strokes).toEqual([])
  })

  it('should run: compute max hit width from the normalized renderable stroke set', () => {
    const hitWidth = getStrokeHitWidth([
      createDefaultStroke({ width: 3 }),
      createDefaultStroke({ width: 12, visible: true }),
      createDefaultStroke({ width: 7, visible: true })
    ])

    expect(hitWidth).toBe(12)
  })
})
