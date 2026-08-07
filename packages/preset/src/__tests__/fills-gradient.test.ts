import { beforeEach, describe, expect, it, vi } from 'vitest'
import core from '@asyra/core'
import {
  FillColorFormats,
  FillGradientTypes,
  FillKinds,
  createDefaultFill,
  type FillAttrs
} from '@asyra/utils'
import { toRenderableGradient } from '../components/fills.js'

const createGradientFill = (overrides: Partial<FillAttrs> = {}): FillAttrs => ({
  ...createDefaultFill({
    kind: FillKinds.GRADIENT,
    defaultColorFormat: FillColorFormats.HEX,
    colorFormat: FillColorFormats.HEX,
    color: '#ffffff',
    opacity: 1,
    visible: true,
    gradient: {
      gradientType: FillGradientTypes.LINEAR,
      gradientStops: [
        {
          position: 0,
          color: '#ffffff',
          opacity: 1
        },
        {
          position: 1,
          color: '#000000',
          opacity: 1
        }
      ],
      gradientHandles: [
        {
          x: 0.5,
          y: 0
        },
        {
          x: 0.5,
          y: 1
        }
      ],
      metadata: {}
    }
  }),
  ...overrides
})

const expectLinearGradientCall = (options: {
  start: { x: number; y: number }
  end: { x: number; y: number }
  colorStops: { offset: number; color: string }[]
}) => {
  const actual = vi.mocked(core.createRenderGradientFillStyle).mock.calls[
    vi.mocked(core.createRenderGradientFillStyle).mock.calls.length - 1
  ]?.[0]
  expect(actual).toMatchObject({
    type: 'linear',
    start: options.start,
    end: options.end,
    textureSpace: 'local'
  })
  expect(actual?.colorStops).toHaveLength(options.colorStops.length)

  actual?.colorStops.forEach(
    (stop: { offset: number; color: string }, index: number) => {
      expect(stop.color).toBe(options.colorStops[index].color)
      expect(stop.offset).toBeCloseTo(options.colorStops[index].offset, 6)
    }
  )
}

