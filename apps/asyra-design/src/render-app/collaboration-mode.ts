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

export const getPublicFileId = (): string | undefined =>
  queryValue(new URLSearchParams(window.location.search), 'fileId')

export const getCollaborationMode = (): CollaborationMode | undefined => {
  const fileId = getPublicFileId()
  if (!fileId) return

  const endpoint =
    import.meta.env.VITE_ASYRA_DESIGN_COLLABORATION_WS_URL?.trim()
  if (!endpoint) {
    throw new Error(
      '[collaboration] missing WebSocket URL in apps/asyra-design/.env'
    )
  }

  return Object.freeze({
    fileId,
    actorId: `actor-${globalThis.crypto.randomUUID()}`,
    endpoint
  })
}
