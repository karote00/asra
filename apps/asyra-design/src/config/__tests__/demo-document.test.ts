import { describe, expect, it, vi } from 'vitest'
import { createInitialDocumentForFile } from '../demo-document'

describe('bundled demo document routing', () => {
  it('routes the bounded crdt-7076 first-50 file id to its own sample asset', async () => {
    const fetch = vi.fn(async (input: string) => {
      expect(input).toContain('/samples/crdt-7076-first-50/document.json.gz')
      throw new Error('bounded sample route reached')
    })

    await expect(
      createInitialDocumentForFile('crdt-7076-first-50-sample', fetch)
    ).rejects.toThrow('bounded sample route reached')
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
      createInitialDocumentForFile('crdt-7076-first-50-sample', async () => ({
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
})
