import { describe, expect, it, vi } from 'vitest'
import {
  CRDT_7076_DEMO_FILE_ID,
  createInitialDocumentForFile
} from '../demo-document'

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
})
