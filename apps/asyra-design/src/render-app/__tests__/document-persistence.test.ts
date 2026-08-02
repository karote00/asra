import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CoreRawData } from '@asyra/utils'
import {
  DOCUMENT_DATABASE_ENDPOINT,
  activateDocumentPersistence,
  createDocumentPersistence,
  resetPersistedDocument
} from '../../document-persistence'

const createDocument = (workspace: string): CoreRawData => ({
  version: '1.0.0',
  sceneTree: {
    workspace,
    workspaceList: workspace ? [workspace] : [],
    elements: {}
  },
  props: {}
})

describe('file-scoped document persistence', () => {
  beforeEach(() => {
    activateDocumentPersistence(null)
  })

  it('loads, saves, and clears one file through the formal document database endpoint', async () => {
    const stored = createDocument('workspace-a')
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ document: stored }),
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        json: async () => undefined,
        ok: true,
        status: 204
      })
      .mockResolvedValueOnce({
        json: async () => undefined,
        ok: true,
        status: 204
      })
    const persistence = createDocumentPersistence('file/a', {
      fetch,
      createInitialDocument: () => createDocument('')
    })

    await expect(persistence.provider.load()).resolves.toEqual(stored)
    await persistence.provider.save(stored)
    await persistence.provider.clear()

    const endpoint = `${DOCUMENT_DATABASE_ENDPOINT}/file%2Fa`
    expect(fetch).toHaveBeenNthCalledWith(1, endpoint, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      method: 'GET'
    })
    expect(fetch).toHaveBeenNthCalledWith(2, endpoint, {
      body: JSON.stringify({ document: stored }),
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      method: 'PUT'
    })
    expect(fetch).toHaveBeenNthCalledWith(3, endpoint, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      method: 'DELETE'
    })
  })

  it('continues with the initial document and reports an unavailable database when load fails', async () => {
    const statuses: unknown[] = []
    const persistence = createDocumentPersistence('file-unavailable', {
      fetch: vi.fn(async () => {
        throw new Error('database offline')
      }),
      createInitialDocument: () => createDocument('initial-workspace'),
      onStatusChange: (status) => statuses.push(status)
    })

    await expect(persistence.provider.load()).resolves.toEqual(
      createDocument('initial-workspace')
    )
    expect(statuses).toEqual([
      expect.objectContaining({
        operation: 'load',
        status: 'unavailable'
      })
    ])
  })

  it('reports a failed local save, keeps the runtime commit, and recovers the serial queue', async () => {
    const statuses: unknown[] = []
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('database offline'))
      .mockResolvedValueOnce({
        json: async () => undefined,
        ok: true,
        status: 204
      })
    const persistence = createDocumentPersistence('file-save', {
      fetch,
      createInitialDocument: () => createDocument(''),
      onStatusChange: (status) => statuses.push(status)
    })

    await expect(
      persistence.provider.save(createDocument('workspace-1'))
    ).rejects.toThrow('Document database save failed')
    await expect(
      persistence.provider.save(createDocument('workspace-2'))
    ).resolves.toBeUndefined()
    expect(statuses).toEqual([
      expect.objectContaining({
        operation: 'save',
        status: 'unavailable'
      }),
      { status: 'available' }
    ])
  })

  it('serializes local saves through one provider queue', async () => {
    const order: string[] = []
    let finishFirstSave: (() => void) | undefined
    const firstSave = new Promise<void>((resolve) => {
      finishFirstSave = resolve
    })
    const provider = {
      name: 'test-provider',
      load: vi.fn(async () => null),
      clear: vi.fn(async () => undefined),
      save: vi
        .fn()
        .mockImplementationOnce(async () => {
          order.push('save-1:start')
          await firstSave
          order.push('save-1:end')
        })
        .mockImplementationOnce(async () => {
          order.push('save-2')
        })
    }
    const persistence = createDocumentPersistence('file-serial', {
      provider,
      createInitialDocument: () => createDocument('')
    })

    const first = persistence.provider.save(createDocument('workspace-1'))
    const second = persistence.provider.save(createDocument('workspace-2'))
    await Promise.resolve()
    expect(order).toEqual(['save-1:start'])

    finishFirstSave?.()
    await Promise.all([first, second])
    expect(order).toEqual(['save-1:start', 'save-1:end', 'save-2'])
  })

  it('persists a local reset through the active operation owner', async () => {
    const saves: CoreRawData[] = []
    const persistence = createDocumentPersistence('file-active', {
      provider: {
        name: 'test-provider',
        load: vi.fn(async () => null),
        clear: vi.fn(async () => undefined),
        save: vi.fn(async (data: CoreRawData) => {
          saves.push(data)
        })
      },
      createInitialDocument: () => createDocument('')
    })
    activateDocumentPersistence(persistence)

    const load = vi.fn()
    const save = vi.fn().mockResolvedValueOnce(createDocument(''))

    await resetPersistedDocument({ load, save })

    expect(load).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledWith(createDocument(''))
    expect(saves).toEqual([createDocument('')])
  })
})
