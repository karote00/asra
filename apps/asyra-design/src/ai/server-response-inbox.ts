import type { AiActionBatch } from '@asyra/ai-agent-runtime'

export const SERVER_RESPONSE_INBOX_DATABASE_NAME = 'server-response-inbox'
export const SERVER_RESPONSE_INBOX_DATABASE_VERSION = 1
export const SERVER_RESPONSE_INBOX_STORE_NAME = 'responses'
export const SERVER_RESPONSE_SCHEMA_VERSION = 1

export interface ServerResponseRecord {
  readonly batch: AiActionBatch
  readonly fileId: string
  readonly schemaVersion: 1
}

const invalidResponse = (reason: string): Error =>
  new Error(`[server-response-inbox] invalid server response: ${reason}`)

const asServerResponseRecord = (
  value: unknown,
  expectedFileId: string
): ServerResponseRecord => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidResponse('the stored value is not a record')
  }
  const record = value as Record<string, unknown>
  if (
    Reflect.ownKeys(record).length !== 3 ||
    !Object.prototype.hasOwnProperty.call(record, 'batch') ||
    !Object.prototype.hasOwnProperty.call(record, 'fileId') ||
    !Object.prototype.hasOwnProperty.call(record, 'schemaVersion')
  ) {
    throw invalidResponse('the record envelope is not exact')
  }
  if (record.schemaVersion !== SERVER_RESPONSE_SCHEMA_VERSION) {
    throw invalidResponse('the schema version is unsupported')
  }
  if (record.fileId !== expectedFileId) {
    throw invalidResponse('the stored fileId does not match its key')
  }
  return value as ServerResponseRecord
}

export const readServerResponse = (
  fileId: string
): Promise<ServerResponseRecord | null> => {
  if (fileId.trim().length === 0) {
    return Promise.reject(invalidResponse('the requested fileId is empty'))
  }
  if (typeof globalThis.indexedDB === 'undefined') {
    return Promise.reject(
      new Error(
        '[server-response-inbox] IndexedDB is unavailable during App bootstrap'
      )
    )
  }

  return new Promise((resolve, reject) => {
    let abortedInitialCreation = false
    let settled = false
    const settle = (
      outcome:
        | { readonly value: ServerResponseRecord | null }
        | { readonly error: unknown }
    ) => {
      if (settled) return
      settled = true
      if ('error' in outcome) {
        reject(outcome.error)
      } else {
        resolve(outcome.value)
      }
    }
    const openRequest = globalThis.indexedDB.open(
      SERVER_RESPONSE_INBOX_DATABASE_NAME
    )
    openRequest.onupgradeneeded = (event) => {
      if ((event as IDBVersionChangeEvent).oldVersion === 0) {
        abortedInitialCreation = true
      }
      openRequest.transaction?.abort()
    }
    openRequest.onerror = () => {
      if (
        abortedInitialCreation &&
        (openRequest.error === null || openRequest.error.name === 'AbortError')
      ) {
        settle({ value: null })
        return
      }
      settle({
        error:
          openRequest.error ??
          new Error('[server-response-inbox] IndexedDB open failed')
      })
    }
    openRequest.onblocked = () => {
      settle({
        error: new Error('[server-response-inbox] IndexedDB open was blocked')
      })
    }
    openRequest.onsuccess = () => {
      const database = openRequest.result
      if (
        database.version !== SERVER_RESPONSE_INBOX_DATABASE_VERSION ||
        !database.objectStoreNames.contains(SERVER_RESPONSE_INBOX_STORE_NAME)
      ) {
        database.close()
        settle({ value: null })
        return
      }

      let response: ServerResponseRecord | null = null
      let readError: unknown
      const transaction = database.transaction(
        SERVER_RESPONSE_INBOX_STORE_NAME,
        'readonly'
      )
      const request = transaction
        .objectStore(SERVER_RESPONSE_INBOX_STORE_NAME)
        .get(fileId)
      request.onerror = () => {
        readError =
          request.error ??
          new Error('[server-response-inbox] IndexedDB read failed')
      }
      request.onsuccess = () => {
        if (request.result === undefined) {
          response = null
          return
        }
        try {
          response = asServerResponseRecord(request.result, fileId)
        } catch (error) {
          readError = error
        }
      }
      transaction.oncomplete = () => {
        database.close()
        if (readError !== undefined) {
          settle({ error: readError })
        } else {
          settle({ value: response })
        }
      }
      transaction.onabort = () => {
        database.close()
        settle({
          error:
            transaction.error ??
            new Error('[server-response-inbox] IndexedDB read was aborted')
        })
      }
      transaction.onerror = () => {
        readError =
          transaction.error ??
          new Error('[server-response-inbox] IndexedDB transaction failed')
      }
    }
  })
}
