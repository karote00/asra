import { runTransaction, type Core } from '@asyra/core'
import { ComponentTypes, PropertyFields, PropertyNames } from '../constants'
import {
  validateWorkcell,
  type Body,
  type BodyParameters,
  type Workcell
} from '../domain/workcell'
import { validCandidateParameters } from '../init/properties'

const parameters = (body: Body): BodyParameters => ({
  role: body.role,
  pose: body.pose,
  joint: body.joint,
  colliders: body.colliders,
  color: body.color
})
export function readWorkcell(core: Core, candidateId: string): Workcell {
  const snapshot = core.getCanonicalOwnerSnapshot(),
    candidate = snapshot.sceneTree.elements[candidateId]
  if (!candidate || candidate.type !== ComponentTypes.CANDIDATE)
    throw new Error('Missing candidate')
  const candidateProperty = snapshot.props[
    candidate.props?.[PropertyNames.CANDIDATE] ?? ''
  ] as Record<string, unknown> | undefined
  const config = candidateProperty?.[PropertyFields.CANDIDATE]
  if (!validCandidateParameters(config))
    throw new Error('Invalid canonical candidate parameters')
  const belongs = (id: string): boolean => {
    const visited = new Set<string>()
    let current: string | undefined = id
    while (current && current !== candidateId) {
      if (visited.has(current)) throw new Error('Canonical hierarchy cycle')
      visited.add(current)
      current = snapshot.sceneTree.elements[current]?.parentId
    }
    return current === candidateId
  }
  const bodies: Body[] = []
  for (const element of Object.values(snapshot.sceneTree.elements)) {
    if (element.type !== ComponentTypes.BODY || !belongs(element.id)) continue
    const property = snapshot.props[
      element.props?.[PropertyNames.BODY] ?? ''
    ] as Record<string, unknown> | undefined
    const bodyParameters = property?.[PropertyFields.BODY]
    if (!bodyParameters || typeof bodyParameters !== 'object')
      throw new Error('Missing body parameters')
    bodies.push({
      ...(bodyParameters as BodyParameters),
      id: element.id,
      parentId:
        element.parentId === candidateId ? null : (element.parentId ?? null),
      name: element.name,
      visible: element.visible
    })
  }
  const workcell: Workcell = {
    version: 1,
    robotRootId: config.robotRootId,
    bodies
  }
  validateWorkcell(workcell)
  return workcell
}

