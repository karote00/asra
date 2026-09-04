import type { Core } from '@asyra/core'
import { ComponentTypes, PropertyFields, PropertyNames } from '../constants'
import { isPlainRecord } from '../domain/records'
import { validVisualBindings, type VisualBinding } from '../domain/workcell'
import {
  readWorkcell,
  upsertBody,
  type WorkcellResourceAdmission
} from './workcell'

export function readCapturedVisualAssetIds(
  document: unknown
): readonly string[] {
  if (
    !isPlainRecord(document) ||
    !isPlainRecord(document.sceneTree) ||
    !isPlainRecord(document.sceneTree.elements) ||
    !isPlainRecord(document.props)
  )
    throw new Error('Invalid canonical capture for visual sources')
  const ids = new Set<string>()
  for (const element of Object.values(document.sceneTree.elements)) {
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
    parameters.visuals.forEach((binding) => ids.add(binding.assetId))
  }
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
