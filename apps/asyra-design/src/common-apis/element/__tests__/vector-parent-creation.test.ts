import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { migrateWorkspaceVectorGeometryToLocal } from '../../../init/migrations/vector-local-geometry-migration'

const mocks = vi.hoisted(() => ({
  createElementsInParent: vi.fn(),
  elementLocalToWorkspace: vi.fn(
    (_elementId: string, position: { x: number; y: number }) => position
  ),
  getVectorComputedData: vi.fn(),
  getSystemProperty: vi.fn(),
  patchLocalComputedData: vi.fn(),
  patchElementProperties: vi.fn(),
  updateElementProperties: vi.fn(),
  runTransaction: vi.fn((operation: () => unknown) => operation()),
  workspaceToElementLocal: vi.fn(
    (_elementId: string, position: { x: number; y: number }) => position
  )
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  runTransaction: mocks.runTransaction
}))

vi.mock('../../../contexts', () => ({
  default: {
    createElementsInParent: mocks.createElementsInParent,
    getSystemProperty: mocks.getSystemProperty,
    patchLocalComputedData: mocks.patchLocalComputedData,
    patchElementProperties: mocks.patchElementProperties,
    updateElementProperties: mocks.updateElementProperties
  },
  render: {
    elementLocalToWorkspace: mocks.elementLocalToWorkspace,
    workspaceToElementLocal: mocks.workspaceToElementLocal
  },
  sceneTree: {
    getElementById: vi.fn((elementId: string) => ({
      getAllComputedData: () =>
        mocks.getVectorComputedData(elementId) ?? {
          x: 0,
          y: 0,
          width: 20,
          height: 10,
          closed: false,
          pointCoordinateSpace: 'local',
          points: {
            pointA: {
              anchorType: 'sharp',
              handleMode: 'none',
              id: 'pointA',
              kind: 'anchor',
              x: 0,
              y: 0
            },
            pointB: {
              anchorType: 'sharp',
              handleMode: 'none',
              id: 'pointB',
              kind: 'anchor',
              x: 20,
              y: 10
            }
          },
          segments: {
            segmentA: {
              endId: 'pointB',
              id: 'segmentA',
              inControlId: null,
              outControlId: null,
              startId: 'pointA'
            }
          },
          networks: {
            networkA: {
              closed: false,
              id: 'networkA',
              pointIds: ['pointA', 'pointB'],
              segmentIds: ['segmentA']
            }
          }
        }
    }))
  }
}))

vi.mock('../../selection', () => ({
  selectionApis: {
    clearVectorPointSelection: vi.fn(),
    clearVectorSegmentSelection: vi.fn(),
    getSelectedVectorPoints: vi.fn(() => []),
    getSelectedVectorSegments: vi.fn(() => [])
  }
}))

vi.mock('../../system-context', () => ({
  systemContextApis: {
    getHoveredVectorPoint: vi.fn(() => null),
    getHoveredVectorSegment: vi.fn(() => null),
    getHoveredVectorSegmentInsertPoint: vi.fn(() => null),
    getSelectedVectorPoint: vi.fn(() => null),
    setHoveredVectorPoint: vi.fn(),
    setHoveredVectorSegment: vi.fn(),
    setHoveredVectorSegmentInsertPoint: vi.fn(),
    setSelectedVectorPoint: vi.fn(),
    setSelectedVectorSegment: vi.fn()
  }
}))

import { vectorApis } from '../vector-apis'

