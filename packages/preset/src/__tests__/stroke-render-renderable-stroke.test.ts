import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FillKinds,
  StrokeJoinTypes,
  StrokeCapTypes,
  createDefaultStroke,
  createDefaultFill,
  createDefaultGradientData,
  FillColorFormats
} from '@asyra/utils'
import {
  getRenderableStrokes,
  getStrokeHitWidth,
  normalizeStrokeSpec
} from '../components/stroke-render/renderable-stroke'

const { createRenderGradientFillStyle } = vi.hoisted(() => ({
  createRenderGradientFillStyle: vi.fn((options) => ({
    fill: {
      mocked: true,
      options
    }
  }))
}))

vi.mock('@asyra/core', () => ({
  default: {
    createRenderGradientFillStyle
  }
}))

describe('stroke renderable normalization', () => {
  beforeEach(() => {
    createRenderGradientFillStyle.mockClear()
  })

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

  it('should run: normalize gradient stroke entries into canonical renderable paints without changing geometry fields', () => {
    const [stroke] = getRenderableStrokes([
      createDefaultStroke({
        style: 'dashed',
        width: 6,
        kind: FillKinds.GRADIENT,
        gradient: {
          ...createDefaultGradientData(),
          gradientHandles: [
            { x: 0, y: 0.5 },
            { x: 1, y: 0.5 }
          ]
        }
      })
    ])

    expect(stroke).toMatchObject({
      style: 'dashed',
      width: 6,
      kind: 'gradient',
      dashPattern: [20, 20],
      dashOffset: 0,
      gradientStyle: {
        fill: {
          mocked: true,
          options: {
            type: 'linear',
            start: { x: 0, y: 0.5 },
            end: { x: 1, y: 0.5 },
            textureSpace: 'local'
          }
        }
      }
    })
    expect(stroke.paintKey).toContain('"kind":"gradient"')
    expect(createRenderGradientFillStyle).toHaveBeenCalledTimes(1)
  })

  it('should run: prefer stroke fill payload over legacy flat paint fields', () => {
    const [stroke] = getRenderableStrokes([
      createDefaultStroke({
        color: '#000000',
        opacity: 1,
        fill: createDefaultFill({
          color: '#ff3300',
          opacity: 0.25
        })
      })
    ])

    expect(stroke).toMatchObject({
      kind: 'solid',
      color: 0xff3300,
      alpha: 0.25
    })
    expect(stroke.paintKey).toBe('solid:16724736:0.25')
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

  it('should run: normalize negative dashed offsets into the canonical dash cycle', () => {
    const [stroke] = normalizeStrokeSpec([
      createDefaultStroke({
        style: 'dashed',
        dashPattern: [10, 5],
        dashOffset: -2
      })
    ]).strokes

    expect(stroke).toMatchObject({
      dashPattern: [10, 5],
      dashOffset: 13
    })
  })

  it('should run: apply default cap, join, miter, and solid paint handoff at the canonical stroke spec boundary', () => {
    const result = normalizeStrokeSpec([createDefaultStroke({ width: 4 })])

    expect(result.diagnostics).toEqual([])
    expect(result.strokes[0]).toMatchObject({
      width: 4,
      join: 'miter',
      cap: 'butt',
      miterLimit: expect.any(Number),
      kind: 'solid',
      color: 0x000000,
      alpha: 1
    })
    expect(result.strokes[0]?.paintKey).toBe('solid:0:1')
  })

  it('should run: normalize Asyra canonical miter angle thresholds into SVG miter limits', () => {
    const [defaultAngleStroke] = getRenderableStrokes([
      createDefaultStroke({
        joinType: StrokeJoinTypes.MITER,
        miterAngle: 28.96
      })
    ])
    const [zeroAngleStroke] = getRenderableStrokes([
      createDefaultStroke({
        joinType: StrokeJoinTypes.MITER,
        miterAngle: 0
      })
    ])
    const [fullAngleStroke] = getRenderableStrokes([
      createDefaultStroke({
        joinType: StrokeJoinTypes.MITER,
        miterAngle: 180
      })
    ])

    expect(defaultAngleStroke.miterLimit).toBeGreaterThan(3.9)
    expect(defaultAngleStroke.miterLimit).toBeLessThan(4.1)
    expect(zeroAngleStroke.miterLimit).toBe(Number.POSITIVE_INFINITY)
    expect(fullAngleStroke.miterLimit).toBe(1)
  })

  it('should not run: reject invalid or non-renderable entries from normalization output', () => {
    const result = normalizeStrokeSpec([
      createDefaultStroke({
        id: 'hidden-stroke',
        visible: false
      }),
      createDefaultStroke({
        id: 'zero-width-stroke',
        width: 0
      }),
      {
        ...createDefaultStroke({
          id: 'invalid-paint-stroke',
          color: '#000000'
        }),
        color: 'not-a-color',
        colorFormat: FillColorFormats.HEX,
        defaultColorFormat: FillColorFormats.HEX
      },
      null
    ])

    expect(result.strokes).toEqual([])
    expect(result.diagnostics).toEqual([
      {
        index: 0,
        reason: 'invisible-stroke',
        strokeId: 'hidden-stroke'
      },
      {
        index: 1,
        reason: 'non-positive-width',
        strokeId: 'zero-width-stroke'
      },
      {
        index: 2,
        reason: 'invalid-paint',
        strokeId: 'invalid-paint-stroke'
      },
      {
        index: 3,
        reason: 'invalid-entry'
      }
    ])
    expect(getRenderableStrokes([null])).toEqual([])
  })

  it('should not run: accept invisible paint or missing gradient payloads as renderable stroke specs', () => {
    const result = normalizeStrokeSpec([
      createDefaultStroke({
        id: 'hidden-paint',
        fill: createDefaultFill({
          visible: false
        })
      }),
      createDefaultStroke({
        id: 'missing-gradient',
        kind: FillKinds.GRADIENT,
        gradient: null
      })
    ])

    expect(result.strokes).toEqual([])
    expect(result.diagnostics).toEqual([
      {
        index: 0,
        reason: 'invisible-paint',
        strokeId: 'hidden-paint'
      },
      {
        index: 1,
        reason: 'invalid-gradient-paint',
        strokeId: 'missing-gradient'
      }
    ])
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
