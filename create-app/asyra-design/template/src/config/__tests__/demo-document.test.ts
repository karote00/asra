import { describe, expect, it, vi } from 'vitest'
import {
  CRDT_7076_DEMO_FILE_ID,
  createInitialDocumentForFile,
  resetDemoDocument
} from '../demo-document'
import { createEmptyDocument } from '../empty-document'

const createStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    }
  }
}

describe('bundled demo document routing', () => {
  it('routes the crdt-7076 file id to the complete sample asset', async () => {
    const fetch = vi.fn(async (input: string) => {
      expect(input).toContain('/samples/crdt-7076/document.json.gz')
      throw new Error('complete sample route reached')
    })

    await expect(
      createInitialDocumentForFile(CRDT_7076_DEMO_FILE_ID, fetch)
    ).rejects.toThrow('complete sample route reached')
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('accepts a sample body already decoded by the browser content-encoding layer', async () => {
    const document = {
      version: '1.0.0',
      sceneTree: {
        workspace: 'workspace-1',
        workspaceList: ['workspace-1'],
        elements: {}
      },
      props: {}
    }
    const bytes = new TextEncoder().encode(JSON.stringify(document))

    await expect(
      createInitialDocumentForFile(CRDT_7076_DEMO_FILE_ID, async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
          )
      }))
    ).resolves.toEqual(document)
  })

  it('stores one empty 7076 demo document before forcing a browser refresh', async () => {
    const stored = createStorage()
    const order: string[] = []
    const storage = {
      getItem: stored.getItem,
      setItem: (key: string, value: string) => {
        order.push('save')
        stored.setItem(key, value)
      }
    }
    const reload = vi.fn(() => order.push('reload'))

    resetDemoDocument(CRDT_7076_DEMO_FILE_ID, { reload, storage })

    expect(reload).toHaveBeenCalledOnce()
    expect(order).toEqual(['save', 'reload'])
    await expect(
      createInitialDocumentForFile(
        CRDT_7076_DEMO_FILE_ID,
        vi.fn(async () => {
          throw new Error('the fixture must not reload after Reset')
        }),
        storage
      )
    ).resolves.toEqual(createEmptyDocument())
  })

  it('does not expose the demo Reset storage bypass to ordinary socket files', () => {
    const storage = createStorage()
    const reload = vi.fn()

    expect(() =>
      resetDemoDocument('ordinary-document', { reload, storage })
    ).toThrow('Reset is only available for the crdt-7076 demo')
    expect(reload).not.toHaveBeenCalled()
  })
})
