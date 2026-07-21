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

export const getCollaborationMode = (): CollaborationMode | undefined => {
  const search = new URLSearchParams(window.location.search)
  const fileId = queryValue(search, 'fileId')
  if (!fileId) return undefined

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
