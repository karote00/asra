import { describe, expect, it } from 'vitest'
import {
  createAsyraDesignServerCompositionArtifact,
  createAsyraDesignServerResponseRecord
} from '../../e2e/server-response-inbox'

describe('Asyra Design server response harness', () => {
  it('creates one exact versioned 16-item action batch without a parallel point graph', async () => {
    const record = await createAsyraDesignServerResponseRecord(
      'file-fast-16',
      16
    )

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
    const artifact = action.arguments as {
      readonly artifactVersion: number
      readonly coordinates: ArrayBuffer
      readonly items: readonly unknown[]
      readonly pointCount: number
    }
    expect(artifact).toMatchObject({
      artifactVersion: 1,
      items: expect.any(Array),
      pointCount: 12_919
    })
    expect(artifact.items).toHaveLength(16)
    expect(artifact.coordinates).toBeInstanceOf(ArrayBuffer)
    expect(artifact.coordinates.byteLength).toBe(
      12_919 * 2 * Float64Array.BYTES_PER_ELEMENT
    )
    expect(JSON.stringify(artifact)).not.toMatch(/"points"\s*:/)
  })

  it('rejects a later invalid item before producing a compact artifact', () => {
    expect(() =>
      createAsyraDesignServerCompositionArtifact(
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
        'test-composition'
      )
    ).toThrow(/item 1 has an out-of-bounds point/i)
  })
})
