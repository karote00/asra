interface StoredDocumentResetResponse {
  readonly ok: boolean
  readonly status: number
}

type StoredDocumentResetFetch = (
  input: string,
  init: Readonly<{
    headers: Readonly<Record<string, string>>
    method: 'DELETE'
  }>
) => Promise<StoredDocumentResetResponse>

interface ResetStoredDocumentOptions {
  readonly fetchImplementation?: StoredDocumentResetFetch
  readonly reload?: () => void
}

const getRequiredStoredFileId = (): string => {
  const fileId = new URLSearchParams(window.location.search)
    .get('fileId')
    ?.trim()
  if (!fileId) {
    throw new Error('[reset] fileId is required')
  }
  return fileId
}

const getPlatformFetch = (): StoredDocumentResetFetch => {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('[reset] fetch is unavailable')
  }
  return globalThis.fetch.bind(globalThis) as StoredDocumentResetFetch
}

export const resetStoredDocument = async (
  options: ResetStoredDocumentOptions = {}
): Promise<void> => {
  const fileId = getRequiredStoredFileId()
  const reload = options.reload ?? (() => window.location.reload())
  try {
    const send = options.fetchImplementation ?? getPlatformFetch()
    const response = await send(
      `/api/documents/${encodeURIComponent(fileId)}`,
      {
        headers: { accept: 'application/json' },
        method: 'DELETE'
      }
    )
    if (!response.ok) {
      throw new Error(
        `stored document Reset failed (${String(response.status)})`
      )
    }
  } finally {
    reload()
  }
}
