import type { ModelLoadIssue } from '../common-apis/document'
import { validateRunRecords, type RunRecord } from './run-record'
import { readCapturedRunReferences } from '../common-apis/run-reference'
import { readCapturedVisualAssetIds } from '../common-apis/visual-reference'
import { validateVisualSources, type VisualSourceRecord } from './visual-source'

export const PROJECT_BYTE_LIMIT = 64 * 1024 * 1024
export interface ProjectSnapshot {
  document: unknown
  loadIssues: readonly ModelLoadIssue[]
  runs?: readonly RunRecord[]
  visualSources?: readonly VisualSourceRecord[]
}

/** Canonical membership plus immutable history determines the portable source union. */
export function projectVisualAssetIds(
  snapshot: Pick<ProjectSnapshot, 'document' | 'runs'>
): readonly string[] {
  const ids = new Set(readCapturedVisualAssetIds(snapshot.document))
  for (const run of snapshot.runs ?? [])
    for (const body of run.snapshot.workcell.bodies)
      for (const binding of body.visuals ?? []) ids.add(binding.assetId)
  return Object.freeze([...ids])
}
export interface ProjectSummary {
  id: string
  name: string
  revision: string
  savedAt: string
}
export interface StoredProject extends ProjectSummary {
  payload: string
}
export interface ProjectRepository {
  read(id: string, signal?: AbortSignal): Promise<StoredProject>
  write(
    project: StoredProject,
    expectedRevision: string | null,
    signal?: AbortSignal
  ): Promise<void>
  list(
    signal?: AbortSignal
  ): Promise<{ projects: ProjectSummary[]; limited: boolean }>
  close(): void
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export function validateSummary(
  value: unknown
): asserts value is ProjectSummary {
  if (
    !record(value) ||
    !['id', 'name', 'revision', 'savedAt'].every(
      (key) =>
        typeof value[key] === 'string' &&
        value[key].length > 0 &&
        value[key].length <= 200
    ) ||
    !Number.isFinite(Date.parse(value.savedAt as string))
  )
    throw new Error('Invalid saved project metadata')
}

function validateSnapshot(value: unknown): asserts value is ProjectSnapshot {
  if (
    !record(value) ||
    !record(value.document) ||
    value.document.version !== '1.0.0' ||
    !record(value.document.sceneTree) ||
    !record(value.document.props) ||
    !Array.isArray(value.loadIssues) ||
    value.loadIssues.length > 10000 ||
    !value.loadIssues.every(
      (issue) =>
        record(issue) &&
        typeof issue.path === 'string' &&
        issue.path.length <= 1000 &&
        typeof issue.message === 'string' &&
        issue.message.length <= 4000
    )
  )
    throw new Error(
      'Invalid or unsupported project document; original data was not changed'
    )
  const scene = value.document.sceneTree
  if (
    typeof scene.workspace !== 'string' ||
    !Array.isArray(scene.workspaceList) ||
    !scene.workspaceList.every((id) => typeof id === 'string') ||
    !record(scene.elements)
  )
    throw new Error('Invalid saved scene envelope')
  const runs = Object.hasOwn(value, 'runs')
    ? validateRunRecords(value.runs)
    : []
  const records = new Map(runs.map((run) => [run.result.runId, run]))
  const visualSources = Object.hasOwn(value, 'visualSources')
    ? validateVisualSources(value.visualSources)
    : []
  const sourceIds = new Set(visualSources.map((source) => source.assetId))
  for (const assetId of projectVisualAssetIds({
    document: value.document,
    runs
  }))
    if (!sourceIds.has(assetId))
      throw new Error(
        `Missing visual source ${assetId} in the portable project`
      )
  for (const reference of readCapturedRunReferences(value.document)) {
    const run = records.get(reference.runId)
    if (
      !run ||
      run.snapshot.snapshotId !== reference.snapshotId ||
      run.snapshot.source.candidateId !== reference.candidateId ||
      run.snapshot.source.experimentId !== reference.experimentId
    )
      throw new Error(
        `Missing or mismatched evidence for retained run ${reference.runId}`
      )
  }
}

export function encodeProject(snapshot: ProjectSnapshot): string {
  validateSnapshot(snapshot)
  const text = JSON.stringify(
    { format: 'asyra-sim-project', version: 1, ...snapshot },
    (_key, value) => {
      if (typeof value === 'number' && !Number.isFinite(value))
        throw new Error('Nonfinite project number cannot be saved')
      if (['bigint', 'function', 'symbol'].includes(typeof value))
        throw new Error('Project data must be serializable JSON')
      return value
    }
  )
  checkSize(text)
  return text
}

function checkSize(text: string): void {
  if (
    text.length > PROJECT_BYTE_LIMIT ||
    new TextEncoder().encode(text).byteLength > PROJECT_BYTE_LIMIT
  )
    throw new Error('Project exceeds the 64 MiB limit')
}

export function decodeProject(text: string): ProjectSnapshot {
  if (typeof text !== 'string')
    throw new Error('Saved project document is missing')
  checkSize(text)
  const value: unknown = JSON.parse(text)
  if (
    !record(value) ||
    value.format !== 'asyra-sim-project' ||
    value.version !== 1
  )
    throw new Error('Unsupported Asyra Sim project format or version')
  validateSnapshot(value)
  return {
    document: value.document,
    loadIssues: value.loadIssues.map((issue) => ({ ...issue })),
    ...(value.runs ? { runs: validateRunRecords(value.runs) } : {}),
    ...(value.visualSources
      ? { visualSources: validateVisualSources(value.visualSources) }
      : {})
  }
}
