import { runTransaction, type Core } from '@asyra/core'
import {
  validateExperimentDefinition,
  type ExperimentDefinition,
  type ExperimentRule
} from '../analysis/contracts'
import { ComponentTypes, PropertyFields, PropertyNames } from '../constants'
import { hasExactOwnKeys } from '../domain/records'
import { validateTrajectory } from '../domain/workcell'
import { readWorkcell } from './workcell'

export type ExperimentDraft = Omit<
  ExperimentDefinition,
  'revision' | 'rule'
> & {
  rule: Omit<ExperimentRule, 'revision'>
}

export interface CanonicalExperiment {
  id: string
  candidateId: string
  name: string
  definition: ExperimentDefinition
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => sameValue(value, b[index]))
    )
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const left = Object.keys(a),
    right = Object.keys(b)
  return (
    left.length === right.length &&
    left.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        sameValue(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
    )
  )
}

function definitionFromDraft(
  draft: ExperimentDraft,
  revision: number,
  ruleRevision: number
): ExperimentDefinition {
  return {
    ...structuredClone(draft),
    revision,
    rule: { ...structuredClone(draft.rule), revision: ruleRevision }
  }
}

function draftFromDefinition(
  definition: ExperimentDefinition
): ExperimentDraft {
  const { revision: _revision, rule, ...draft } = definition
  const { revision: _ruleRevision, ...draftRule } = rule
  return { ...draft, rule: draftRule }
}

function validateForCandidate(
  core: Core,
  candidateId: string,
  definition: ExperimentDefinition
): void {
  validateExperimentDefinition(definition)
  const workcell = readWorkcell(core, candidateId)
  validateTrajectory(workcell, definition.trajectory)
  const actuated = workcell.bodies.filter((body) => body.joint.kind !== 'fixed')
  if (
    !hasExactOwnKeys(
      definition.sourceUnits.joints,
      actuated.map((body) => body.id)
    )
  )
    throw new Error('Experiment source units do not match the candidate joints')
  for (const body of actuated) {
    const unit = definition.sourceUnits.joints[body.id]
    if (
      (body.joint.kind === 'revolute' && unit !== 'deg' && unit !== 'rad') ||
      (body.joint.kind === 'prismatic' && unit !== 'mm' && unit !== 'm')
    )
      throw new Error(`Experiment source unit does not match joint ${body.id}`)
  }
  const first = definition.trajectory.keyframes[0],
    last = definition.trajectory.keyframes.at(-1)
  if (
    !first ||
    !last ||
    definition.interval[0] < first.time ||
    definition.interval[1] > last.time
  )
    throw new Error('Experiment interval is not covered by its trajectory')
}

export function readExperiment(
  core: Core,
  experimentId: string
): CanonicalExperiment {
  const snapshot = core.getCanonicalOwnerSnapshot(),
    element = snapshot.sceneTree.elements[experimentId]
  if (!element || element.type !== ComponentTypes.EXPERIMENT)
    throw new Error('Missing experiment')
  const candidateId = element.parentId,
    candidate = candidateId
      ? snapshot.sceneTree.elements[candidateId]
      : undefined
  if (!candidateId || candidate?.type !== ComponentTypes.CANDIDATE)
    throw new Error('Experiment must belong directly to a candidate')
  const property = snapshot.props[
    element.props?.[PropertyNames.EXPERIMENT] ?? ''
  ] as Record<string, unknown> | undefined
  const definition = property?.[PropertyFields.EXPERIMENT]
  validateExperimentDefinition(definition)
  return {
    id: experimentId,
    candidateId,
    name: element.name,
    definition: structuredClone(definition)
  }
}

export function readExperiments(
  core: Core,
  candidateId: string
): readonly CanonicalExperiment[] {
  const candidate = core.getElementData(candidateId)
  if (!candidate || candidate.type !== ComponentTypes.CANDIDATE)
    throw new Error('Missing candidate')
  return Object.values(core.getCanonicalOwnerSnapshot().sceneTree.elements)
    .filter(
      (element) =>
        element.type === ComponentTypes.EXPERIMENT &&
        element.parentId === candidateId
    )
    .map((element) => readExperiment(core, element.id))
}

export function createExperiment(
  core: Core,
  candidateId: string,
  name: string,
  draft: ExperimentDraft
): string {
  if (!name.trim() || name.length > 200)
    throw new Error('Experiment name must contain 1 to 200 characters')
  const definition = definitionFromDraft(draft, 1, 1)
  validateForCandidate(core, candidateId, definition)
  return runTransaction(() =>
    core.createElementInParent(
      {
        type: ComponentTypes.EXPERIMENT,
        name,
        x: 0,
        y: 0,
        [PropertyFields.EXPERIMENT]: definition
      },
      candidateId
    )
  )
}

export function updateExperiment(
  core: Core,
  experimentId: string,
  expectedRevision: number,
  draft: ExperimentDraft
): ExperimentDefinition {
  const current = readExperiment(core, experimentId)
  if (current.definition.revision !== expectedRevision)
    throw new Error('Experiment revision is stale')
  if (sameValue(draftFromDefinition(current.definition), draft))
    return current.definition
  const ruleRevision = sameValue(
    draftFromDefinition(current.definition).rule,
    draft.rule
  )
    ? current.definition.rule.revision
    : current.definition.rule.revision + 1
  const next = definitionFromDraft(
    draft,
    current.definition.revision + 1,
    ruleRevision
  )
  validateForCandidate(core, current.candidateId, next)
  runTransaction(() =>
    core.updateElementProperties([
      {
        elementId: experimentId,
        values: { [PropertyFields.EXPERIMENT]: next }
      }
    ])
  )
  return structuredClone(next)
}

export function removeExperiment(core: Core, experimentId: string): void {
  readExperiment(core, experimentId)
  runTransaction(() => core.removeSubtree(experimentId))
}