function writeRoot(
  core: Core,
  candidateId: string,
  robotRootId: string | null
): void {
  core.updateElementProperties([
    {
      elementId: candidateId,
      values: { [PropertyFields.CANDIDATE]: { robotRootId } }
    }
  ])
}
function insertBody(core: Core, candidateId: string, body: Body): void {
  core.createElementInParent(
    {
      id: body.id,
      type: ComponentTypes.BODY,
      x: 0,
      y: 0,
      name: body.name,
      visible: body.visible,
      [PropertyFields.BODY]: parameters(body)
    },
    body.parentId ?? candidateId
  )
}
export function replaceWorkcell(
  core: Core,
  candidateId: string,
  workcell: Workcell
): void {
  validateWorkcell(workcell)
  const current = readWorkcell(core, candidateId)
  const owned = new Set(current.bodies.map((body) => body.id))
  for (const body of workcell.bodies)
    if (core.getElementData(body.id) && !owned.has(body.id))
      throw new Error('Body identity belongs to another candidate')
  runTransaction(() => {
    const desired = new Map(workcell.bodies.map((body) => [body.id, body]))
    const obsolete = new Set(
      current.bodies
        .filter((body) => !desired.has(body.id))
        .map((body) => body.id)
    )
    for (const body of current.bodies) {
      const retained = desired.get(body.id)
      if (
        retained &&
        body.parentId !== null &&
        body.parentId !== retained.parentId
      )
        core.moveElements({
          elementIds: [body.id],
          targetParentId: candidateId,
          targetIndex: 0
        })
    }
    for (const body of current.bodies)
      if (obsolete.has(body.id) && !obsolete.has(body.parentId ?? ''))
        core.removeSubtree(body.id)
    const pending = [...workcell.bodies],
      inserted = new Set<string>()
    while (pending.length) {
      const index = pending.findIndex(
        (body) => body.parentId === null || inserted.has(body.parentId)
      )
      if (index < 0) throw new Error('Invalid insertion hierarchy')
      const [body] = pending.splice(index, 1)
      if (owned.has(body.id)) {
        const target = body.parentId ?? candidateId
        if (core.getElementData(body.id)?.parentId !== target)
          core.moveElements({
            elementIds: [body.id],
            targetParentId: target,
            targetIndex: 0
          })
        core.updateElementProperties([
          {
            elementId: body.id,
            values: { [PropertyFields.BODY]: parameters(body) }
          }
        ])
        core.updateElementData(body.id, {
          name: body.name,
          visible: body.visible
        })
      } else insertBody(core, candidateId, body)
      inserted.add(body.id)
    }
    if (current.robotRootId !== workcell.robotRootId)
      writeRoot(core, candidateId, workcell.robotRootId)
  })
}
export function createCandidate(
  core: Core,
  name: string,
  workcell: Workcell
): string {
  validateWorkcell(workcell)
  if (!name.trim() || name.length > 200)
    throw new Error('Candidate name must contain 1 to 200 characters')
  return runTransaction(() => {
    const id = core.createElement({
      type: ComponentTypes.CANDIDATE,
      name,
      x: 0,
      y: 0
    })
    replaceWorkcell(core, id, workcell)
    return id
  })
}
export function upsertBody(
  core: Core,
  candidateId: string,
  body: Body,
  robotRootId?: string | null
): void {
  const current = readWorkcell(core, candidateId),
    existing = current.bodies.find((item) => item.id === body.id)
  if (!existing && core.getElementData(body.id))
    throw new Error('Body identity belongs to another candidate')
  const next: Workcell = {
    ...current,
    robotRootId: robotRootId === undefined ? current.robotRootId : robotRootId,
    bodies: existing
      ? current.bodies.map((item) => (item.id === body.id ? body : item))
      : [...current.bodies, body]
  }
  validateWorkcell(next)
  runTransaction(() => {
    if (existing) {
      core.updateElementProperties([
        {
          elementId: body.id,
          values: { [PropertyFields.BODY]: parameters(body) }
        }
      ])
      core.updateElementData(body.id, {
        name: body.name,
        visible: body.visible
      })
      if (existing.parentId !== body.parentId)
        core.moveElements({
          elementIds: [body.id],
          targetParentId: body.parentId ?? candidateId,
          targetIndex: 0
        })
    } else insertBody(core, candidateId, body)
    if (current.robotRootId !== next.robotRootId)
      writeRoot(core, candidateId, next.robotRootId)
  })
}
export function removeBody(
  core: Core,
  candidateId: string,
  bodyId: string
): void {
  const current = readWorkcell(core, candidateId)
  if (!current.bodies.some((body) => body.id === bodyId))
    throw new Error('Missing body')
  const removed = new Set([bodyId])
  const pending = [bodyId]
  while (pending.length) {
    const parent = pending.pop()
    for (const body of current.bodies) {
      if (body.parentId !== parent) continue
      removed.add(body.id)
      pending.push(body.id)
    }
  }
  const next: Workcell = {
    ...current,
    robotRootId:
      current.robotRootId && removed.has(current.robotRootId)
        ? null
        : current.robotRootId,
    bodies: current.bodies.filter((body) => !removed.has(body.id))
  }
  validateWorkcell(next)
  runTransaction(() => {
    core.removeSubtree(bodyId)
    if (next.robotRootId !== current.robotRootId)
      writeRoot(core, candidateId, next.robotRootId)
  })
}
