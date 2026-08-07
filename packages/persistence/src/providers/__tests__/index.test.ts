import { subscribeToBrowserDragPhases, type CoreRawData } from '@asyra/utils'
import { indexedDB } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IndexedDbPersistence, LocalStoragePersistence } from '..'

const DOCUMENT_A = {
  version: '1.0.0',
  sceneTree: {
    workspace: 'workspace-a',
    workspaceList: ['workspace-a'],
    elements: {}
  },
  props: {}
} satisfies CoreRawData

const DOCUMENT_B = {
  version: '1.0.0',
  sceneTree: {
    workspace: 'workspace-b',
    workspaceList: ['workspace-b'],
    elements: {}
  },
  props: {}
} satisfies CoreRawData

describe('LocalStoragePersistence', () => {
  let values: Map<string, string>

  beforeEach(() => {
    values = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps FILE as the default storage key', async () => {
    const persistence = new LocalStoragePersistence()

    await persistence.save(DOCUMENT_A)

    expect(values.get('FILE')).toBe(JSON.stringify(DOCUMENT_A))
  })

  it('isolates documents configured with different storage keys', async () => {
    const persistenceA = new LocalStoragePersistence('FILE:file-a')
    const persistenceB = new LocalStoragePersistence('FILE:file-b')

    await persistenceA.save(DOCUMENT_A)
    await persistenceB.save(DOCUMENT_B)

    await expect(persistenceA.load()).resolves.toEqual(DOCUMENT_A)
    await expect(persistenceB.load()).resolves.toEqual(DOCUMENT_B)

    await persistenceA.clear()

    await expect(persistenceA.load()).resolves.toBeNull()
    await expect(persistenceB.load()).resolves.toEqual(DOCUMENT_B)
  })
})

describe('IndexedDbPersistence', () => {
  it('attributes open, structured-clone put, and transaction acknowledgement separately', async () => {
    const persistence = new IndexedDbPersistence('FILE', {
      databaseName: 'persistence-attribution-test',
      factory: indexedDB
    })
    const phases: string[] = []
    const unsubscribe = subscribeToBrowserDragPhases((name) =>
      phases.push(name)
    )

    try {
      await persistence.save(DOCUMENT_A)

      expect(phases).toEqual([
        'persistence:indexeddb-open',
        'persistence:indexeddb-put',
        'persistence:indexeddb-transaction'
      ])
      await expect(persistence.load()).resolves.toEqual(DOCUMENT_A)
    } finally {
      unsubscribe()
    }
  })

  it('persists a document larger than localStorage quota without using localStorage', async () => {
    const localStorageSetItem = vi.fn(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: localStorageSetItem,
      removeItem: vi.fn()
    })
    const document = {
      ...DOCUMENT_A,
      systemContext: {
        highDetailFixture: 'x'.repeat(6 * 1024 * 1024)
      }
    } satisfies CoreRawData
    expect(JSON.stringify(document).length).toBeGreaterThan(5 * 1024 * 1024)

    const persistence = new IndexedDbPersistence('FILE', {
      databaseName: 'persistence-large-document-test',
      factory: indexedDB
    })

    await persistence.save(document)

    await expect(persistence.load()).resolves.toEqual(document)
    expect(localStorageSetItem).not.toHaveBeenCalled()
  })

  it('isolates keys and clears only the selected document', async () => {
    const databaseName = 'persistence-isolation-test'
    const persistenceA = new IndexedDbPersistence('FILE:file-a', {
      databaseName,
      factory: indexedDB
    })
    const persistenceB = new IndexedDbPersistence('FILE:file-b', {
      databaseName,
      factory: indexedDB
    })

    await persistenceA.save(DOCUMENT_A)
    await persistenceB.save(DOCUMENT_B)

    await expect(persistenceA.load()).resolves.toEqual(DOCUMENT_A)
    await expect(persistenceB.load()).resolves.toEqual(DOCUMENT_B)

    await persistenceA.clear()

    await expect(persistenceA.load()).resolves.toBeNull()
    await expect(persistenceB.load()).resolves.toEqual(DOCUMENT_B)
  })
})
