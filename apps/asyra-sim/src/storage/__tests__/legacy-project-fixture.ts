import type { ProjectSnapshot } from '../project-format'
import { isPlainRecord } from '../../domain/records'

// Historical wire values are deliberately literal so this fixture stays
// independent of the production migration table.
const types = new Map([
  ['sim-body', 'asyra-sim-body'],
  ['sim-candidate', 'asyra-sim-candidate'],
  ['sim-experiment', 'asyra-sim-experiment'],
  ['sim-run-reference', 'asyra-sim-run-reference'],
  ['sim-body-properties', 'asyra-sim-body-properties'],
  ['sim-candidate-properties', 'asyra-sim-candidate-properties'],
  ['sim-experiment-properties', 'asyra-sim-experiment-properties'],
  ['sim-run-reference-properties', 'asyra-sim-run-reference-properties']
])

export function legacyProjectText(snapshot: ProjectSnapshot): string {
  const document: unknown = structuredClone(snapshot.document)
  if (
    !isPlainRecord(document) ||
    !isPlainRecord(document.sceneTree) ||
    !isPlainRecord(document.sceneTree.elements) ||
    !isPlainRecord(document.props)
  )
    throw new Error('Legacy fixture requires a canonical capture')
  for (const entries of [document.sceneTree.elements, document.props]) {
    for (const entry of Object.values(entries)) {
      if (!isPlainRecord(entry) || typeof entry.type !== 'string') continue
      const legacy = types.get(entry.type)
      if (legacy) Reflect.set(entry, 'type', legacy)
    }
  }
  return JSON.stringify({
    format: 'asyra-sim-project',
    version: 1,
    ...snapshot,
    document
  })
}
