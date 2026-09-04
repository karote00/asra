import { describe, expect, it, vi } from 'vitest'
import { ProjectSession, type DocumentPorts } from '../project-session'
import {
  encodeProject,
  type ProjectRepository,
  type ProjectSnapshot,
  type StoredProject
} from '../project-format'

const snapshot = (): ProjectSnapshot => ({
  document: {
    version: '1.0.0',
    sceneTree: { workspace: '', workspaceList: [], elements: {} },
    props: {}
  },
  loadIssues: []
})
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  let reject: (reason: unknown) => void = () => undefined
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function fixture() {
  const records = new Map<string, StoredProject>()
  const repository: ProjectRepository = {
    read: vi.fn(async (id) => {
      const record = records.get(id)
      if (!record) throw new Error('missing')
      return structuredClone(record)
    }),
    write: vi.fn(async (record) => {
      records.set(record.id, structuredClone(record))
    }),
    list: vi.fn(async () => ({ projects: [], limited: false })),
    close: vi.fn()
  }
  const document: DocumentPorts = {
    capture: vi.fn(async () => snapshot()),
    apply: vi.fn(async (_data, guard) => {
      guard()
      return []
    })
  }
  const session = new ProjectSession(repository, document)
  return { session, repository, document, records }
}

describe('project persistence acknowledgement', () => {
  it('reports saved only after write acknowledgement and passes the expected saved revision on replacement', async () => {
    const { session, repository } = fixture(),
      write = deferred<undefined>()
    repository.write = vi.fn(() => write.promise)
    const saving = session.save('  Cell A  ')
    expect(session.getState().status).toBe('saving')
    await Promise.resolve()
    expect(session.getState().project).toBeNull()
    write.resolve(undefined)
    await saving
    const head = session.getState().project
    expect(head?.name).toBe('Cell A')
    expect(session.getState()).toMatchObject({
      status: 'saved',
      dirty: false,
      busy: null
    })
    await session.save('Renamed')
    expect(repository.write).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: head?.id, name: 'Renamed' }),
      head?.revision,
      expect.any(AbortSignal)
    )
    session.close()
  })
  it('keeps newer edits unsaved while the detached earlier snapshot reaches storage', async () => {
    const { session, repository } = fixture(),
      write = deferred<undefined>()
    repository.write = vi.fn(() => write.promise)
    const saving = session.save('Example')
    await Promise.resolve()
    session.markEdited()
    write.resolve(undefined)
    await saving
    expect(session.getState()).toMatchObject({
      status: 'unsaved',
      dirty: true,
      busy: null
    })
    session.close()
  })
  it('rejects overlapping operations and retains retryable failure instead of false saved state', async () => {
    const { session, repository } = fixture(),
      write = deferred<undefined>()
    repository.write = vi.fn(() => write.promise)
    const saving = session.save('Example')
    await expect(session.save('Second')).rejects.toThrow('still running')
    await expect(session.open('id', true)).rejects.toThrow('still running')
    write.reject(
      new DOMException('Storage quota exhausted', 'QuotaExceededError')
    )
    await expect(saving).rejects.toThrow('quota')
    expect(session.getState()).toMatchObject({
      project: null,
      status: 'error',
      dirty: true,
      busy: null
    })
    repository.write = vi.fn(async () => undefined)
    await session.save('Retry')
    expect(session.getState().status).toBe('saved')
    session.close()
  })
  it('preserves prior acknowledgement after failed replacement and supports saving a separate project', async () => {
    const { session, repository } = fixture()
    await session.save('Original')
    const original = session.getState().project
    session.markEdited()
    repository.write = vi.fn(async () => {
      throw new Error('conflict')
    })
    await expect(session.save('Replacement')).rejects.toThrow('conflict')
    expect(session.getState().project).toEqual(original)
    repository.write = vi.fn(async () => undefined)
    await session.save('Separate', true)
    expect(session.getState().project?.id).not.toBe(original?.id)
    expect(repository.write).toHaveBeenLastCalledWith(
      expect.anything(),
      null,
      expect.any(AbortSignal)
    )
    session.close()
  })
  it('requires acceptance and refuses to overwrite edits made during asynchronous reading or before queued apply', async () => {
    const { session, repository, document } = fixture(),
      read = deferred<StoredProject>()
    await expect(session.open('id', false)).rejects.toThrow('acceptance')
    repository.read = vi.fn(() => read.promise)
    const opening = session.open('id', true)
    session.markEdited()
    read.resolve({
      id: 'id',
      name: 'Saved',
      revision: 'a',
      savedAt: new Date().toISOString(),
      payload: encodeProject(snapshot())
    })
    await expect(opening).rejects.toThrow('model changed')
    expect(document.apply).not.toHaveBeenCalled()
    document.apply = vi.fn(async (_data, guard) => {
      session.markEdited()
      guard()
      return []
    })
    await expect(session.open('id', true)).rejects.toThrow('model changed')
    expect(session.getState().project).toBeNull()
    session.close()
  })
  it('reopens through the document port and preserves repaired-data unsaved status', async () => {
    const { session, repository, document } = fixture()
    const source = {
      ...snapshot(),
      loadIssues: [{ path: 'joint', message: 'Recovered' }]
    }
    repository.read = vi.fn(async () => ({
      id: 'id',
      name: 'Saved',
      revision: 'a',
      savedAt: new Date().toISOString(),
      payload: encodeProject(source)
    }))
    document.apply = vi.fn(async (data, guard) => {
      guard()
      return data.loadIssues
    })
    await session.open('id', true)
    expect(document.apply).toHaveBeenCalledWith(source, expect.any(Function))
    expect(session.getState()).toMatchObject({
      project: { id: 'id' },
      status: 'unsaved',
      dirty: true
    })
    session.close()
  })
  it('ignores late save responses after closing and closes the owned repository exactly once', async () => {
    const { session, repository } = fixture(),
      write = deferred<undefined>()
    repository.write = vi.fn(() => write.promise)
    const listener = vi.fn()
    session.subscribe(listener)
    const saving = session.save('Example')
    await Promise.resolve()
    session.close()
    const count = listener.mock.calls.length
    write.resolve(undefined)
    await expect(saving).rejects.toThrow('closed')
    expect(listener).toHaveBeenCalledTimes(count)
    expect(session.getState().project).toBeNull()
    session.close()
    expect(repository.close).toHaveBeenCalledOnce()
  })
})
