import type { WorkspaceBundle, WorkspaceEntry } from './types'

export type WorkspaceRoute =
  | { kind: 'overview' }
  | { kind: 'selected'; entry: WorkspaceEntry }
  | { kind: 'error'; id: string; excluded: boolean }

const excludedId = (sourcePath: string) =>
  sourcePath
    .replace(/^.*\//, '')
    .replace(/-flow-inspector\.data\.(?:cjs|js)$/, '')

export const parseWorkspaceRoute = (
  hash: string,
  bundle: WorkspaceBundle
): WorkspaceRoute => {
  const id = new URLSearchParams(hash.replace(/^#/, '')).get('inspector')
  if (!id) return { kind: 'overview' }
  const entry = bundle.entries.find((candidate) => candidate.id === id)
  if (entry) return { kind: 'selected', entry }
  return {
    kind: 'error',
    id,
    excluded: bundle.exclusions.some(
      (candidate) => excludedId(candidate.path) === id
    )
  }
}

export const workspaceHash = (id: string) =>
  `#inspector=${encodeURIComponent(id)}`

export const targetHref = (id: string) => {
  const encoded = encodeURIComponent(id)
  return `./target.html?inspector=${encoded}#inspector=${encoded}`
}
