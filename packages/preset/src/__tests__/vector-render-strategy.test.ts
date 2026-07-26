import { RenderContainer, RenderGraphics } from '@asyra/render'
import { createDefaultStroke } from '@asyra/utils'
import { describe, expect, it } from 'vitest'
import { VECTOR_RENDER_STRATEGY } from '../components/vector'

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
})
