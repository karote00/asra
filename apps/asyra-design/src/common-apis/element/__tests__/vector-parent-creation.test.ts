import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createElementsInParent: vi.fn()
}))

vi.mock('../../../contexts', () => ({
  default: {
    createElementsInParent: mocks.createElementsInParent
  },
  render: null,
  sceneTree: {}
}))

import { vectorApis } from '../vector-apis'

describe('Vector direct parent creation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createElementsInParent.mockReturnValue(['vector-1'])
  })

  it('keeps workspace topology points and stores Group-local computed bounds', () => {
    const points = {
      pointA: {
        anchorType: 'sharp' as const,
        handleMode: 'none' as const,
        id: 'pointA',
        kind: 'anchor' as const,
        x: 100,
        y: 200
      },
      pointB: {
        anchorType: 'sharp' as const,
        handleMode: 'none' as const,
        id: 'pointB',
        kind: 'anchor' as const,
        x: 130,
        y: 240
      }
    }
    const segments = {
      segmentA: {
        endId: 'pointB',
        id: 'segmentA',
        inControlId: null,
        outControlId: null,
        startId: 'pointA'
      }
    }
    const networks = {
      networkA: {
        closed: false,
        id: 'networkA',
        pointIds: ['pointA', 'pointB'],
        segmentIds: ['segmentA']
      }
    }

    expect(
      vectorApis.createVectorElementsInParent(
        [
          {
            networks,
            parentId: 'group-1',
            parentWorkspaceOrigin: { x: 90, y: 180 },
            points,
            segments,
            type: 'vector'
          }
        ],
        'group-1',
        {
          sharedDelivery: 'transaction-end',
          undoable: true
        }
      )
    ).toEqual(['vector-1'])

    expect(mocks.createElementsInParent).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          height: 40,
          pointCoordinateSpace: 'workspace',
          points,
          type: 'vector',
          width: 30,
          x: 10,
          y: 20
        })
      ],
      'group-1',
      undefined,
      {
        sharedDelivery: 'transaction-end',
        undoable: true
      }
    )
  })
})
