import { CRDT_7076_DEMO_FILE_ID } from '../config/demo-document'

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

export const getCollaborationMode = (): CollaborationMode | null => {
  const fileId = getRequiredFileId()
  if (fileId === CRDT_7076_DEMO_FILE_ID) {
    return null
  }
  const configuredEndpoint = import.meta.env.VITE_COLLABORATION_WS_URL?.trim()
  const endpoint =
    configuredEndpoint ||
    (() => {
      const sameDeploymentEndpoint = new URL(
        '/collaboration',
        window.location.href
      )
      sameDeploymentEndpoint.protocol =
        sameDeploymentEndpoint.protocol === 'https:' ? 'wss:' : 'ws:'
      return sameDeploymentEndpoint.toString()
    })()

  return Object.freeze({
    fileId,
    actorId: `actor-${globalThis.crypto.randomUUID()}`,
    endpoint
  })
}
