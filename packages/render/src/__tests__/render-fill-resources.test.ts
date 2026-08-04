import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecordingRenderEngine } from '@asyra/render-engine/testing'
import { FillKinds, createDefaultFill } from '@asyra/utils'
import {
  createEvenOddFillStyle,
  isPointInsidePreparedEvenOddShape,
  prepareEvenOddShape
} from '../fills/even-odd-fill.js'
import { createRenderGradientFillStyle } from '../fills/gradient-fill.js'
import { RenderGraphics, RenderObjectRuntime } from '../types/render-object.js'

class TestOffscreenCanvas {
  readonly context = {
    createImageData: (width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4)
    }),
    putImageData: () => undefined
  }

  constructor(
    readonly width: number,
    readonly height: number
  ) {}

  getContext(): typeof this.context {
    return this.context
  }
}

describe('render fill resources', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('describes gradients as engine-neutral resources', () => {
    const options = {
      type: 'linear' as const,
      start: { x: 0.2, y: 0.3 },
      end: { x: 0.8, y: 0.9 },
      colorStops: [
        { offset: 0, color: '#ffffff' },
        { offset: 1, color: '#000000' }
      ],
      textureSpace: 'local' as const
    }

    expect(createRenderGradientFillStyle(options)).toEqual({
      fill: {
        __asyraRenderResourceDescriptor: {
          kind: 'gradient',
          data: options
        }
      }
    })
  })

  it('releases a shared resource after its last graphics owner clears', () => {
    const style = createRenderGradientFillStyle({
      type: 'linear',
      colorStops: [
        { offset: 0, color: '#ffffff' },
        { offset: 1, color: '#000000' }
      ]
    })
    const engine = new RecordingRenderEngine({ name: 'shared-fill-resource' })
    const initialized = engine.initialize({ host: {}, width: 2, height: 2 })
    const runtime = new RenderObjectRuntime(engine, initialized.root)
    const first = new RenderGraphics()
    const second = new RenderGraphics()
    first.rect(0, 0, 1, 1).fill(style)
    second.rect(1, 1, 1, 1).fill(style)
    runtime.attachRoot(first)
    runtime.attachRoot(second)
    runtime.flushDraws()
    expect(engine.getOwnedResourceCount()).toBe(1)

    first.clear()
    expect(engine.getOwnedResourceCount()).toBe(1)

    second.clear()
    expect(engine.getOwnedResourceCount()).toBe(0)
    expect(engine.getOperations().at(-1)?.type).toBe('destroy-resource')
  })

  it('describes even-odd raster output without constructing a concrete engine resource', () => {
    vi.stubGlobal('OffscreenCanvas', TestOffscreenCanvas)

    const result = createEvenOddFillStyle({
      width: 2,
      height: 2,
      shape: {
        paths: [
          {
            segments: [
              { type: 'line', points: [0, 0, 2, 0] },
              { type: 'line', points: [2, 0, 2, 2] },
              { type: 'line', points: [2, 2, 0, 2] },
              { type: 'line', points: [0, 2, 0, 0] }
            ]
          }
        ]
      },
      fills: [
        createDefaultFill({
          kind: FillKinds.SOLID,
          color: '#ff0000'
        })
      ]
    })

    expect(result).not.toBeNull()
    expect(result?.style.fill).toEqual({
      __asyraRenderResourceDescriptor: {
        kind: 'raster-pattern',
        data: {
          source: expect.any(TestOffscreenCanvas),
          width: 4,
          height: 4,
          repeat: 'no-repeat',
          scale: { x: 0.25, y: 0.25 }
        }
      }
    })
    expect(result?.dispose).toEqual(expect.any(Function))

    const engine = new RecordingRenderEngine({ name: 'fill-resource-test' })
    const initialized = engine.initialize({ host: {}, width: 2, height: 2 })
    const runtime = new RenderObjectRuntime(engine, initialized.root)
    const graphic = new RenderGraphics()
    runtime.attachRoot(graphic)
    graphic.rect(0, 0, 2, 2).fill(result?.style)
    runtime.flushDraws()

    expect(engine.getOwnedResourceCount()).toBe(1)
    result?.dispose()
    expect(engine.getOwnedResourceCount()).toBe(0)
    expect(engine.getOperations().at(-1)?.type).toBe('destroy-resource')
  })

  it('prepares one even-odd geometry contract for raster and hit consumers', () => {
    const prepared = prepareEvenOddShape({
      paths: [
        {
          segments: [
            { type: 'line', points: [0, 0, 10, 0] },
            { type: 'line', points: [10, 0, 10, 10] },
            { type: 'line', points: [10, 10, 0, 10] },
            { type: 'line', points: [0, 10, 0, 0] }
          ]
        },
        {
          segments: [
            { type: 'line', points: [3, 3, 7, 3] },
            { type: 'line', points: [7, 3, 7, 7] },
            { type: 'line', points: [7, 7, 3, 7] },
            { type: 'line', points: [3, 7, 3, 3] },
            { type: 'line', points: [1, 2, 3] }
          ]
        }
      ]
    })

    expect(isPointInsidePreparedEvenOddShape({ x: 1, y: 1 }, prepared)).toBe(
      true
    )
    expect(isPointInsidePreparedEvenOddShape({ x: 5, y: 5 }, prepared)).toBe(
      false
    )
    expect(isPointInsidePreparedEvenOddShape({ x: 11, y: 5 }, prepared)).toBe(
      false
    )
  })
})
