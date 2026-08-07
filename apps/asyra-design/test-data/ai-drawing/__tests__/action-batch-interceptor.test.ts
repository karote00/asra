import { gzipSync } from 'node:zlib'
import type { BrowserContext } from '@playwright/test'
import { describe, expect, it, vi } from 'vitest'
import {
  PREPARED_DRAWING_SLICE_ELEMENT_BUDGET,
  PREPARED_DRAWING_SLICE_POINT_BUDGET,
  type PreparedDrawingArtifact
} from '../../../src/ai/prepared-drawing-artifact'
import {
  createPreparedDrawingArtifact,
  createServerResponseRecord,
  installPreparedActionBatchInterceptor
} from '../../../e2e/action-batch-interceptor'

describe('Design App action-batch interceptor harness', () => {
  it('serves a prepared action batch through the formal HTTP endpoint without a startup inbox', async () => {
    const record = await createServerResponseRecord(
      'file-http-interceptor-16',
      16
    )
    const compressed = gzipSync(Buffer.from(JSON.stringify(record)))
    let routePattern = ''
    let routeHandler:
      | ((route: {
          fulfill(options: {
            body: string
            contentType: string
            status: number
          }): Promise<void>
          request(): { method(): string }
        }) => Promise<void>)
      | undefined
    const context = {
      request: {
        get: async () => ({
          body: async () => compressed,
          ok: () => true,
          status: () => 200
        })
      },
      route: async (
        pattern: string,
        handler: NonNullable<typeof routeHandler>
      ) => {
        routePattern = pattern
        routeHandler = handler
      }
    } as unknown as BrowserContext

    const metrics = await installPreparedActionBatchInterceptor(context, {
      appUrl: 'http://127.0.0.1:3000/?fileId=file-http-interceptor-16',
      fileId: 'file-http-interceptor-16',
      publicPath: '/prepared/action-batch.json.gz'
    })

    expect(routePattern).toBe('**/api/ai/action-batch')
    expect(routeHandler).toBeTypeOf('function')
    const fulfill = vi.fn(async () => undefined)
    await routeHandler?.({
      fulfill,
      request: () => ({ method: () => 'POST' })
    })
    expect(fulfill).toHaveBeenCalledWith({
      body: JSON.stringify(record.batch),
      contentType: 'application/json; charset=utf-8',
      status: 200
    })
    expect(metrics.compressedBytes).toBe(compressed.byteLength)
    expect(metrics.totalMs).toBeGreaterThanOrEqual(0)
    expect(context).not.toHaveProperty('newPage')
  })
  it('caps one prepared progressive work unit at 32 elements', () => {
    expect(PREPARED_DRAWING_SLICE_ELEMENT_BUDGET).toBe(32)
  })

  it('profiles a 64-element test response without changing canonical descriptor order or the point cap', async () => {
    const baseline = await createServerResponseRecord(
      'file-slice-profile-32',
      1280
    )
    const candidate = await createServerResponseRecord(
      'file-slice-profile-64',
      1280,
      { sliceElementBudget: 64 }
    )
    const baselineArtifact = baseline.batch.actions[0]
      ?.arguments as PreparedDrawingArtifact
    const candidateArtifact = candidate.batch.actions[0]
      ?.arguments as PreparedDrawingArtifact
    const descriptorIds = (artifact: PreparedDrawingArtifact) =>
      artifact.slices.flatMap(({ descriptors }) =>
        descriptors.map(({ id }) => id)
      )

    expect(descriptorIds(candidateArtifact)).toEqual(
      descriptorIds(baselineArtifact)
    )
    expect(candidateArtifact.slices.length).toBeLessThan(
      baselineArtifact.slices.length
    )
    expect(
      candidateArtifact.slices.every(
        ({ descriptors, pointCount }) =>
          descriptors.length <= 64 &&
          (pointCount <= PREPARED_DRAWING_SLICE_POINT_BUDGET ||
            descriptors.length === 1)
      )
    ).toBe(true)
    expect(candidateArtifact.elementCount).toBe(baselineArtifact.elementCount)
    expect(candidateArtifact.pointCount).toBe(baselineArtifact.pointCount)
  })

  it('creates one exact versioned 16-item action batch with directly consumable canonical slices', async () => {
    const record = await createServerResponseRecord('file-fast-16', 16)

    expect(Reflect.ownKeys(record).sort()).toEqual([
      'batch',
      'fileId',
      'schemaVersion'
    ])
    expect(record).toMatchObject({
      fileId: 'file-fast-16',
      schemaVersion: 1
    })
    expect(record.batch).toMatchObject({
      batchId: 'create-fast-crdt-response',
      explanation:
        'Create the deterministic fast CRDT response as ordinary editable vector elements'
    })
    expect(record.batch.actions).toHaveLength(1)

    const action = record.batch.actions[0]
    expect(action).toMatchObject({
      id: 'create-fast-crdt-response',
      name: 'insert_vector_composition',
      summary: {
        affectedCount: 16,
        bounds: {
          height: 941,
          width: 1672,
          x: 0,
          y: 0
        },
        pointCount: 12_919,
        skippedCount: 0
      }
    })
    const artifact = action.arguments as PreparedDrawingArtifact
    expect(artifact).toMatchObject({
      artifactVersion: 1,
      elementCount: 16,
      parent: 'workspace',
      pointCount: 12_919
    })
    expect(artifact.groupDescriptor).toMatchObject({
      children: [],
      type: 'group'
    })
    expect(artifact.groupDescriptor.id).toMatch(/^grp-[a-f0-9]{16}-1$/)
    expect(artifact.groupDescriptor).not.toHaveProperty('parentId')
    expect(Object.keys(artifact.groupDescriptor.props).sort()).toEqual([
      'dimension',
      'fills',
      'position',
      'strokes'
    ])
    expect(
      Object.values(artifact.groupDescriptor.props).every((propertyId) =>
        /^pp-[a-f0-9]{16}-\d+$/.test(propertyId)
      )
    ).toBe(true)
    expect(artifact.slices.length).toBeGreaterThan(1)
    expect(
      artifact.slices.every(
        ({ descriptors, pointCount, roles }) =>
          descriptors.length > 0 &&
          descriptors.length === roles.length &&
          descriptors.length <= PREPARED_DRAWING_SLICE_ELEMENT_BUDGET &&
          (pointCount <= PREPARED_DRAWING_SLICE_POINT_BUDGET ||
            descriptors.length === 1)
      )
    ).toBe(true)

    const descriptorEntries = artifact.slices.flatMap(
      ({ descriptors, roles }) =>
        descriptors.map((descriptor, index) => ({
          descriptor,
          role: roles[index]
        }))
    )
    expect(descriptorEntries).toHaveLength(16)
    expect(
      artifact.slices.reduce((total, { pointCount }) => total + pointCount, 0)
    ).toBe(12_919)

    const elementIds = descriptorEntries.map(({ descriptor }) => descriptor.id)
    expect(new Set(elementIds).size).toBe(16)
    expect(
      elementIds.every((elementId) =>
        /^vector-[a-f0-9]{16}-\d+$/.test(elementId)
      )
    ).toBe(true)
    expect(
      descriptorEntries.every(
        ({ descriptor }) => !Reflect.has(descriptor, 'parentId')
      )
    ).toBe(true)
    expect(
      descriptorEntries.map(({ descriptor }) => ({
        x: descriptor.x,
        y: descriptor.y
      }))
    ).toEqual(
      expect.arrayContaining([
        {
          x: 0,
          y: 0
        }
      ])
    )

    descriptorEntries.forEach(({ descriptor, role }) => {
      expect(Object.keys(descriptor.props).sort()).toEqual([
        'closed',
        'dimension',
        'fillRule',
        'fills',
        'networks',
        'pointCoordinateSpace',
        'points',
        'position',
        'segments',
        'strokes'
      ])
      expect(
        Object.values(descriptor.props).every((propertyId) =>
          /^pp-[a-f0-9]{16}-\d+$/.test(propertyId)
        )
      ).toBe(true)
      expect(artifact.roleToElementIds[role]).toEqual([descriptor.id])

      const points = descriptor.points as Readonly<
        Record<
          string,
          {
            readonly id: string
            readonly x: number
            readonly y: number
          }
        >
      >
      const segments = descriptor.segments as Readonly<
        Record<
          string,
          {
            readonly endId: string
            readonly id: string
            readonly startId: string
          }
        >
      >
      const networks = descriptor.networks as Readonly<
        Record<
          string,
          {
            readonly id: string
            readonly pointIds: readonly string[]
            readonly segmentIds: readonly string[]
          }
        >
      >
      const pointIds = Object.keys(points)
      const segmentIds = Object.keys(segments)
      const networkIds = Object.keys(networks)

      expect(pointIds.length).toBeGreaterThan(0)
      expect(segmentIds.length).toBeGreaterThan(0)
      expect(networkIds.length).toBeGreaterThan(0)
      expect(pointIds).toEqual(Object.values(points).map(({ id }) => id))
      expect(segmentIds).toEqual(Object.values(segments).map(({ id }) => id))
      expect(networkIds).toEqual(Object.values(networks).map(({ id }) => id))
      expect(pointIds.every((id) => /^tp-[a-f0-9]{16}-\d+$/.test(id))).toBe(
        true
      )
      expect(segmentIds.every((id) => /^ts-[a-f0-9]{16}-\d+$/.test(id))).toBe(
        true
      )
      expect(networkIds.every((id) => /^tn-[a-f0-9]{16}-\d+$/.test(id))).toBe(
        true
      )

      Object.values(segments).forEach((segment) => {
        expect(pointIds).toContain(segment.startId)
        expect(pointIds).toContain(segment.endId)
      })
      Object.values(networks).forEach((network) => {
        expect(network.pointIds.every((id) => pointIds.includes(id))).toBe(true)
        expect(network.segmentIds.every((id) => segmentIds.includes(id))).toBe(
          true
        )
      })

      const fills = descriptor.fills as readonly { readonly id: string }[]
      const strokes = descriptor.strokes as readonly { readonly id: string }[]
      expect(fills.every(({ id }) => /^fill-[a-f0-9]{16}-\d+$/.test(id))).toBe(
        true
      )
      expect(
        strokes.every(({ id }) => /^stroke-[a-f0-9]{16}-\d+$/.test(id))
      ).toBe(true)
      expect(descriptor.pointCoordinateSpace).toBe('workspace')
      expect(descriptor.fillRule).toBe('nonzero')
      expect(descriptor).not.toHaveProperty('properties')
      expect(descriptor).not.toHaveProperty('element')
    })

    expect(artifact.slices.flatMap(({ roles }) => roles)).toEqual(
      Object.keys(artifact.roleToElementIds)
    )
    expect(JSON.stringify(artifact)).not.toMatch(
      /"coordinates"|"items"|"paths"|"properties"|"element":/
    )

    const secondRecord = await createServerResponseRecord('file-fast-16', 16)
    expect(secondRecord).toEqual(record)
  })

  it('creates the exact maximum-detail response from 27,471 vectors and 295,794 points', async () => {
    const record = await createServerResponseRecord(
      'file-maximum-27471',
      27_471
    )
    const action = record.batch.actions[0]
    const artifact = action.arguments as PreparedDrawingArtifact

    expect(action.summary).toMatchObject({
      affectedCount: 27_471,
      pointCount: 295_794,
      skippedCount: 0
    })
    expect(artifact).toMatchObject({
      elementCount: 27_471,
      pointCount: 295_794
    })
    expect(
      artifact.slices.reduce(
        (count, { descriptors }) => count + descriptors.length,
        0
      )
    ).toBe(27_471)
    expect(
      artifact.slices.reduce((count, { pointCount }) => count + pointCount, 0)
    ).toBe(295_794)
    expect(
      artifact.slices.every(
        ({ descriptors, pointCount }) =>
          descriptors.length <= PREPARED_DRAWING_SLICE_ELEMENT_BUDGET &&
          (pointCount <= PREPARED_DRAWING_SLICE_POINT_BUDGET ||
            descriptors.length === 1)
      )
    ).toBe(true)
  })

  it('rejects a later invalid item before producing a prepared drawing artifact', () => {
    expect(() =>
      createPreparedDrawingArtifact(
        [
          {
            bounds: { height: 10, width: 10, x: 0, y: 0 },
            closed: false,
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 10 }
            ],
            primitive: 'vector',
            role: 'valid-first',
            style: { strokeColor: '#000000', strokeWidth: 1 }
          },
          {
            bounds: { height: 10, width: 10, x: 20, y: 20 },
            closed: false,
            points: [
              { x: 20, y: 20 },
              { x: 31, y: 30 }
            ],
            primitive: 'vector',
            role: 'invalid-second',
            style: { strokeColor: '#000000', strokeWidth: 1 }
          }
        ],
        {
          batchId: 'test-composition-batch',
          compositionRole: 'test-composition',
          fileId: 'test-file'
        }
      )
    ).toThrow(/item 1 has an out-of-bounds point/i)
  })

  it('prepares aggregate semantic role hints without replacing formal element roles', () => {
    const artifact = createPreparedDrawingArtifact(
      [
        {
          bounds: { height: 10, width: 10, x: 0, y: 0 },
          primitive: 'oval',
          role: 'left-pupil',
          style: { fillColor: '#000000' }
        },
        {
          bounds: { height: 10, width: 10, x: 20, y: 0 },
          primitive: 'oval',
          role: 'right-pupil',
          style: { fillColor: '#000000' }
        },
        {
          bounds: { height: 10, width: 20, x: 0, y: 20 },
          closed: false,
          points: [
            { x: 0, y: 20 },
            { x: 20, y: 30 }
          ],
          primitive: 'vector',
          role: 'left-whisker-1',
          style: { strokeColor: '#000000', strokeWidth: 1 }
        }
      ],
      {
        batchId: 'semantic-role-batch',
        compositionRole: 'cat-face',
        fileId: 'semantic-role-file'
      }
    )
    const formalRoles = artifact.slices.flatMap(({ roles }) => roles)

    expect(formalRoles).toEqual(['left-pupil', 'right-pupil', 'left-whisker-1'])
    expect(artifact.roleToElementIds).toMatchObject({
      'left-pupil': [artifact.slices[0].descriptors[0].id],
      'right-pupil': [artifact.slices[0].descriptors[1].id],
      'left-whisker-1': [artifact.slices[0].descriptors[2].id],
      pupils: [
        artifact.slices[0].descriptors[0].id,
        artifact.slices[0].descriptors[1].id
      ],
      whiskers: [artifact.slices[0].descriptors[2].id]
    })
    expect(formalRoles).not.toContain('pupils')
    expect(formalRoles).not.toContain('whiskers')
  })
})
