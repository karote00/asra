import type { DocumentPersistenceBatch } from './document-materializer'

interface PersistenceFetchResponse {
  readonly ok: boolean
  readonly status: number
  json(): Promise<unknown>
}

type PersistenceFetch = (
  input: string,
  init: Readonly<{
    method: 'DELETE' | 'GET' | 'POST'
    headers: Readonly<Record<string, string>>
    body?: string
  }>
) => Promise<PersistenceFetchResponse>

export interface DocumentBootstrapCheckpoint {
  readonly checkpoint: unknown | null
  readonly durableSequence: number
  readonly documentGeneration: number
}

export interface HttpDocumentPersistenceClient {
  readCheckpoint(documentId: string): Promise<DocumentBootstrapCheckpoint>
  resetCheckpoint(documentId: string): Promise<number>
  sendBatch(
    batch: DocumentPersistenceBatch
  ): Promise<Readonly<{ durableSequence: number }>>
}

export interface HttpDocumentPersistenceClientOptions {
  readonly baseURL: string
  readonly fetchImplementation?: PersistenceFetch
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const createHttpDocumentPersistenceClient = ({
  baseURL,
  fetchImplementation
}: HttpDocumentPersistenceClientOptions): HttpDocumentPersistenceClient => {
  const base = new URL(baseURL)
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    throw new Error(
      '[document-persistence-client] backend URL must use http or https'
    )
  }
  const send =
    fetchImplementation ??
    (globalThis as unknown as { readonly fetch: PersistenceFetch }).fetch
  if (typeof send !== 'function') {
    throw new Error(
      '[document-persistence-client] runtime fetch implementation is required'
    )
  }

  return {
    async readCheckpoint(documentId) {
      const endpoint = new URL(
        `/api/documents/${encodeURIComponent(documentId)}/bootstrap-checkpoint`,
        base
      )
      const response = await send(endpoint.toString(), {
        method: 'GET',
        headers: { accept: 'application/json' }
      })
      if (response.status === 404) {
        return Object.freeze({
          checkpoint: null,
          durableSequence: 0,
          documentGeneration: 0
        })
      }
      if (!response.ok) {
        throw new Error(
          `[document-persistence-client] backend rejected checkpoint read (${response.status})`
        )
      }
      const checkpoint = await response.json()
      if (
        !isRecord(checkpoint) ||
        !Object.prototype.hasOwnProperty.call(checkpoint, 'checkpoint') ||
        !Number.isSafeInteger(checkpoint.durableSequence) ||
        Number(checkpoint.durableSequence) < 0 ||
        (Object.prototype.hasOwnProperty.call(
          checkpoint,
          'documentGeneration'
        ) &&
          (!Number.isSafeInteger(checkpoint.documentGeneration) ||
            Number(checkpoint.documentGeneration) < 0))
      ) {
        throw new Error(
          '[document-persistence-client] backend checkpoint is invalid'
        )
      }
      return Object.freeze({
        checkpoint: checkpoint.checkpoint,
        durableSequence: Number(checkpoint.durableSequence),
        documentGeneration: Number(checkpoint.documentGeneration ?? 0)
      })
    },
    async resetCheckpoint(documentId) {
      const endpoint = new URL(
        `/api/documents/${encodeURIComponent(documentId)}`,
        base
      )
      const response = await send(endpoint.toString(), {
        method: 'DELETE',
        headers: { accept: 'application/json' }
      })
      if (!response.ok) {
        throw new Error(
          `[document-persistence-client] backend rejected document Reset (${response.status})`
        )
      }
      const reset = await response.json()
      if (
        !isRecord(reset) ||
        !Number.isSafeInteger(reset.documentGeneration) ||
        Number(reset.documentGeneration) < 1
      ) {
        throw new Error(
          '[document-persistence-client] backend Reset generation is invalid'
        )
      }
      return Number(reset.documentGeneration)
    },
    async sendBatch(batch) {
      const endpoint = new URL(
        `/api/documents/${encodeURIComponent(batch.documentId)}/persistence-batches`,
        base
      )
      const response = await send(endpoint.toString(), {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify(batch)
      })
      if (!response.ok) {
        throw new Error(
          `[document-persistence-client] backend rejected persistence batch (${response.status})`
        )
      }
      const acknowledgement = await response.json()
      if (
        !isRecord(acknowledgement) ||
        !Number.isSafeInteger(acknowledgement.durableSequence) ||
        Number(acknowledgement.durableSequence) < 0
      ) {
        throw new Error(
          '[document-persistence-client] backend durable acknowledgement is invalid'
        )
      }
      return Object.freeze({
        durableSequence: Number(acknowledgement.durableSequence)
      })
    }
  }
}
