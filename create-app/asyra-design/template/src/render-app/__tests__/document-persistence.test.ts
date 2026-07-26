import {
  IndexedDbPersistence,
  type IPersistenceProvider
} from '@asyra/reactive-events'
import type { CoreRawData } from '@asyra/utils'
import { indexedDB } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearDocumentPersistence,
  createDocumentPersistence,
  getDocumentStorageKey,
  initializeDocumentPersistence
} from '../../document-persistence'

const EMPTY_DOCUMENT = {
  version: '1.0.0',
  sceneTree: { workspace: '', workspaceList: [], elements: {} },
  props: {}
} as const satisfies CoreRawData

const EXISTING_DOCUMENT = {
  version: '1.0.0',
  sceneTree: {
    workspace: 'workspace-existing',
    workspaceList: ['workspace-existing'],
    elements: {}
  },
  props: {}
} satisfies CoreRawData

const CURRENT_DOCUMENT = {
  version: '1.0.0',
  sceneTree: {
    workspace: 'workspace-current',
    workspaceList: ['workspace-current'],
    elements: {}
  },
  props: {}
} satisfies CoreRawData

const documentKeys = ['FILE', 'FILE:file-1']

const createTestPersistence = (fileId?: string) =>
  new IndexedDbPersistence(getDocumentStorageKey(fileId), {
    factory: indexedDB
  })

describe('Asyra Design document persistence', () => {
  beforeEach(async () => {
    vi.stubGlobal('indexedDB', indexedDB)
    localStorage.clear()
    await Promise.all(
      documentKeys.map((key) =>
        new IndexedDbPersistence(key, { factory: indexedDB }).clear()
      )
    )
  })

  afterEach(async () => {
    await Promise.all(
      documentKeys.map((key) =>
        new IndexedDbPersistence(key, { factory: indexedDB }).clear()
      )
    )
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('selects IndexedDB for ordinary and collaboration document identities', () => {
    expect(createDocumentPersistence().name).toBe('IndexedDB')
    expect(createDocumentPersistence('file-1').name).toBe('IndexedDB')
  })

  it('initializes an absent document in IndexedDB without writing localStorage', async () => {
    const persistence = createTestPersistence()

    await initializeDocumentPersistence(persistence, EMPTY_DOCUMENT)

    await expect(persistence.load()).resolves.toEqual(EMPTY_DOCUMENT)
    expect(localStorage.getItem('FILE')).toBeNull()
  })

  it('migrates a valid legacy snapshot only when IndexedDB is empty', async () => {
    localStorage.setItem('FILE:file-1', JSON.stringify(EXISTING_DOCUMENT))
    const persistence = createTestPersistence('file-1')

    await initializeDocumentPersistence(persistence, EMPTY_DOCUMENT, 'file-1')

    await expect(persistence.load()).resolves.toEqual(EXISTING_DOCUMENT)
    expect(localStorage.getItem('FILE:file-1')).toBeNull()
  })

  it('keeps an existing IndexedDB document authoritative', async () => {
    const persistence = createTestPersistence('file-1')
    await persistence.save(CURRENT_DOCUMENT)
    localStorage.setItem('FILE:file-1', JSON.stringify(EXISTING_DOCUMENT))

    await initializeDocumentPersistence(persistence, EMPTY_DOCUMENT, 'file-1')

    await expect(persistence.load()).resolves.toEqual(CURRENT_DOCUMENT)
    expect(JSON.parse(localStorage.getItem('FILE:file-1') ?? '')).toEqual(
      EXISTING_DOCUMENT
    )
  })

  it('preserves the legacy snapshot when its durable migration write fails', async () => {
    localStorage.setItem('FILE', JSON.stringify(EXISTING_DOCUMENT))
    const migrationFailure = new Error('IndexedDB quota unavailable')
    const persistence = {
      name: 'failing-indexed-db',
      load: vi.fn(async () => null),
      save: vi.fn(async () => {
        throw migrationFailure
      }),
      clear: vi.fn(async () => undefined)
    } satisfies IPersistenceProvider

    await expect(
      initializeDocumentPersistence(persistence, EMPTY_DOCUMENT)
    ).rejects.toBe(migrationFailure)

    expect(JSON.parse(localStorage.getItem('FILE') ?? '')).toEqual(
      EXISTING_DOCUMENT
    )
  })

  it('does not delete an ineligible legacy snapshot', async () => {
    localStorage.setItem('FILE', JSON.stringify({ version: 42 }))
    const persistence = createTestPersistence()

    await initializeDocumentPersistence(persistence, EMPTY_DOCUMENT)

    await expect(persistence.load()).resolves.toEqual(EMPTY_DOCUMENT)
    expect(localStorage.getItem('FILE')).toBe(JSON.stringify({ version: 42 }))
  })

  it('clears both durable and unmigrated legacy values for reset', async () => {
    const persistence = createTestPersistence('file-1')
    await persistence.save(EXISTING_DOCUMENT)
    localStorage.setItem('FILE:file-1', JSON.stringify(CURRENT_DOCUMENT))

    await clearDocumentPersistence('file-1')

    await expect(persistence.load()).resolves.toBeNull()
    expect(localStorage.getItem('FILE:file-1')).toBeNull()
  })
})
