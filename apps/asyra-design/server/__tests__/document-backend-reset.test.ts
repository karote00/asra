import type { SharedPublication } from '@asyra/factory'
import { Buffer } from 'node:buffer'
import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createFormalInitialDocument } from '../../src/collaboration/initial-document'
import {
  CollaborationMessageTypes,
  encodePublicationMessageFrames
} from '../../src/collaboration/protocol'
import { createFileDocumentMaterializationStore } from '../document-backend-store'
import { createDocumentBackendServer } from '../document-backend'
import { createDocumentMaterializationService } from '../document-materializer'

const dataDirectory = resolve(
  process.cwd(),
  'server/__tests__/.document-backend-reset-store'
)

afterEach(async () => {
  await rm(dataDirectory, { force: true, recursive: true })
})

describe('document backend destructive Reset boundary', () => {
  it('retains the Reset generation when the next publication becomes durable', async () => {
    await mkdir(dataDirectory, { recursive: true })
    const store = createFileDocumentMaterializationStore(dataDirectory)
    await expect(store.resetCheckpoint('file/a')).resolves.toBe(1)
    const publication: SharedPublication = {
      publicationId: 'publication-after-reset',
      artifactId: 'artifact-after-reset',
      transactionId: 1,
      origin: 'action',
      mode: 'atomic',
      slices: [
        {
          sliceId: 'slice-after-reset',
          orderedIds: ['delivery-after-reset'],
          batches: [
            {
              batchId: 'batch-after-reset',
              channel: 'sceneTree',
              deliveries: [
                {
                  deliveryId: 'delivery-after-reset',
                  eventName: 'removeElements',
                  orderedIds: ['element-before-reset'],
                  payload: {
                    action: 'removeElements',
                    eventName: 'removeElements',
                    undoType: 'addElements',
                    undoAction: 'addElements',
                    entries: [
                      {
                        data: {
                          id: 'element-before-reset',
                          type: 'rectangle',
                          parentId: 'workspace',
                          props: {}
                        },
                        parentId: 'workspace',
                        index: 0
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      ]
    }
    const encodedPublicationFrames = encodePublicationMessageFrames({
      type: CollaborationMessageTypes.PUBLICATION,
      publication,
      fromActorId: 'actor-after-reset',
      sequence: 1
    }).map((frame) => Buffer.from(frame).toString('base64'))
    const materializer = createDocumentMaterializationService({
      store,
      authorize: async () => undefined,
      applyCanonicalChanges: async (document) => document
    })

    await materializer.materialize({
      protocolVersion: 1,
      batchId: 'persistence-batch-after-reset',
      documentId: 'file/a',
      expectedDurableSequence: 0,
      firstSequence: 1,
      lastSequence: 1,
      entries: [
        {
          documentId: 'file/a',
          sequence: 1,
          publicationId: publication.publicationId,
          encodedPublicationFrames
        }
      ]
    })

    await expect(store.readCheckpoint('file/a')).resolves.toMatchObject({
      documentGeneration: 1,
      durableSequence: 1
    })
  })

  it('replaces the stored checkpoint with one formal empty document', async () => {
    await mkdir(dataDirectory, { recursive: true })
    const store = createFileDocumentMaterializationStore(dataDirectory)
    await store.transact('file/a', async (current, commit) => {
      commit({
        ...current,
        document: {
          ...createFormalInitialDocument(),
          sceneTree: {
            workspace: 'workspace',
            workspaceList: ['workspace'],
            elements: {
              workspace: {
                id: 'workspace',
                type: 'workspace' as never,
                parentId: '',
                visible: true,
                lock: false,
                children: ['element-a']
              },
              'element-a': {
                id: 'element-a',
                type: 'rectangle' as never,
                parentId: 'workspace',
                visible: true,
                lock: false
              }
            }
          }
        },
        durableSequence: 7
      })
    })
    const backend = createDocumentBackendServer({
      dataDirectory,
      port: 0
    })
    const address = await backend.listen()

    try {
      const endpoint = `http://${address.host}:${String(
        address.port
      )}/api/documents/file%2Fa`
      const unrelatedDelete = await fetch(`${endpoint}/unknown`, {
        method: 'DELETE'
      })
      expect(unrelatedDelete.status).toBe(404)

      const reset = await fetch(endpoint, { method: 'DELETE' })

      expect(reset.status).toBe(200)
      const checkpoint = await fetch(`${endpoint}/bootstrap-checkpoint`)
      await expect(checkpoint.json()).resolves.toEqual({
        checkpoint: createFormalInitialDocument(),
        durableSequence: 0,
        documentGeneration: 1
      })

      const secondReset = await fetch(endpoint, { method: 'DELETE' })
      expect(secondReset.status).toBe(200)
      const secondCheckpoint = await fetch(`${endpoint}/bootstrap-checkpoint`)
      await expect(secondCheckpoint.json()).resolves.toEqual({
        checkpoint: createFormalInitialDocument(),
        durableSequence: 0,
        documentGeneration: 2
      })
    } finally {
      await backend.close()
    }
  })
})
