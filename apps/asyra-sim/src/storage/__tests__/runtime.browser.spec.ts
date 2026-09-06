import { expect, test } from '@playwright/test'

test('native IndexedDB atomically saves, reopens, and rejects cross-tab revision conflicts', async ({
  page
}) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const path = '/src/storage/indexed-db.ts',
      formatPath = '/src/storage/project-format.ts'
    const m: typeof import('../indexed-db') = await import(path)
    const f: typeof import('../project-format') = await import(formatPath)
    const name = `sim-storage-test-${crypto.randomUUID()}`
    const a = new m.IndexedProjectRepository(indexedDB, name),
      b = new m.IndexedProjectRepository(indexedDB, name)
    const payload = f.encodeProject({
      document: {
        version: '1.0.0',
        sceneTree: { workspace: '', workspaceList: [], elements: {} },
        props: {}
      },
      loadIssues: [{ path: 'body', message: 'A retained repair' }]
    })
    const original = {
      id: 'project',
      name: 'Example',
      revision: 'a',
      savedAt: '2026-09-04T00:00:00.000Z',
      payload
    }
    try {
      await a.write(original, null)
      const first = await b.read('project')
      await a.write({ ...original, name: 'Newer', revision: 'b' }, 'a')
      let conflict = ''
      try {
        await b.write({ ...original, name: 'Stale', revision: 'c' }, 'a')
      } catch (error) {
        conflict = String(error)
      }
      return {
        first,
        current: await b.read('project'),
        list: await a.list(),
        conflict
      }
    } finally {
      a.close()
      b.close()
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }
  })
  expect(result.first.name).toBe('Example')
  expect(JSON.parse(result.first.payload).loadIssues).toHaveLength(1)
  expect(result.current.name).toBe('Newer')
  expect(result.current.revision).toBe('b')
  expect(result.list.projects.map((project) => project.name)).toEqual(['Newer'])
  expect(result.list.limited).toBe(false)
  expect(result.conflict).toContain('changed in another tab')
})

test('request success followed by native transaction abort never acknowledges a save', async ({
  page
}) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const path = '/src/storage/indexed-db.ts'
    const { transactionCompletion }: typeof import('../indexed-db') =
      await import(path)
    const name = `sim-abort-test-${crypto.randomUUID()}`
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1)
      request.onupgradeneeded = () => request.result.createObjectStore('values')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const tx = database.transaction('values', 'readwrite')
      let requestSucceeded = false,
        settledAtRequest = false,
        settled = false
      const completion = transactionCompletion(tx).then(
        () => {
          settled = true
          return 'saved'
        },
        (error) => {
          settled = true
          return error.name as string
        }
      )
      const request = tx.objectStore('values').put('new', 'key')
      request.onsuccess = () => {
        requestSucceeded = true
        settledAtRequest = settled
        tx.abort()
      }
      const outcome = await completion
      const value = await new Promise((resolve, reject) => {
        const read = database
          .transaction('values')
          .objectStore('values')
          .get('key')
        read.onsuccess = () => resolve(read.result)
        read.onerror = () => reject(read.error)
      })
      return {
        requestSucceeded,
        settledAtRequest,
        outcome,
        absent: value === undefined
      }
    } finally {
      database.close()
      indexedDB.deleteDatabase(name)
    }
  })
  expect(result).toEqual({
    requestSucceeded: true,
    settledAtRequest: false,
    outcome: 'AbortError',
    absent: true
  })
})

test('missing or corrupt saved documents reject and closed or cancelled storage does not pretend to save', async ({
  page
}) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const path = '/src/storage/indexed-db.ts'
    const { IndexedProjectRepository }: typeof import('../indexed-db') =
      await import(path)
    const name = `sim-corrupt-test-${crypto.randomUUID()}`
    const repository = new IndexedProjectRepository(indexedDB, name)
    const errors: string[] = []
    const capture = async (operation: () => Promise<unknown>) => {
      try {
        await operation()
        errors.push('unexpected success')
      } catch (error) {
        errors.push(String(error))
      }
    }
    await capture(() => repository.read('missing'))
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open(name, 1)
      request.onsuccess = () => resolve(request.result)
    })
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(['projects', 'documents'], 'readwrite')
        tx.objectStore('projects').put({
          id: 'bad',
          name: 'Bad',
          revision: 'a',
          savedAt: '2026-09-04T00:00:00Z'
        })
        tx.objectStore('documents').put('{broken', 'bad')
        tx.oncomplete = () => resolve()
        tx.onabort = () => reject(tx.error)
      })
      await capture(() => repository.read('bad'))
      repository.close()
      await capture(() => repository.list())
      const controller = new AbortController()
      controller.abort()
      const second = new IndexedProjectRepository(indexedDB, name)
      await capture(() => second.list(controller.signal))
      second.close()
    } finally {
      repository.close()
      database.close()
      indexedDB.deleteDatabase(name)
    }
    return errors
  })
  expect(result[0]).toContain('not found')
  expect(result[1]).toContain('SyntaxError')
  expect(result[2]).toContain('closed')
  expect(result[3]).toContain('AbortError')
})
