import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SharedPublication } from '@asyra/factory'
import {
  DocumentPublicationOutbox,
  IndexedDbPublicationOutboxStorage,
  type PendingDocumentPublication,
  type PublicationOutboxStorage
} from '../../collaboration/publication-outbox'

const createPublication = (
  publicationId: string,
  transactionId: number
): SharedPublication => ({
  publicationId,
  artifactId: `artifact-${publicationId}`,
  transactionId,
  origin: 'action',
  mode: 'atomic',
  slices: [
    {
      sliceId: `slice-${publicationId}`,
      orderedIds: [`delivery-${publicationId}`],
      batches: [
        {
          batchId: `batch-${publicationId}`,
          channel: 'props',
          deliveries: [
            {
              deliveryId: `delivery-${publicationId}`,
              eventName: 'updateProperty',
              orderedIds: [`position-${publicationId}`],
              payload: {
                action: 'updateProperty',
                eventName: 'updateProperty',
                id: `position-${publicationId}`,
                key: 'x',
                before: transactionId,
                after: transactionId + 1
              }
            }
          ]
        }
      ]
    }
  ]
})

const createStorage = (
  factory: IDBFactory,
  databaseName: string
): IndexedDbPublicationOutboxStorage =>
  new IndexedDbPublicationOutboxStorage({
    factory,
    databaseName
  })

describe('document publication recovery outbox', () => {
  let factory: IDBFactory

  beforeEach(() => {
    factory = new IDBFactory()
  })

  it('restores immutable publications in file-local append order after reload', async () => {
    const databaseName = 'publication-outbox-reload'
    const first = new DocumentPublicationOutbox({
      fileId: 'file-a',
      storage: createStorage(factory, databaseName)
    })
    await first.initialize()

    await first.append(createPublication('publication-a', 1))
    await first.append(createPublication('publication-b', 2))

    const reloaded = new DocumentPublicationOutbox({
      fileId: 'file-a',
      storage: createStorage(factory, databaseName)
    })
    await reloaded.initialize()

    expect(
      reloaded
        .getRecoverablePublications()
        .map(({ publication, appendOrder }) => [
          publication.publicationId,
          appendOrder
        ])
    ).toEqual([
      ['publication-a', 1],
      ['publication-b', 2]
    ])
    expect(reloaded.getState()).toEqual({
      pendingCount: 2,
      status: 'pending'
    })
    expect(reloaded.getRecoverablePublications()[0]).not.toHaveProperty(
      'document'
    )
    expect(reloaded.getRecoverablePublications()[0]).not.toHaveProperty(
      'history'
    )
  })

  it('removes exactly one entry only for matching socket source acceptance', async () => {
    const outbox = new DocumentPublicationOutbox({
      fileId: 'file-a',
      storage: createStorage(factory, 'publication-outbox-acceptance')
    })
    await outbox.initialize()
    await outbox.append(createPublication('publication-a', 1))
    await outbox.append(createPublication('publication-b', 2))

    await expect(
      outbox.acknowledge({
        publicationId: 'publication-missing',
        sequence: 3
      })
    ).resolves.toBe(false)
    expect(outbox.getState().pendingCount).toBe(2)

    await expect(
      outbox.acknowledge({
        publicationId: 'publication-a',
        sequence: 4
      })
    ).resolves.toBe(true)
    expect(
      outbox
        .getRecoverablePublications()
        .map(({ publication }) => publication.publicationId)
    ).toEqual(['publication-b'])
  })

  it('retains in-memory evidence and enters storage-failed when IndexedDB append fails', async () => {
    const failure = new DOMException('quota exceeded', 'QuotaExceededError')
    const storage: PublicationOutboxStorage = {
      load: vi.fn(async () => []),
      put: vi.fn(async () => {
        throw failure
      }),
      delete: vi.fn(async () => undefined)
    }
    const outbox = new DocumentPublicationOutbox({
      fileId: 'file-storage-failure',
      storage
    })
    await outbox.initialize()

    await expect(
      outbox.append(createPublication('publication-retained', 1))
    ).rejects.toMatchObject({
      name: 'PublicationOutboxStorageError',
      cause: failure
    })

    expect(outbox.getState()).toEqual({
      pendingCount: 1,
      status: 'storage-failed'
    })
    expect(
      outbox.getRecoverablePublications()[0]?.publication.publicationId
    ).toBe('publication-retained')
  })

  it('retains a rejected structural publication as a conflict instead of retrying it', async () => {
    const outbox = new DocumentPublicationOutbox({
      fileId: 'file-a',
      storage: createStorage(factory, 'publication-outbox-conflict')
    })
    await outbox.initialize()
    await outbox.append(createPublication('publication-conflict', 1))

    await outbox.retainConflict(
      'publication-conflict',
      'parent element no longer exists'
    )

    expect(outbox.getRecoverablePublications()).toEqual([])
    expect(outbox.getConflicts()).toEqual([
      expect.objectContaining({
        publication: expect.objectContaining({
          publicationId: 'publication-conflict'
        }),
        status: 'conflicted',
        failureReason: 'parent element no longer exists'
      })
    ])
    expect(outbox.getState()).toEqual({
      pendingCount: 1,
      status: 'conflicted'
    })

    const reloaded = new DocumentPublicationOutbox({
      fileId: 'file-a',
      storage: createStorage(factory, 'publication-outbox-conflict')
    })
    await reloaded.initialize()
    expect(reloaded.getConflicts()).toHaveLength(1)
    expect(reloaded.getRecoverablePublications()).toEqual([])
  })

  it('never replaces an existing publication identity with different content', async () => {
    const records: PendingDocumentPublication[] = []
    const storage: PublicationOutboxStorage = {
      load: vi.fn(async () => records),
      put: vi.fn(async (record) => {
        records.push(record)
      }),
      delete: vi.fn(async () => undefined)
    }
    const outbox = new DocumentPublicationOutbox({
      fileId: 'file-a',
      storage
    })
    await outbox.initialize()
    await outbox.append(createPublication('publication-a', 1))

    await expect(
      outbox.append(createPublication('publication-a', 9))
    ).rejects.toThrow(
      '[collaboration] publication identity was reused with different content'
    )
    expect(outbox.getState().pendingCount).toBe(1)
  })
})
