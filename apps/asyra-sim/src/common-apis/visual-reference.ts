import type { Core } from '@asyra/core'
import { ComponentTypes, PropertyFields, PropertyNames } from '../constants'
import { isPlainRecord } from '../domain/records'
import { validVisualBindings, type VisualBinding } from '../domain/workcell'
import {
  readWorkcell,
  upsertBody,
  type WorkcellResourceAdmission
} from './workcell'

export function readCapturedVisualBindingGroups(
  document: unknown
): ReadonlyMap<string, readonly VisualBinding[]> {
  if (
    !isPlainRecord(document) ||
    !isPlainRecord(document.sceneTree) ||
    !isPlainRecord(document.sceneTree.elements) ||
    !isPlainRecord(document.props)
  )
    throw new Error('Invalid canonical capture for visual sources')
  const elements = document.sceneTree.elements
  const groups = new Map<string, VisualBinding[]>()
  const owner = (body: Readonly<Record<string, unknown>>): string => {
    const visited = new Set([body.id])
    let parentId = body.parentId
    while (typeof parentId === 'string') {
      if (visited.has(parentId))
        throw new Error('Canonical visual ownership cycle')
      visited.add(parentId)
      const parent = elements[parentId]
      if (!isPlainRecord(parent)) break
      if (parent.type === ComponentTypes.CANDIDATE) return parentId
      parentId = parent.parentId
    }
    throw new Error('Visual body has no canonical candidate owner')
  }
  for (const element of Object.values(elements)) {
    if (!isPlainRecord(element) || element.type !== ComponentTypes.BODY)
      continue
    const propertyId = isPlainRecord(element.props)
      ? element.props[PropertyNames.BODY]
      : undefined
    const property =
      typeof propertyId === 'string' ? document.props[propertyId] : undefined
    const parameters = isPlainRecord(property)
      ? property[PropertyFields.BODY]
      : undefined
    if (!isPlainRecord(parameters) || parameters.visuals === undefined) continue
    if (!validVisualBindings(parameters.visuals))
      throw new Error('Invalid canonical visual bindings')
    if (!parameters.visuals.length) continue
    const candidateId = owner(element),
      bindings = groups.get(candidateId) ?? []
    bindings.push(...structuredClone(parameters.visuals))
    groups.set(candidateId, bindings)
  }
  return new Map(
    [...groups].map(([id, bindings]) => [id, Object.freeze(bindings)])
  )
}

export function readCapturedVisualAssetIds(
  document: unknown
): readonly string[] {
  const ids = new Set<string>()
  for (const bindings of readCapturedVisualBindingGroups(document).values())
    bindings.forEach((binding) => ids.add(binding.assetId))
  return Object.freeze([...ids])
}

export function setBodyVisuals(
  core: Core,
  candidateId: string,
  bodyId: string,
  visuals: readonly VisualBinding[],
  admit?: WorkcellResourceAdmission
): void {
  const body = readWorkcell(core, candidateId).bodies.find(
    (body) => body.id === bodyId
  )
  if (!body) throw new Error('Missing body for visual binding')
  upsertBody(core, candidateId, { ...body, visuals }, undefined, admit)
}

export function upsertVisualBinding(
  core: Core,
  candidateId: string,
  bodyId: string,
  binding: VisualBinding,
  admit?: WorkcellResourceAdmission
): void {
  const body = readWorkcell(core, candidateId).bodies.find(
    (body) => body.id === bodyId
  )
  if (!body) throw new Error('Missing body for visual binding')
  const current = body.visuals ?? []
  const visuals = current.some((value) => value.id === binding.id)
    ? current.map((value) => (value.id === binding.id ? binding : value))
    : [...current, binding]
  setBodyVisuals(core, candidateId, bodyId, visuals, admit)
}
