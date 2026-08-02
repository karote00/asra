import { indexedDB } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CoreRawData } from '@asyra/utils'
import {
  activateDocumentPersistence,
  createDocumentPersistence,
  persistAcceptedRemoteDocument,
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

  it('loads a fresh document on a cache miss and isolates stored files', async () => {
    const databaseName = `document-persistence-${crypto.randomUUID()}`
    const fileA = createDocumentPersistence('file/a', {
      databaseName,
      factory: indexedDB,
      createEmptyDocument: () => createDocument('')
    })
    const fileB = createDocumentPersistence('file/b', {
      databaseName,
      factory: indexedDB,
      createEmptyDocument: () => createDocument('')
    })

    const firstEmpty = await fileA.provider.load()
    const secondEmpty = await fileA.provider.load()
    expect(firstEmpty).toEqual(createDocument(''))
    expect(secondEmpty).toEqual(createDocument(''))
    expect(firstEmpty).not.toBe(secondEmpty)

    const stored = createDocument('workspace-a')
    await fileA.provider.save(stored)
    await expect(fileA.provider.load()).resolves.toEqual(stored)
    await expect(fileB.provider.load()).resolves.toEqual(createDocument(''))
  })

  it('serializes local and accepted-remote saves through one provider queue', async () => {
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
      createEmptyDocument: () => createDocument('')
    })

    const first = persistence.provider.save(createDocument('workspace-1'))
    const second = persistence.provider.save(createDocument('workspace-2'))
    await Promise.resolve()
    expect(order).toEqual(['save-1:start'])

    finishFirstSave?.()
    await Promise.all([first, second])
    expect(order).toEqual(['save-1:start', 'save-1:end', 'save-2'])
  })

  it('persists accepted remote state and reset through the active owner', async () => {
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
      createEmptyDocument: () => createDocument('')
    })
    activateDocumentPersistence(persistence)

    const load = vi.fn()
    const save = vi
      .fn()
      .mockResolvedValueOnce(createDocument('workspace-remote'))
      .mockResolvedValueOnce(createDocument(''))

    await persistAcceptedRemoteDocument({ save })
    await resetPersistedDocument({ load, save })

    expect(load).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledWith(createDocument(''))
    expect(saves).toEqual([
      createDocument('workspace-remote'),
      createDocument('')
    ])
  })
})
