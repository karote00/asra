import { readCapturedVisualBindingGroups } from '../common-apis/visual-reference'
import type { ProjectSnapshot } from './project-format'
import { VisualAssetArchive, type VisualDecoder } from './visual-archive'
import { validateOriginalPartSources } from './original-part-sources'

/** Prepare detached source resources before retiring a document or starting its successor. */
export async function prepareProjectVisuals(
  snapshot: ProjectSnapshot,
  decoder?: VisualDecoder,
  signal?: AbortSignal
): Promise<VisualAssetArchive> {
  const groups = [
    ...readCapturedVisualBindingGroups(snapshot.document).values()
  ]
  for (const run of snapshot.runs ?? [])
    groups.push(
      run.snapshot.workcell.bodies.flatMap((body) =>
        structuredClone(body.visuals ?? [])
      )
    )
  const archive = await VisualAssetArchive.fromSources(
    snapshot.visualSources ?? [],
    decoder,
    signal
  )
  try {
    for (const bindings of groups) archive.resolveBindings(bindings)
    for (const run of snapshot.runs ?? [])
      validateOriginalPartSources(run.snapshot, archive)
    signal?.throwIfAborted()
    return archive
  } catch (error) {
    archive.dispose()
    throw error
  }
}
