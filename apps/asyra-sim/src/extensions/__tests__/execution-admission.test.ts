import { expect, it } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import { createExperimentSnapshot } from '../../analysis/snapshot'
import { INSTALLED_METHOD_CATALOG } from '../installed-methods'
import { admitSnapshotExecution } from '../execution-admission'
import { createMethodCatalog } from '../catalog'

function snapshot() {
  const example = createSyntheticExample(),
    draft = createSyntheticExperimentDraft(example)
  return createExperimentSnapshot({
    snapshotId: 'run-input',
    candidateId: 'candidate',
    experimentId: 'study',
    workcell: example.workcell,
    definition: { ...draft, revision: 1, rule: { ...draft.rule, revision: 1 } },
    methods: INSTALLED_METHOD_CATALOG.descriptors,
    acknowledgedWarningCodes: []
  })
}

it('admits detached snapshots only against the exact installed method declaration', () => {
  const input = snapshot(),
    admitted = admitSnapshotExecution(input, INSTALLED_METHOD_CATALOG)
  expect(admitted).toEqual(input)
  expect(admitted).not.toBe(input)
  expect(Object.isFrozen(admitted.workcell.bodies)).toBe(true)
  expect(INSTALLED_METHOD_CATALOG.descriptors).toHaveLength(2)
  const changed = structuredClone(input)
  if (!changed.methodDescriptor) throw new Error('Missing descriptor')
  changed.methodDescriptor.manifest.resources =
    'Different resources under an unchanged version'
  expect(() =>
    admitSnapshotExecution(changed, INSTALLED_METHOD_CATALOG)
  ).toThrow('declaration')
  const reordered = structuredClone(input)
  if (!reordered.methodDescriptor) throw new Error('Missing descriptor')
  reordered.methodDescriptor.manifest = Object.fromEntries(
    Object.entries(reordered.methodDescriptor.manifest).reverse()
  ) as typeof reordered.methodDescriptor.manifest
  expect(admitSnapshotExecution(reordered, INSTALLED_METHOD_CATALOG)).toEqual(
    input
  )
})

it('does not confuse readable history with permission to execute missing or incompatible methods', () => {
  const input = snapshot()
  expect(() => admitSnapshotExecution(input, createMethodCatalog([]))).toThrow(
    'unavailable'
  )
  const incompatible = structuredClone(input)
  incompatible.method.version = 'not-installed'
  delete incompatible.methodDescriptor
  expect(() =>
    admitSnapshotExecution(incompatible, INSTALLED_METHOD_CATALOG)
  ).toThrow('unavailable')
  const forged = structuredClone(input)
  forged.pairs = forged.pairs.slice(1)
  expect(() =>
    admitSnapshotExecution(forged, INSTALLED_METHOD_CATALOG)
  ).toThrow('pairs')
})
