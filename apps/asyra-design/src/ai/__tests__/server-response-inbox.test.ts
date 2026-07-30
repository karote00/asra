// @vitest-environment node

import type { AiActionBatch } from '@asyra/ai-agent-runtime'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ASYRA_DESIGN_SERVER_RESPONSE_INBOX_DATABASE_NAME,
  ASYRA_DESIGN_SERVER_RESPONSE_INBOX_DATABASE_VERSION,
  ASYRA_DESIGN_SERVER_RESPONSE_INBOX_STORE_NAME,
  ASYRA_DESIGN_SERVER_RESPONSE_SCHEMA_VERSION,
  readAsyraDesignServerResponse,
  type AsyraDesignServerResponseRecord
} from '../server-response-inbox'

const createInline16ItemBatch = (): AiActionBatch => ({
  actions: [
    {
      arguments: {
        artifactVersion: 1,
        compositionRole: 'cat-face',
        coordinates: new ArrayBuffer(0),
        groupBounds: { height: 40, width: 160, x: 0, y: 0 },
        items: Array.from({ length: 16 }, (_, index) => ({
          bounds: { height: 10, width: 10, x: index * 10, y: 0 },
          pathCount: 0,
          pathStart: 0,
          pointCount: 0,
          primitive: 'oval',
          role: `item-${index}`,
          style: {}
        })),
        parent: 'workspace',
        paths: [],
        pointCount: 0,
        skipped: []
      },
      id: 'insert-16',
      name: 'insert_vector_composition',
      summary: {
        affectedCount: 16,
        skippedCount: 0
      }
    }
  ],
  batchId: 'batch-16'
})

const seedResponse = (
  factory: IDBFactory,
  key: string,
  value: unknown
): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = factory.open(
      ASYRA_DESIGN_SERVER_RESPONSE_INBOX_DATABASE_NAME,
      ASYRA_DESIGN_SERVER_RESPONSE_INBOX_DATABASE_VERSION
    )
    request.onupgradeneeded = () => {
      request.result.createObjectStore(
        ASYRA_DESIGN_SERVER_RESPONSE_INBOX_STORE_NAME
      )
    }
    request.onerror = () =>
      reject(request.error ?? new Error('Response inbox seed open failed'))
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction(
        ASYRA_DESIGN_SERVER_RESPONSE_INBOX_STORE_NAME,
        'readwrite'
      )
      transaction
        .objectStore(ASYRA_DESIGN_SERVER_RESPONSE_INBOX_STORE_NAME)
        .put(value, key)
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
    await expect(
      readAsyraDesignServerResponse('file-fast-16')
    ).resolves.toBeNull()

    await expect(factory.databases()).resolves.toEqual([])
  })

  it('reads only the exact versioned response selected by required fileId', async () => {
    const fast = {
      batch: createInline16ItemBatch(),
      fileId: 'file-fast-16',
      schemaVersion: ASYRA_DESIGN_SERVER_RESPONSE_SCHEMA_VERSION
    } as const satisfies AsyraDesignServerResponseRecord
    const other = {
      batch: {
        actions: [],
        batchId: 'other-batch'
      },
      fileId: 'file-other',
      schemaVersion: ASYRA_DESIGN_SERVER_RESPONSE_SCHEMA_VERSION
    } as const satisfies AsyraDesignServerResponseRecord
    await seedResponse(factory, fast.fileId, fast)
    await seedResponse(factory, other.fileId, other)

    await expect(readAsyraDesignServerResponse(fast.fileId)).resolves.toEqual(
      fast
    )
    await expect(
      readAsyraDesignServerResponse('file-not-seeded')
    ).resolves.toBeNull()
  })

  it('checks only the small exact record envelope and leaves batch content opaque', async () => {
    const opaqueBatch = {
      actions: 'server-owned-batch-content'
    }
    const record = {
      batch: opaqueBatch,
      fileId: 'file-opaque',
      schemaVersion: ASYRA_DESIGN_SERVER_RESPONSE_SCHEMA_VERSION
    } as unknown as AsyraDesignServerResponseRecord
    await seedResponse(factory, record.fileId, record)

    await expect(readAsyraDesignServerResponse(record.fileId)).resolves.toEqual(
      record
    )

    await seedResponse(factory, 'file-invalid-envelope', {
      batch: createInline16ItemBatch(),
      expectedRequest: 'legacy routing input',
      fileId: 'different-file',
      schemaVersion: ASYRA_DESIGN_SERVER_RESPONSE_SCHEMA_VERSION
    })
    await expect(
      readAsyraDesignServerResponse('file-invalid-envelope')
    ).rejects.toThrow(/invalid server response/i)
  })
})
