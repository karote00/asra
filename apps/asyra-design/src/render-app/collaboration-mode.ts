export interface CollaborationMode {
  fileId: string
  actorId: string
  endpoint: string
}

const queryValue = (
  search: URLSearchParams,
  key: string
): string | undefined => {
  const value = search.get(key)?.trim()
  return value ? value : undefined
}

export const getRequiredFileId = (): string => {
  const fileId = queryValue(
    new URLSearchParams(window.location.search),
    'fileId'
  )
  if (!fileId) {
    throw new Error('[collaboration] missing required fileId')
  }
  return fileId
}

export const getCollaborationMode = (): CollaborationMode => {
  const fileId = getRequiredFileId()
  const endpoint = import.meta.env.VITE_COLLABORATION_WS_URL?.trim()
  if (!endpoint) {
    throw new Error('[collaboration] missing WebSocket URL in .env')
  }

  return Object.freeze({
    fileId,
    actorId: `actor-${globalThis.crypto.randomUUID()}`,
    endpoint
  })
}
