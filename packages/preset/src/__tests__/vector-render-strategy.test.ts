import {
  Render,
  RenderContainer,
  RenderGraphics,
  renderStrategyRegistry
} from '@asyra/render'
import { RecordingRenderEngine } from '@asyra/render-engine/testing'
import { createDefaultStroke } from '@asyra/utils'
import { describe, expect, it, vi } from 'vitest'
import {
  VECTOR_COMPONENT_DEFINITION,
  VECTOR_RENDER_STRATEGY
} from '../components/vector'

describe('vector render strategy', () => {
  it('renders the base one-pixel path for an open vector without fills', () => {
    const graphic = new RenderGraphics()

    VECTOR_RENDER_STRATEGY(graphic, {
      id: 'vector-1',
      type: 'vector',
      name: 'Vector',
      parentId: 'workspace-1',
      visible: true,
      lock: false,
      x: 20,
      y: 30,
      width: 80,
      height: 40,
      rotation: 0,
      closed: false,
      pointCoordinateSpace: 'workspace',
      fillRule: 'nonzero',
      fills: [],
      strokes: [
        createDefaultStroke({
          color: '#cccccc',
          visible: true,
          width: 1
        })
      ],
      points: {
        start: {
          id: 'start',
          kind: 'anchor',
          x: 20,
          y: 30,
          anchorType: 'sharp',
          handleMode: 'none'
        },
        end: {
          id: 'end',
          kind: 'anchor',
          x: 100,
          y: 70,
          anchorType: 'sharp',
          handleMode: 'none'
        }
      },
      segments: {
        segment: {
          id: 'segment',
          startId: 'start',
          endId: 'end'
        }
      },
      networks: {
        network: {
          id: 'network',
          pointIds: ['start', 'end'],
          segmentIds: ['segment'],
          closed: false
        }
      }
    })

    expect(graphic.getDrawOperations()).toEqual([
      { type: 'clear' },
      { type: 'move-to', x: 0, y: 0 },
      { type: 'line-to', x: 80, y: 40 },
      {
        type: 'stroke',
        paint: { color: 0xcccccc, alpha: 1 },
        width: 1
      }
    ])
  })

  it('keeps workspace points fixed when the vector is rendered inside a group', () => {
    const group = new RenderContainer({ x: 142, y: 158 })
    ;(
      group as RenderContainer & {
        __asyraType?: string
      }
    ).__asyraType = 'group'
    const graphic = group.addChild(new RenderGraphics())

    VECTOR_RENDER_STRATEGY(graphic, {
      id: 'vector-in-group',
      type: 'vector',
      name: 'Grouped Vector',
      parentId: 'group-1',
      visible: true,
      lock: false,
      x: 90,
      y: 0,
      width: 94,
      height: 74,
      rotation: 0,
      closed: true,
      pointCoordinateSpace: 'workspace',
      fillRule: 'nonzero',
      fills: [],
      strokes: [
        createDefaultStroke({
          color: '#cccccc',
          visible: true,
          width: 1
        })
      ],
      points: {
        start: {
          id: 'start',
          kind: 'anchor',
          x: 232,
          y: 232,
          anchorType: 'sharp',
          handleMode: 'none'
        },
        middle: {
          id: 'middle',
          kind: 'anchor',
          x: 278,
          y: 158,
          anchorType: 'sharp',
          handleMode: 'none'
        },
        end: {
          id: 'end',
          kind: 'anchor',
          x: 326,
          y: 232,
          anchorType: 'sharp',
          handleMode: 'none'
        }
      },
      segments: {
        first: {
          id: 'first',
          startId: 'start',
          endId: 'middle'
        },
        second: {
          id: 'second',
          startId: 'middle',
          endId: 'end'
        },
        third: {
          id: 'third',
          startId: 'end',
          endId: 'start'
        }
      },
      networks: {
        network: {
          id: 'network',
          pointIds: ['start', 'middle', 'end'],
          segmentIds: ['first', 'second', 'third'],
          closed: true
        }
      }
    })

    expect(graphic.getDrawOperations()).toEqual(
      expect.arrayContaining([
        { type: 'move-to', x: 0, y: 74 },
        { type: 'line-to', x: 46, y: 0 },
        { type: 'line-to', x: 94, y: 74 }
      ])
    )
    expect(graphic.toGlobal({ x: 0, y: 74 })).toEqual({ x: 232, y: 232 })
  })

  it('projects each ordinary Vector slice through at most one visible frame', async () => {
    const engine = new RecordingRenderEngine({
      name: 'ordinary-vector-slices'
    })
    const render = new Render({ engine })
    const app = await render.init(320, 240, 0xffffff)
    const appRender = vi.fn()
    app.render = appRender
    render.flushFrame()
    appRender.mockClear()

    const vectorType = VECTOR_COMPONENT_DEFINITION.type
    const previousStrategy = renderStrategyRegistry.get(vectorType)
    if (previousStrategy) {
      renderStrategyRegistry.unregister(vectorType)
    }
    const strategy = vi.fn(VECTOR_RENDER_STRATEGY)
    renderStrategyRegistry.register(vectorType, strategy)

    const createVector = (
      id: string,
      offset: number
    ): Parameters<Render['addElement']>[0] =>
      ({
        id,
        type: vectorType,
        name: id,
        parentId: 'workspace-1',
        visible: true,
        lock: false,
        x: offset,
        y: offset,
        width: 20,
        height: 10,
        rotation: 0,
        closed: false,
        pointCoordinateSpace: 'workspace',
        fillRule: 'nonzero',
        fills: [],
        strokes: [
          createDefaultStroke({
            color: '#cccccc',
            visible: true,
            width: 1
          })
        ],
        points: {
          start: {
            id: `${id}-start`,
            kind: 'anchor',
            x: offset,
            y: offset,
            anchorType: 'sharp',
            handleMode: 'none'
          },
          end: {
            id: `${id}-end`,
            kind: 'anchor',
            x: offset + 20,
            y: offset + 10,
            anchorType: 'sharp',
            handleMode: 'none'
          }
        },
        segments: {
          segment: {
            id: `${id}-segment`,
            startId: `${id}-start`,
            endId: `${id}-end`
          }
        },
        networks: {
          network: {
            id: `${id}-network`,
            pointIds: [`${id}-start`, `${id}-end`],
            segmentIds: [`${id}-segment`],
            closed: false
          }
        }
      }) as Parameters<Render['addElement']>[0]

    try {
      const firstSlice = [
        createVector('slice-a', 0),
        createVector('slice-b', 30),
        createVector('slice-c', 60)
      ]
      firstSlice.forEach((vector) => render.addElement(vector))
      expect(strategy.mock.calls.map(([, data]) => data)).toEqual(firstSlice)

      render.flushFrame()
      expect(appRender).toHaveBeenCalledOnce()
      expect(render.getElementById('slice-c')).toBeDefined()
      render.flushFrame()
      expect(appRender).toHaveBeenCalledOnce()

      const secondSlice = [
        createVector('slice-d', 90),
        createVector('slice-e', 120)
      ]
      secondSlice.forEach((vector) => render.addElement(vector))
      expect(strategy.mock.calls.map(([, data]) => data)).toEqual([
        ...firstSlice,
        ...secondSlice
      ])

      render.flushFrame()
      expect(appRender).toHaveBeenCalledTimes(2)
      expect(render.getElementById('slice-e')).toBeDefined()
      render.flushFrame()
      expect(appRender).toHaveBeenCalledTimes(2)
    } finally {
      renderStrategyRegistry.unregister(vectorType)
      if (previousStrategy) {
        renderStrategyRegistry.register(vectorType, previousStrategy)
      }
      render.dispose()
    }
  })
})
