export type InspectorKind = 'flow-v2' | 'legacy-v1' | 'plan-contract'
export type InspectorGroup = 'Apps' | 'Framework' | 'Release' | 'Tools'

export interface WorkspaceEntry {
  id: string
  title: string
  kind: InspectorKind
  group: InspectorGroup
  subgroup: string
  lifecycle: string
  sourcePath: string
  standalonePath: string | null
  labels: string[]
  data: unknown
}

export interface WorkspaceBundle {
  schema: { id: string; version: number }
  generatedFrom: { discoveryRoots: string[]; candidatePaths: string[] }
  exclusions: { path: string; reason: string }[]
  entries: WorkspaceEntry[]
}

declare global {
  // eslint-disable-next-line no-var
  var FLOW_INSPECTOR_WORKSPACE_BUNDLE: WorkspaceBundle | undefined
}
