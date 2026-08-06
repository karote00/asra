import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createFormalInitialDocument } from '../../src/collaboration/initial-document'
import { createFileDocumentMaterializationStore } from '../document-backend-store'
import { createDocumentBackendServer } from '../document-backend'

const dataDirectory = resolve(
  process.cwd(),
  'server/__tests__/.document-backend-reset-store'
)

afterEach(async () => {
  await rm(dataDirectory, { force: true, recursive: true })
})

describe('document backend destructive Reset boundary', () => {
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
        durableSequence: 0
      })
    } finally {
      await backend.close()
    }
  })
})