describe('Vector direct parent creation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getVectorComputedData.mockReset()
    mocks.elementLocalToWorkspace.mockImplementation(
      (_elementId, position) => position
    )
    mocks.workspaceToElementLocal.mockImplementation(
      (_elementId, position) => position
    )
    mocks.createElementsInParent.mockReturnValue(['vector-1'])
    mocks.getSystemProperty.mockReturnValue(false)
  })

  it('stores stable Vector-local topology with Group-local element bounds', () => {
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
          pointCoordinateSpace: 'local',
          points: {
            pointA: {
              ...points.pointA,
              x: 0,
              y: 0
            },
            pointB: {
              ...points.pointB,
              x: 30,
              y: 40
            }
          },
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

describe('Vector canonical property commit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getVectorComputedData.mockReset()
    mocks.elementLocalToWorkspace.mockImplementation(
      (_elementId, position) => position
    )
    mocks.workspaceToElementLocal.mockImplementation(
      (_elementId, position) => position
    )
    mocks.getSystemProperty.mockReturnValue(false)
  })

  it('commits final topology as one ordered canonical property patch', () => {
    expect(vectorApis.removeVectorAnchorPoint('vector-1', 'pointB')).toBe(true)

    expect(mocks.patchElementProperties).toHaveBeenCalledOnce()
    expect(mocks.patchElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'vector-1',
          values: {
            width: 0.1,
            height: 0.1
          },
          records: [
            {
              key: 'points',
              remove: ['pointB']
            },
            {
              key: 'segments',
              remove: ['segmentA']
            },
            {
              key: 'networks',
              set: {
                networkA: {
                  closed: false,
                  pointIds: ['pointA'],
                  segmentIds: []
                }
              }
            }
          ]
        }
      ],
      {}
    )
    expect(mocks.patchLocalComputedData).not.toHaveBeenCalled()
    expect(mocks.runTransaction).toHaveBeenCalledOnce()
  })

  it('inverse-projects a transformed workspace point into one local record patch', () => {
    mocks.getVectorComputedData.mockReturnValue({
      x: 120,
      y: 50,
      width: 20,
      height: 10,
      closed: false,
      pointCoordinateSpace: 'local',
      points: {
        pointA: {
          anchorType: 'sharp',
          handleMode: 'none',
          id: 'pointA',
          kind: 'anchor',
          x: 0,
          y: 0
        },
        pointB: {
          anchorType: 'sharp',
          handleMode: 'none',
          id: 'pointB',
          kind: 'anchor',
          x: 20,
          y: 10
        }
      },
      segments: {
        segmentA: {
          endId: 'pointB',
          id: 'segmentA',
          inControlId: null,
          outControlId: null,
          startId: 'pointA'
        }
      },
      networks: {
        networkA: {
          closed: false,
          id: 'networkA',
          pointIds: ['pointA', 'pointB'],
          segmentIds: ['segmentA']
        }
      }
    })
    mocks.elementLocalToWorkspace.mockImplementation(
      (_elementId, position) => ({
        x: position.x + 120,
        y: position.y + 50
      })
    )
    mocks.workspaceToElementLocal.mockImplementation(
      (_elementId, position) => ({
        x: position.x - 120,
        y: position.y - 50
      })
    )

    expect(
      vectorApis.updateVectorAnchorPointPosition(
        'vector-1',
        'pointA',
        { x: 150, y: 90 },
        { skipResult: true }
      )
    ).toBe(true)

    expect(mocks.patchElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'vector-1',
          values: {
            width: 10,
            height: 30,
            closed: false
          },
          records: [
            {
              key: 'points',
              set: {
                pointA: {
                  anchorType: 'sharp',
                  handleMode: 'none',
                  kind: 'anchor',
                  x: 30,
                  y: 40
                }
              }
            }
          ]
        }
      ],
      {}
    )
  })

  it('preserves the current dimension transform while editing local geometry', () => {
    mocks.getVectorComputedData.mockReturnValue({
      x: 100,
      y: 50,
      width: 40,
      height: 30,
      closed: false,
      pointCoordinateSpace: 'local',
      points: {
        pointA: {
          anchorType: 'sharp',
          handleMode: 'none',
          id: 'pointA',
          kind: 'anchor',
          x: 0,
          y: 0
        },
        pointB: {
          anchorType: 'sharp',
          handleMode: 'none',
          id: 'pointB',
          kind: 'anchor',
          x: 20,
          y: 10
        }
      },
      segments: {
        segmentA: {
          endId: 'pointB',
          id: 'segmentA',
          inControlId: null,
          outControlId: null,
          startId: 'pointA'
        }
      },
      networks: {
        networkA: {
          closed: false,
          id: 'networkA',
          pointIds: ['pointA', 'pointB'],
          segmentIds: ['segmentA']
        }
      }
    })
    mocks.elementLocalToWorkspace.mockImplementation(
      (_elementId, position) => ({
        x: position.x * 2 + 100,
        y: position.y * 3 + 50
      })
    )
    mocks.workspaceToElementLocal.mockImplementation(
      (_elementId, position) => ({
        x: (position.x - 100) / 2,
        y: (position.y - 50) / 3
      })
    )

    expect(
      vectorApis.updateVectorAnchorPointPosition(
        'vector-1',
        'pointB',
        { x: 160, y: 110 },
        { skipResult: true }
      )
    ).toBe(true)

    expect(mocks.patchElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'vector-1',
          values: {
            width: 60,
            height: 60,
            closed: false
          },
          records: [
            {
              key: 'points',
              set: {
                pointB: {
                  anchorType: 'sharp',
                  handleMode: 'none',
                  kind: 'anchor',
                  x: 30,
                  y: 20
                }
              }
            }
          ]
        }
      ],
      {}
    )
  })

  it('keeps transient drag preview on the local computed route', () => {
    mocks.getSystemProperty.mockImplementation((key: string) =>
      ['pathEditingMode', 'mouseDragging'].includes(key)
    )

    expect(
      vectorApis.updateVectorAnchorPointPosition(
        'vector-1',
        'pointB',
        { x: 25, y: 15 },
        {
          skipResult: true,
          transientPreview: true,
          undoable: false
        }
      )
    ).toBe(true)

    expect(mocks.patchLocalComputedData).toHaveBeenCalledOnce()
    expect(mocks.patchLocalComputedData).toHaveBeenCalledWith([
      {
        elementId: 'vector-1',
        patch: expect.objectContaining({
          records: expect.objectContaining({
            points: expect.any(Object)
          })
        })
      }
    ])
    expect(mocks.patchElementProperties).not.toHaveBeenCalled()
    expect(mocks.runTransaction).not.toHaveBeenCalled()
  })

  it('keeps transient structural preview on the same local patch batch route', () => {
    mocks.getSystemProperty.mockImplementation((key: string) =>
      ['pathEditingMode', 'mouseDragging'].includes(key)
    )

    expect(
      vectorApis.appendVectorAnchorPoint(
        'vector-1',
        {
          id: 'pointC',
          type: 'sharp',
          x: 30,
          y: 20,
          inHandle: null,
          outHandle: null
        },
        {
          transientPreview: true,
          undoable: false
        }
      )
    ).toEqual(
      expect.objectContaining({
        point: expect.objectContaining({
          id: 'pointC',
          x: 30,
          y: 20
        })
      })
    )

    expect(mocks.patchLocalComputedData).toHaveBeenCalledOnce()
    expect(mocks.patchLocalComputedData).toHaveBeenCalledWith([
      {
        elementId: 'vector-1',
        patch: expect.objectContaining({
          records: expect.objectContaining({
            points: expect.any(Object)
          })
        })
      }
    ])
    expect(mocks.patchElementProperties).not.toHaveBeenCalled()
    expect(mocks.runTransaction).not.toHaveBeenCalled()
  })

  it('keeps immediate non-undoable drag delivery on the canonical route', () => {
    mocks.getSystemProperty.mockImplementation((key: string) =>
      ['pathEditingMode', 'mouseDragging'].includes(key)
    )

    expect(
      vectorApis.updateVectorAnchorPointPosition(
        'vector-1',
        'pointB',
        { x: 25, y: 15 },
        {
          sharedDelivery: 'immediate',
          skipResult: true,
          undoable: false
        }
      )
    ).toBe(true)

    expect(mocks.patchLocalComputedData).not.toHaveBeenCalled()
    expect(mocks.patchElementProperties).toHaveBeenCalledOnce()
    expect(mocks.runTransaction).toHaveBeenCalledOnce()
  })

  it('commits a final point move through canonical properties', () => {
    expect(
      vectorApis.updateVectorAnchorPointPosition(
        'vector-1',
        'pointB',
        { x: 25, y: 15 },
        {
          skipResult: true,
          undoable: true
        }
      )
    ).toBe(true)

    expect(mocks.patchElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'vector-1',
          values: {
            width: 25,
            height: 15,
            closed: false
          },
          records: [
            {
              key: 'points',
              set: {
                pointB: {
                  anchorType: 'sharp',
                  handleMode: 'none',
                  kind: 'anchor',
                  x: 25,
                  y: 15
                }
              }
            }
          ]
        }
      ],
      {
        undoable: true
      }
    )
    expect(mocks.patchLocalComputedData).not.toHaveBeenCalled()
  })

  it('commits accepted vector positions without point record patches', () => {
    const options = {
      sharedDelivery: 'immediate',
      undoable: true
    } as const
    mocks.updateElementProperties.mockImplementation(
      (patches: readonly { elementId: string }[]) =>
        patches.map(({ elementId }) => elementId)
    )

    expect(
      vectorApis.setVectorElementPositions(
        [
          {
            elementId: 'vector-1',
            position: { x: 10, y: 20 }
          },
          {
            elementId: 'vector-no-op',
            position: { x: 0, y: 0 }
          },
          {
            elementId: 'vector-invalid',
            position: { x: Number.NaN, y: 10 }
          },
          {
            elementId: 'vector-2',
            position: { x: -5, y: 15 }
          }
        ],
        options
      )
    ).toEqual(['vector-1', 'vector-2'])

    expect(mocks.updateElementProperties).toHaveBeenCalledOnce()
    const [patches, receivedOptions] =
      mocks.updateElementProperties.mock.calls[0]
    expect(receivedOptions).toBe(options)
    expect(
      patches.map((patch: { elementId: string }) => patch.elementId)
    ).toEqual(['vector-1', 'vector-2'])
    expect(patches[0]).toEqual({
      elementId: 'vector-1',
      values: {
        x: 10,
        y: 20
      }
    })
    expect(patches[1]).toEqual({
      elementId: 'vector-2',
      values: {
        x: -5,
        y: 15
      }
    })
  })

  it('keeps a 7,001-point Vector move point-count independent', () => {
    const points = Object.fromEntries(
      Array.from({ length: 7_001 }, (_, index) => {
        const pointId = `point-${index}`
        return [
          pointId,
          {
            anchorType: 'sharp' as const,
            handleMode: 'none' as const,
            id: pointId,
            kind: 'anchor' as const,
            x: index,
            y: index % 17
          }
        ]
      })
    )
    mocks.getVectorComputedData.mockReturnValue({
      x: 0,
      y: 0,
      width: 7_000,
      height: 16,
      closed: false,
      pointCoordinateSpace: 'local',
      points,
      segments: {},
      networks: {}
    })
    mocks.updateElementProperties.mockImplementation(
      (patches: readonly { elementId: string }[]) =>
        patches.map(({ elementId }) => elementId)
    )

    expect(
      vectorApis.setVectorElementPositions([
        {
          elementId: 'dense-vector',
          position: { x: 240, y: -80 }
        }
      ])
    ).toEqual(['dense-vector'])

    expect(mocks.updateElementProperties).toHaveBeenCalledOnce()
    const [patches] = mocks.updateElementProperties.mock.calls[0]
    expect(patches).toHaveLength(1)
    expect(patches[0].elementId).toBe('dense-vector')
    expect(patches[0].values).toEqual({
      x: 240,
      y: -80
    })
    expect(Object.hasOwn(patches[0], 'records')).toBe(false)
    expect(mocks.getVectorComputedData).toHaveBeenCalledOnce()
  })

  it('keeps moves for the first 50 crdt-7076 cat-face elements point-count independent', () => {
    type RawRecord = Record<string, unknown>
    const legacyDocument = JSON.parse(
      gunzipSync(
        readFileSync(
          resolve(process.cwd(), 'samples/crdt-7076/document.json.gz')
        )
      ).toString('utf8')
    ) as {
      version: string
      sceneTree: {
        workspace: string
        workspaceList: string[]
        elements: Record<string, RawRecord>
      }
      props: Record<string, RawRecord>
    }
    const first50Elements = Object.values(
      legacyDocument.sceneTree.elements
    ).slice(0, 50)
    const first50ElementIds = new Set(
      first50Elements.map((element) => element.id as string)
    )
    const selectedProps: Record<string, RawRecord> = {}
    for (const element of first50Elements) {
      const propertyRefs = element.props as Record<string, string> | undefined
      if (!propertyRefs) {
        continue
      }
      for (const propertyId of Object.values(propertyRefs)) {
        const property = legacyDocument.props[propertyId]
        if (!property) {
          continue
        }
        selectedProps[propertyId] = property
        for (const recordIds of [
          property.points,
          property.segments,
          property.networks
        ]) {
          if (!Array.isArray(recordIds)) {
            continue
          }
          for (const recordId of recordIds) {
            if (
              typeof recordId === 'string' &&
              legacyDocument.props[recordId]
            ) {
              selectedProps[recordId] = legacyDocument.props[recordId]
            }
          }
        }
      }
    }
    const boundedLegacyDocument = {
      version: legacyDocument.version,
      sceneTree: {
        workspace: legacyDocument.sceneTree.workspace,
        workspaceList: [...legacyDocument.sceneTree.workspaceList],
        elements: Object.fromEntries(
          first50Elements.map((element) => [
            element.id,
            Array.isArray(element.children)
              ? {
                  ...element,
                  children: element.children.filter(
                    (childId) =>
                      typeof childId === 'string' &&
                      first50ElementIds.has(childId)
                  )
                }
              : element
          ])
        )
      },
      props: selectedProps
    }
    const migrated = migrateWorkspaceVectorGeometryToLocal(
      boundedLegacyDocument
    )
    const migratedProps = migrated.props as unknown as Record<string, RawRecord>
    const vectorElements = Object.values(migrated.sceneTree.elements).filter(
      (element) => element.type === 'vector'
    )
    const readProperty = (element: RawRecord, key: string): RawRecord => {
      const propertyId = (element.props as Record<string, string>)[key]
      return migratedProps[propertyId]
    }
    const readRecordMap = (
      component: RawRecord,
      key: 'points' | 'segments' | 'networks'
    ) =>
      Object.fromEntries(
        (component[key] as string[]).map((recordId) => [
          recordId,
          migratedProps[recordId]
        ])
      )
    const computedById = new Map(
      vectorElements.map((element) => {
        const position = readProperty(element, 'position')
        const dimension = readProperty(element, 'dimension')
        const pointSpace = readProperty(element, 'pointCoordinateSpace')
        const pointsComponent = readProperty(element, 'points')
        const segmentsComponent = readProperty(element, 'segments')
        const networksComponent = readProperty(element, 'networks')
        return [
          element.id,
          {
            x: position.x,
            y: position.y,
            width: dimension.width,
            height: dimension.height,
            pointCoordinateSpace: pointSpace.pointCoordinateSpace,
            points: readRecordMap(pointsComponent, 'points'),
            segments: readRecordMap(segmentsComponent, 'segments'),
            networks: readRecordMap(networksComponent, 'networks')
          }
        ]
      })
    )
    const pointCounts = vectorElements.map(
      (element) =>
        (readProperty(element, 'points').points as readonly string[]).length
    )
    expect(first50Elements).toHaveLength(50)
    expect(vectorElements).toHaveLength(48)
    expect(pointCounts.reduce((total, count) => total + count, 0)).toBe(22_928)
    expect(pointCounts.filter((count) => count > 1_000)).toHaveLength(5)
    mocks.getVectorComputedData.mockImplementation((elementId: string) =>
      computedById.get(elementId)
    )
    mocks.updateElementProperties.mockImplementation(
      (patches: readonly { elementId: string }[]) =>
        patches.map(({ elementId }) => elementId)
    )

    const updates = vectorElements.map((element) => {
      const computed = computedById.get(element.id)
      return {
        elementId: element.id,
        position: {
          x: (computed?.x as number) + 24,
          y: (computed?.y as number) - 12
        }
      }
    })
    expect(vectorApis.setVectorElementPositions(updates)).toEqual(
      vectorElements.map((element) => element.id)
    )

    expect(mocks.updateElementProperties).toHaveBeenCalledOnce()
    const [patches] = mocks.updateElementProperties.mock.calls[0]
    expect(patches).toHaveLength(48)
    for (const patch of patches) {
      expect(Object.keys(patch)).toEqual(['elementId', 'values'])
      expect(Object.keys(patch.values).sort()).toEqual(['x', 'y'])
      expect(patch).not.toHaveProperty('records')
    }
  })

  it('scales a Vector around its center through element transform values only', () => {
    mocks.getVectorComputedData.mockReturnValue({
      x: 100,
      y: 50,
      width: 20,
      height: 10,
      closed: false,
      pointCoordinateSpace: 'local',
      points: {
        pointA: {
          anchorType: 'sharp',
          handleMode: 'none',
          id: 'pointA',
          kind: 'anchor',
          x: 0,
          y: 0
        },
        pointB: {
          anchorType: 'sharp',
          handleMode: 'none',
          id: 'pointB',
          kind: 'anchor',
          x: 20,
          y: 10
        }
      },
      segments: {},
      networks: {}
    })
    mocks.updateElementProperties.mockReturnValue(['vector-1'])
    const options = {
      sharedDelivery: 'immediate',
      undoable: true
    } as const

    expect(
      vectorApis.scaleVectorElementAroundCenter(
        'vector-1',
        { scaleX: 2, scaleY: 3 },
        options
      )
    ).toBe(true)

    expect(mocks.updateElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'vector-1',
          values: {
            x: 90,
            y: 40,
            width: 40,
            height: 30
          }
        }
      ],
      options
    )
    expect(mocks.patchElementProperties).not.toHaveBeenCalled()
  })

  it('delegates the single vector position convenience to batch-of-one', () => {
    const options = { undoable: true } as const
    const setVectorElementPositions = vi
      .spyOn(vectorApis, 'setVectorElementPositions')
      .mockReturnValue(['vector-1'])

    expect(
      vectorApis.setVectorElementPosition('vector-1', { x: 10, y: 20 }, options)
    ).toBe(true)
    expect(setVectorElementPositions).toHaveBeenCalledWith(
      [
        {
          elementId: 'vector-1',
          position: { x: 10, y: 20 }
        }
      ],
      options
    )
    setVectorElementPositions.mockRestore()
  })
})
