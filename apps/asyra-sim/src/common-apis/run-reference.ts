import { runTransaction, type Core } from '@asyra/core'
import { ComponentTypes, PropertyFields, PropertyNames } from '../constants'
import { isPlainRecord } from '../domain/records'
import { validRunReference, type RunReference } from '../init/properties'

export interface ArchivedRunIdentity {
  runId: string
  snapshotId: string
  candidateId: string
  experimentId: string
  name: string
}
export interface CanonicalRunReference extends RunReference {
  elementId: string
  candidateId: string
  name: string
}

export function readCapturedRunReferences(
  document: unknown
): readonly CanonicalRunReference[] {
  if (
    !isPlainRecord(document) ||
    !isPlainRecord(document.sceneTree) ||
    !isPlainRecord(document.sceneTree.elements) ||
    !isPlainRecord(document.props)
  )
    throw new Error('Invalid canonical capture for retained runs')
  const { elements } = document.sceneTree
  const references: CanonicalRunReference[] = []
  for (const element of Object.values(elements)) {
    if (
      !isPlainRecord(element) ||
      element.type !== ComponentTypes.RUN_REFERENCE
    )
      continue
    if (
      typeof element.id !== 'string' ||
      typeof element.name !== 'string' ||
      typeof element.parentId !== 'string' ||
      !isPlainRecord(element.props)
    )
      throw new Error('Invalid canonical run reference')
    const parent = elements[element.parentId]
    if (!isPlainRecord(parent) || parent.type !== ComponentTypes.CANDIDATE)
      throw new Error('Run reference must belong to a candidate')
    const propertyId = element.props[PropertyNames.RUN_REFERENCE]
    const property =
      typeof propertyId === 'string' ? document.props[propertyId] : null
    const reference = isPlainRecord(property)
      ? property[PropertyFields.RUN_REFERENCE]
      : null
    if (!validRunReference(reference) || !reference)
      throw new Error('Run reference requires load review')
    references.push({
      ...reference,
      elementId: element.id,
      candidateId: element.parentId,
      name: element.name
    })
  }
  if (
    new Set(references.map((reference) => reference.runId)).size !==
    references.length
  )
    throw new Error('Duplicate canonical run reference')
  return references
}

export function readRunReferences(
  core: Core
): readonly CanonicalRunReference[] {
  return readCapturedRunReferences(core.getCanonicalOwnerSnapshot())
}

export function attachRunReference(
  core: Core,
  input: ArchivedRunIdentity
): string {
  const reference: RunReference = {
    version: 1,
    runId: input.runId,
    snapshotId: input.snapshotId,
    experimentId: input.experimentId
  }
  if (
    !validRunReference(reference) ||
    !input.name.trim() ||
    input.name.length > 200
  )
    throw new Error('Invalid archived run identity')
  if (core.getElementData(input.candidateId)?.type !== ComponentTypes.CANDIDATE)
    throw new Error('Missing candidate for retained run')
  const existing = readRunReferences(core).find(
    (item) => item.runId === input.runId
  )
  if (existing) {
    if (
      existing.snapshotId !== input.snapshotId ||
      existing.candidateId !== input.candidateId ||
      existing.experimentId !== input.experimentId
    )
      throw new Error('Run reference identity conflict')
    return existing.elementId
  }
  return runTransaction(() =>
    core.createElementInParent(
      {
        type: ComponentTypes.RUN_REFERENCE,
        name: input.name,
        x: 0,
        y: 0,
        [PropertyFields.RUN_REFERENCE]: reference
      },
      input.candidateId
    )
  )
}
