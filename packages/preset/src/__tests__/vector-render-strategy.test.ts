import { RenderGraphics } from '@asyra/render'
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
})