describe('toRenderableGradient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(core, 'createRenderGradientFillStyle').mockImplementation(
      (options) =>
        ({
          fill: {
            mocked: true,
            options
          }
        }) as never
    )
  })

  it('maps linear gradient fills to render gradient options', () => {
    const fill = createGradientFill({
      opacity: 0.5,
      gradient: {
        gradientType: FillGradientTypes.LINEAR,
        gradientStops: [
          {
            position: 1,
            color: '#000000',
            opacity: 0.6
          },
          {
            position: 0,
            color: '#ffffff',
            opacity: 1
          },
          {
            position: 0.5,
            color: '#ff0000',
            opacity: 0.8
          }
        ],
        gradientHandles: [
          {
            x: 0.5,
            y: 0
          },
          {
            x: 0.5,
            y: 1
          }
        ],
        metadata: {}
      }
    })

    const result = toRenderableGradient(fill)

    expect(core.createRenderGradientFillStyle).toHaveBeenCalledTimes(1)
    expectLinearGradientCall({
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
      colorStops: [
        { offset: 0, color: 'rgba(255, 255, 255, 0.5)' },
        { offset: 0.5, color: 'rgba(255, 0, 0, 0.4)' },
        { offset: 1, color: 'rgba(0, 0, 0, 0.3)' }
      ]
    })
    expect(result).toEqual({
      __gradientOptions: {
        type: 'linear',
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 1 },
        colorStops: [
          { offset: 0, color: 'rgba(255, 255, 255, 0.5)' },
          { offset: 0.5, color: 'rgba(255, 0, 0, 0.4)' },
          { offset: 1, color: 'rgba(0, 0, 0, 0.3)' }
        ],
        textureSpace: 'local'
      },
      fill: {
        mocked: true,
        options: {
          type: 'linear',
          start: { x: 0.5, y: 0 },
          end: { x: 0.5, y: 1 },
          colorStops: [
            { offset: 0, color: 'rgba(255, 255, 255, 0.5)' },
            { offset: 0.5, color: 'rgba(255, 0, 0, 0.4)' },
            { offset: 1, color: 'rgba(0, 0, 0, 0.3)' }
          ],
          textureSpace: 'local'
        }
      }
    })
  })

  it('passes translated linear handles directly to the renderer', () => {
    const fill = createGradientFill({
      gradient: {
        gradientType: FillGradientTypes.LINEAR,
        gradientStops: [
          {
            position: 0,
            color: '#ffffff',
            opacity: 1
          },
          {
            position: 0.5,
            color: '#ff0000',
            opacity: 1
          },
          {
            position: 1,
            color: '#000000',
            opacity: 1
          }
        ],
        gradientHandles: [
          {
            x: 0.5,
            y: 0.25
          },
          {
            x: 0.5,
            y: 1
          }
        ],
        metadata: {}
      }
    })

    toRenderableGradient(fill)

    expectLinearGradientCall({
      start: { x: 0.5, y: 0.25 },
      end: { x: 0.5, y: 1 },
      colorStops: [
        { offset: 0, color: 'rgba(255, 255, 255, 1)' },
        { offset: 0.5, color: 'rgba(255, 0, 0, 1)' },
        { offset: 1, color: 'rgba(0, 0, 0, 1)' }
      ]
    })
  })

  it('keeps compressed handles without remapping stops', () => {
    const fill = createGradientFill({
      gradient: {
        gradientType: FillGradientTypes.LINEAR,
        gradientStops: [
          {
            position: 0,
            color: '#ffffff',
            opacity: 1
          },
          {
            position: 1,
            color: '#000000',
            opacity: 1
          }
        ],
        gradientHandles: [
          {
            x: 0.5,
            y: 0.25
          },
          {
            x: 0.5,
            y: 0.75
          }
        ],
        metadata: {}
      }
    })

    toRenderableGradient(fill)

    expectLinearGradientCall({
      start: { x: 0.5, y: 0.25 },
      end: { x: 0.5, y: 0.75 },
      colorStops: [
        { offset: 0, color: 'rgba(255, 255, 255, 1)' },
        { offset: 1, color: 'rgba(0, 0, 0, 1)' }
      ]
    })
  })

  it('keeps reversed vertical handles as a reversed render vector', () => {
    const fill = createGradientFill({
      gradient: {
        gradientType: FillGradientTypes.LINEAR,
        gradientStops: [
          {
            position: 0,
            color: '#ffffff',
            opacity: 1
          },
          {
            position: 0.5,
            color: '#ff0000',
            opacity: 1
          },
          {
            position: 1,
            color: '#000000',
            opacity: 1
          }
        ],
        gradientHandles: [
          {
            x: 0.5,
            y: 1
          },
          {
            x: 0.5,
            y: 0
          }
        ],
        metadata: {}
      }
    })

    toRenderableGradient(fill)

    expectLinearGradientCall({
      start: { x: 0.5, y: 1 },
      end: { x: 0.5, y: 0 },
      colorStops: [
        { offset: 0, color: 'rgba(255, 255, 255, 1)' },
        { offset: 0.5, color: 'rgba(255, 0, 0, 1)' },
        { offset: 1, color: 'rgba(0, 0, 0, 1)' }
      ]
    })
  })

  it('passes out-of-bounds handles without remapping stops', () => {
    const fill = createGradientFill({
      gradient: {
        gradientType: FillGradientTypes.LINEAR,
        gradientStops: [
          {
            position: 0,
            color: '#ffffff',
            opacity: 1
          },
          {
            position: 0.5,
            color: '#ff0000',
            opacity: 1
          },
          {
            position: 1,
            color: '#000000',
            opacity: 1
          }
        ],
        gradientHandles: [
          {
            x: 0.5,
            y: -0.25
          },
          {
            x: 0.5,
            y: 1
          }
        ],
        metadata: {}
      }
    })

    toRenderableGradient(fill)

    expectLinearGradientCall({
      start: { x: 0.5, y: -0.25 },
      end: { x: 0.5, y: 1 },
      colorStops: [
        { offset: 0, color: 'rgba(255, 255, 255, 1)' },
        { offset: 0.5, color: 'rgba(255, 0, 0, 1)' },
        { offset: 1, color: 'rgba(0, 0, 0, 1)' }
      ]
    })
  })

  it('maps radial gradients with start as center and end as extent', () => {
    const fill = createGradientFill({
      gradient: {
        gradientType: FillGradientTypes.RADIAL,
        gradientStops: [
          {
            position: 0,
            color: '#ffffff',
            opacity: 1
          },
          {
            position: 1,
            color: '#000000',
            opacity: 1
          }
        ],
        gradientHandles: [
          {
            x: 0.5,
            y: 0.25
          },
          {
            x: 0.5,
            y: 0.75
          }
        ],
        metadata: {}
      }
    })

    toRenderableGradient(fill)

    expect(core.createRenderGradientFillStyle).toHaveBeenCalledWith({
      type: 'radial',
      start: { x: 0.5, y: 0.25 },
      end: { x: 0.5, y: 0.75 },
      colorStops: [
        { offset: 0, color: 'rgba(255, 255, 255, 1)' },
        { offset: 1, color: 'rgba(0, 0, 0, 1)' }
      ],
      textureSpace: 'local'
    })
  })

  it('maps elliptical radial gradients with 3rd handle as radiusY', () => {
    const fill = createGradientFill({
      gradient: {
        gradientType: FillGradientTypes.RADIAL,
        gradientStops: [
          {
            position: 0,
            color: '#ffffff',
            opacity: 1
          },
          {
            position: 1,
            color: '#000000',
            opacity: 1
          }
        ],
        gradientHandles: [
          {
            x: 0.5,
            y: 0.5
          },
          {
            x: 1.0,
            y: 0.5
          },
          {
            x: 0.5,
            y: 0.75
          }
        ],
        metadata: {}
      }
    })

    toRenderableGradient(fill)

    expect(core.createRenderGradientFillStyle).toHaveBeenCalledWith({
      type: 'radial',
      start: { x: 0.5, y: 0.5 },
      end: { x: 1.0, y: 0.5 },
      colorStops: [
        { offset: 0, color: 'rgba(255, 255, 255, 1)' },
        { offset: 1, color: 'rgba(0, 0, 0, 1)' }
      ],
      textureSpace: 'local',
      radiusY: 0.25
    })
  })

  it('maps angular gradients with start as center and end as direction', () => {
    const fill = createGradientFill({
      gradient: {
        gradientType: FillGradientTypes.ANGULAR,
        gradientStops: [
          {
            position: 0,
            color: '#ffffff',
            opacity: 1
          },
          {
            position: 1,
            color: '#000000',
            opacity: 1
          }
        ],
        gradientHandles: [
          {
            x: 0.5,
            y: 0
          },
          {
            x: 0.5,
            y: 1
          }
        ],
        metadata: {}
      }
    })

    toRenderableGradient(fill)

    expect(core.createRenderGradientFillStyle).toHaveBeenCalledWith({
      type: 'angular',
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
      colorStops: [
        { offset: 0, color: 'rgba(255, 255, 255, 1)' },
        { offset: 1, color: 'rgba(0, 0, 0, 1)' }
      ],
      textureSpace: 'local'
    })
  })

  it('maps diamond gradients with start as center and end as direction', () => {
    const fill = createGradientFill({
      gradient: {
        gradientType: FillGradientTypes.DIAMOND,
        gradientStops: [
          {
            position: 0,
            color: '#ffffff',
            opacity: 1
          },
          {
            position: 1,
            color: '#000000',
            opacity: 1
          }
        ],
        gradientHandles: [
          {
            x: 0.5,
            y: 0.25
          },
          {
            x: 0.5,
            y: 0.75
          }
        ],
        metadata: {}
      }
    })

    toRenderableGradient(fill)

    expect(core.createRenderGradientFillStyle).toHaveBeenCalledWith({
      type: 'diamond',
      start: { x: 0.5, y: 0.25 },
      end: { x: 0.5, y: 0.75 },
      colorStops: [
        { offset: 0, color: 'rgba(255, 255, 255, 1)' },
        { offset: 1, color: 'rgba(0, 0, 0, 1)' }
      ],
      textureSpace: 'local'
    })
  })

  it('falls back to linear for unknown gradient types', () => {
    const fill = createGradientFill({
      gradient: {
        gradientType: 'some-future-type',
        gradientStops: [
          {
            position: 0,
            color: '#ffffff',
            opacity: 1
          },
          {
            position: 1,
            color: '#000000',
            opacity: 1
          }
        ],
        gradientHandles: [
          {
            x: 0.5,
            y: 0
          },
          {
            x: 0.5,
            y: 1
          }
        ],
        metadata: {}
      }
    })

    toRenderableGradient(fill)

    expect(core.createRenderGradientFillStyle).toHaveBeenCalledWith({
      type: 'linear',
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
      colorStops: [
        { offset: 0, color: 'rgba(255, 255, 255, 1)' },
        { offset: 1, color: 'rgba(0, 0, 0, 1)' }
      ],
      textureSpace: 'local'
    })
  })
})
