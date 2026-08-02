import {
  Render,
  RenderContainer,
  RenderGraphics,
  renderStrategyRegistry
} from '@asyra/render'
import { RecordingRenderEngine } from '@asyra/render-engine/testing'
import {
  createDefaultFill,
  createDefaultStroke,
  getElementGeometryLocalBounds
} from '@asyra/utils'
import { describe, expect, it, vi } from 'vitest'
import {
  VECTOR_COMPONENT_DEFINITION,
  VECTOR_RENDER_STRATEGY,
  getVectorRenderLocalPoint,
  getVectorRenderWorkspacePoint
} from '../components/vector'

describe('vector render strategy', () => {
  it('derives Render-local draw geometry from existing workspace-valued data without rewriting it', () => {
    const graphic = new RenderGraphics()
    const points = {
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
    }
    const data = {
      id: 'vector-existing-values',
      type: 'vector',
      name: 'Existing values',
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
      points,
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
    }

    expect(() => VECTOR_RENDER_STRATEGY(graphic, data as never)).not.toThrow()
    expect(graphic.getDrawOperations()).toContainEqual({
      type: 'poly',
      points: [
        { x: 0, y: 0 },
        { x: 80, y: 40 }
      ],
      close: false
    })
    expect(data.pointCoordinateSpace).toBe('workspace')
    expect(data.points).toBe(points)
    expect(points.start).toMatchObject({ x: 20, y: 30 })
    expect(points.end).toMatchObject({ x: 100, y: 70 })

    const retainedLocalStart = getVectorRenderLocalPoint(graphic, points.start)
    expect(retainedLocalStart).toEqual({ x: 0, y: 0 })
    if (!retainedLocalStart) {
      throw new Error('The retained render must expose the projected point')
    }
    expect(getVectorRenderWorkspacePoint(graphic, retainedLocalStart)).toEqual({
      x: points.start.x,
      y: points.start.y
    })
    graphic.x = 220
    graphic.y = 130
    expect(graphic.toGlobal(retainedLocalStart)).toEqual({ x: 220, y: 130 })

    const freshGraphic = new RenderGraphics()
    VECTOR_RENDER_STRATEGY(freshGraphic, {
      ...data,
      x: 220,
      y: 130
    } as never)
    const freshLocalStart = getVectorRenderLocalPoint(
      freshGraphic,
      points.start
    )
    expect(freshLocalStart).toEqual(retainedLocalStart)
    if (!freshLocalStart) {
      throw new Error('The rebuilt render must expose the projected point')
    }
    expect(freshGraphic.toGlobal(freshLocalStart)).toEqual({
      x: 220,
      y: 130
    })
    expect(freshGraphic.getDrawOperations()).toEqual(
      graphic.getDrawOperations()
    )
  })

  it('restores authored dimensions from existing geometry bounds after reload', () => {
    const graphic = new RenderGraphics()

    VECTOR_RENDER_STRATEGY(graphic, {
      id: 'vector-resized',
      type: 'vector',
      name: 'Resized Vector',
      parentId: 'workspace-1',
      visible: true,
      lock: false,
      x: 20,
      y: 30,
      width: 160,
      height: 80,
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
    } as never)

    expect(graphic.scale).toMatchObject({ x: 1, y: 1 })
    expect(graphic.toGlobal({ x: 80, y: 40 })).toEqual({
      x: 180,
      y: 110
    })
    expect(graphic.getDrawOperations()).toContainEqual({
      type: 'poly',
      points: [
        { x: 0, y: 0 },
        { x: 80, y: 40 }
      ],
      close: false
    })
  })

  it('derives the resize basis from cubic extrema rather than control bounds', () => {
    const graphic = new RenderGraphics()
    const localHeight = 57.735026918962575

    VECTOR_RENDER_STRATEGY(graphic, {
      id: 'vector-cubic-resized',
      type: 'vector',
      name: 'Resized Cubic Vector',
      parentId: 'workspace-1',
      visible: true,
      lock: false,
      x: 0,
      y: 0,
      width: 400,
      height: localHeight * 2,
      rotation: 0,
      closed: false,
      pointCoordinateSpace: 'workspace',
      fillRule: 'nonzero',
      fills: [],
      strokes: [],
      points: {
        start: {
          id: 'start',
          kind: 'anchor',
          x: 0,
          y: 0,
          anchorType: 'sharp',
          handleMode: 'none'
        },
        startControl: {
          id: 'startControl',
          kind: 'control',
          x: 100,
          y: 100,
          controlForId: 'start',
          controlRole: 'out'
        },
        endControl: {
          id: 'endControl',
          kind: 'control',
          x: 100,
          y: -100,
          controlForId: 'end',
          controlRole: 'in'
        },
        end: {
          id: 'end',
          kind: 'anchor',
          x: 200,
          y: 0,
          anchorType: 'sharp',
          handleMode: 'none'
        }
      },
      segments: {
        segment: {
          id: 'segment',
          startId: 'start',
          endId: 'end',
          outControlId: 'startControl',
          inControlId: 'endControl'
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
    } as never)

    const localBounds = getElementGeometryLocalBounds(graphic)
    expect(localBounds.x).toBe(0)
    expect(localBounds.y).toBe(0)
    expect(localBounds.width).toBe(200)
    expect(localBounds.height).toBeCloseTo(localHeight)
    expect(graphic.worldTransform.a).toBeCloseTo(2)
    expect(graphic.worldTransform.b).toBeCloseTo(0)
    expect(graphic.worldTransform.c).toBeCloseTo(0)
    expect(graphic.worldTransform.d).toBeCloseTo(2)
  })

  it('applies the Vector affine transform independently from local draw geometry', () => {
    const graphic = new RenderGraphics()

    VECTOR_RENDER_STRATEGY(graphic, {
      id: 'vector-affine',
      type: 'vector',
      name: 'Affine Vector',
      parentId: 'workspace-1',
      visible: true,
      lock: false,
      x: 20,
      y: 30,
      width: 80,
      height: 40,
      rotation: 0.4,
      scaleX: 2,
      scaleY: 3,
      skewX: 0.2,
      skewY: 0.1,
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
    } as never)

    expect(graphic.position).toMatchObject({ x: 20, y: 30 })
    expect(graphic.rotation).toBe(0.4)
    expect(graphic.scale).toMatchObject({ x: 2, y: 3 })
    expect(
      (
        graphic as unknown as {
          skew: { x: number; y: number }
        }
      ).skew
    ).toMatchObject({ x: 0.2, y: 0.1 })
    expect(graphic.getDrawOperations()).toContainEqual({
      type: 'poly',
      points: [
        { x: 0, y: 0 },
        { x: 80, y: 40 }
      ],
      close: false
    })
  })

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
      {
        type: 'poly',
        points: [
          { x: 0, y: 0 },
          { x: 80, y: 40 }
        ],
        close: false
      },
      {
        type: 'stroke',
        paint: { color: 0xcccccc, alpha: 1 },
        width: 1
      }
    ])
  })

  it('projects stable Render-local points through the Vector and Group transforms', () => {
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
        {
          type: 'poly',
          points: [
            { x: 0, y: 74 },
            { x: 46, y: 0 },
            { x: 94, y: 74 },
            { x: 0, y: 74 }
          ],
          close: true
        }
      ])
    )
    expect(graphic.toGlobal({ x: 0, y: 74 })).toEqual({ x: 232, y: 232 })
  })

  it('draws existing workspace topology without rewriting it', () => {
    const ownKeyReads = {
      points: 0,
      segments: 0,
      networks: 0
    }
    const trackOwnKeys = <T extends object>(
      value: T,
      key: keyof typeof ownKeyReads
    ): T =>
      new Proxy(value, {
        ownKeys: (target) => {
          ownKeyReads[key] += 1
          return Reflect.ownKeys(target)
        }
      })
    const graphic = new RenderGraphics()

    VECTOR_RENDER_STRATEGY(graphic, {
      id: 'canonical-workspace-vector',
      type: 'vector',
      name: 'Canonical Workspace Vector',
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
      points: trackOwnKeys(
        {
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
        'points'
      ),
      segments: trackOwnKeys(
        {
          segment: {
            id: 'segment',
            startId: 'start',
            endId: 'end'
          }
        },
        'segments'
      ),
      networks: trackOwnKeys(
        {
          network: {
            id: 'network',
            pointIds: ['start', 'end'],
            segmentIds: ['segment'],
            closed: false
          }
        },
        'networks'
      )
    })

    expect(ownKeyReads).toEqual({
      points: 0,
      segments: 0,
      networks: 1
    })
    expect(graphic.getDrawOperations()).toEqual([
      { type: 'clear' },
      {
        type: 'poly',
        points: [
          { x: 0, y: 0 },
          { x: 80, y: 40 }
        ],
        close: false
      },
      {
        type: 'stroke',
        paint: { color: 0xcccccc, alpha: 1 },
        width: 1
      }
    ])
  })

  it('preserves cubic topology when applying a nonzero fill', () => {
    const graphic = new RenderGraphics()

    VECTOR_RENDER_STRATEGY(graphic, {
      id: 'filled-cubic',
      type: 'vector',
      name: 'Filled cubic',
      parentId: 'workspace-1',
      visible: true,
      lock: false,
      x: 10,
      y: 20,
      width: 100,
      height: 80,
      rotation: 0,
      closed: true,
      pointCoordinateSpace: 'workspace',
      fillRule: 'nonzero',
      fills: [createDefaultFill({ color: '#336699' })],
      strokes: [],
      points: {
        start: {
          id: 'start',
          kind: 'anchor',
          x: 10,
          y: 20,
          anchorType: 'smooth',
          handleMode: 'mirrored'
        },
        end: {
          id: 'end',
          kind: 'anchor',
          x: 110,
          y: 100,
          anchorType: 'smooth',
          handleMode: 'mirrored'
        },
        out: {
          id: 'out',
          kind: 'control',
          x: 35,
          y: 20,
          controlForId: 'start',
          controlRole: 'out'
        },
        incoming: {
          id: 'incoming',
          kind: 'control',
          x: 85,
          y: 100,
          controlForId: 'end',
          controlRole: 'in'
        }
      },
      segments: {
        curve: {
          id: 'curve',
          startId: 'start',
          endId: 'end',
          outControlId: 'out',
          inControlId: 'incoming'
        },
        return: {
          id: 'return',
          startId: 'end',
          endId: 'start'
        }
      },
      networks: {
        network: {
          id: 'network',
          pointIds: ['start', 'end'],
          segmentIds: ['curve', 'return'],
          closed: true
        }
      }
    })

    const operations = graphic.getDrawOperations()
    const firstFillIndex = operations.findIndex(
      (operation) => operation.type === 'fill'
    )
    expect(firstFillIndex).toBeGreaterThan(0)
    expect(operations.slice(0, firstFillIndex)).toContainEqual({
      type: 'bezier-curve-to',
      controlPoint1: { x: 25, y: 0 },
      controlPoint2: { x: 75, y: 80 },
      destination: { x: 100, y: 80 }
    })
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
