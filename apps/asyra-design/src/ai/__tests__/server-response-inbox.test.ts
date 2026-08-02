// @vitest-environment node

import type { AiActionBatch } from '@asyra/ai-agent-runtime'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreparedDrawingArtifact } from '../prepared-drawing-artifact'
import {
  SERVER_RESPONSE_INBOX_DATABASE_NAME,
  SERVER_RESPONSE_INBOX_DATABASE_VERSION,
  SERVER_RESPONSE_INBOX_STORE_NAME,
  SERVER_RESPONSE_SCHEMA_VERSION,
  readServerResponse,
  type ServerResponseRecord
} from '../server-response-inbox'

const createInline16ItemBatch = (): AiActionBatch => {
  const descriptors = Array.from({ length: 16 }, (_, index) => {
    const elementId = `oval-inline-${index}`
    return {
      fills: [],
      height: 10,
      id: elementId,
      lock: false,
      name: `Item ${index}`,
      props: {
        dimension: `${elementId}-dimension`,
        fills: `${elementId}-fills`,
        position: `${elementId}-position`,
        strokes: `${elementId}-strokes`
      },
      strokes: [],
      type: 'oval' as const,
      visible: true,
      width: 10,
      x: index * 10,
      y: 0
    }
  })
  const artifact: PreparedDrawingArtifact = {
    artifactVersion: 1,
    compositionRole: 'cat-face',
    elementCount: descriptors.length,
    groupBounds: { height: 40, width: 160, x: 0, y: 0 },
    groupDescriptor: {
      children: [],
      fills: [],
      height: 40,
      id: 'group-inline',
      lock: false,
      name: 'Cat face',
      props: {
        dimension: 'group-inline-dimension',
        fills: 'group-inline-fills',
        position: 'group-inline-position',
        strokes: 'group-inline-strokes'
      },
      strokes: [],
      type: 'group',
      visible: true,
      width: 160,
      x: 0,
      y: 0
    },
    parent: 'workspace',
    pointCount: 0,
    roleToElementIds: Object.fromEntries(
      descriptors.map(({ id }, index) => [`item-${index}`, [id]])
    ),
    skipped: [],
    slices: [
      {
        descriptors,
        pointCount: 0,
        roles: descriptors.map((_, index) => `item-${index}`)
      }
    ]
  }

  return {
    actions: [
      {
        arguments: artifact,
        id: 'insert-16',
        name: 'insert_vector_composition',
        summary: {
          affectedCount: 16,
          skippedCount: 0
        }
      }
    ],
    batchId: 'batch-16'
  }
}

const seedResponse = (
  factory: IDBFactory,
  key: string,
  value: unknown
): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = factory.open(
      SERVER_RESPONSE_INBOX_DATABASE_NAME,
      SERVER_RESPONSE_INBOX_DATABASE_VERSION
    )
    request.onupgradeneeded = () => {
      request.result.createObjectStore(SERVER_RESPONSE_INBOX_STORE_NAME)
    }
    request.onerror = () =>
      reject(request.error ?? new Error('Response inbox seed open failed'))
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction(
        SERVER_RESPONSE_INBOX_STORE_NAME,
        'readwrite'
      )
      transaction.objectStore(SERVER_RESPONSE_INBOX_STORE_NAME).put(value, key)
      transaction.oncomplete = () => {
        database.close()
        resolve()
      }
      transaction.onabort = () => {
        database.close()
        reject(
          transaction.error ??
            new Error('Response inbox seed transaction aborted')
        )
      }
      transaction.onerror = () => {
        database.close()
        reject(
          transaction.error ??
            new Error('Response inbox seed transaction failed')
        )
      }
    }
  })

describe('Asyra Design server response inbox', () => {
  let factory: IDBFactory

  beforeEach(() => {
    factory = new IDBFactory()
    vi.stubGlobal('indexedDB', factory)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null without creating an absent response inbox database', async () => {
    await expect(readServerResponse('file-fast-16')).resolves.toBeNull()

    await expect(factory.databases()).resolves.toEqual([])
  })

  it('reads only the exact versioned response selected by required fileId', async () => {
    const fast = {
      batch: createInline16ItemBatch(),
      fileId: 'file-fast-16',
      schemaVersion: SERVER_RESPONSE_SCHEMA_VERSION
    } as const satisfies ServerResponseRecord
    const other = {
      batch: {
        actions: [],
        batchId: 'other-batch'
      },
      fileId: 'file-other',
      schemaVersion: SERVER_RESPONSE_SCHEMA_VERSION
    } as const satisfies ServerResponseRecord
    await seedResponse(factory, fast.fileId, fast)
    await seedResponse(factory, other.fileId, other)

    await expect(readServerResponse(fast.fileId)).resolves.toEqual(fast)
    await expect(readServerResponse('file-not-seeded')).resolves.toBeNull()
  })

  it('checks only the small exact record envelope and leaves batch content opaque', async () => {
    const opaqueBatch = {
      actions: 'server-owned-batch-content'
    }
    const record = {
      batch: opaqueBatch,
      fileId: 'file-opaque',
      schemaVersion: SERVER_RESPONSE_SCHEMA_VERSION
    } as unknown as ServerResponseRecord
    await seedResponse(factory, record.fileId, record)

    await expect(readServerResponse(record.fileId)).resolves.toEqual(record)

    await seedResponse(factory, 'file-invalid-envelope', {
      batch: createInline16ItemBatch(),
      expectedRequest: 'legacy routing input',
      fileId: 'different-file',
      schemaVersion: SERVER_RESPONSE_SCHEMA_VERSION
    })
    await expect(readServerResponse('file-invalid-envelope')).rejects.toThrow(
      /invalid server response/i
    )
  })
})
