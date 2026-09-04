import { runTransaction, type Core } from '@asyra/core'
import { PropertyFields } from '../constants'
import { createCandidate, readCandidateLineage, readWorkcell } from './workcell'
import {
  createExperiment,
  readExperiments,
  type ExperimentDraft
} from './experiment'
import type { CandidateLineage } from './candidate-lineage'

/** Copy editable inputs, never historical evidence or runtime resources. */
export function duplicateCandidate(
  core: Core,
  sourceId: string,
  name: string
): string {
  const source = readWorkcell(core, sourceId),
    lineage = readCandidateLineage(core, sourceId)
  const ids = new Map(
    source.bodies.map((body) => [body.id, crypto.randomUUID()])
  )
  const remap = (id: string): string => {
    const next = ids.get(id)
    if (!next)
      throw new Error(`Unresolved body reference in source candidate: ${id}`)
    return next
  }
  const remapRecord = <T>(
    record: Readonly<Record<string, T>>
  ): Record<string, T> =>
    Object.fromEntries(
      Object.entries(record).map(([id, value]) => [remap(id), value])
    )
  const workcell = {
    ...structuredClone(source),
    robotRootId: source.robotRootId === null ? null : remap(source.robotRootId),
    bodies: source.bodies.map((body) => ({
      ...structuredClone(body),
      id: remap(body.id),
      parentId: body.parentId === null ? null : remap(body.parentId)
    }))
  }
  const experiments = readExperiments(core, sourceId).map((experiment) => {
    const { revision: _revision, rule, ...definition } = experiment.definition
    const { revision: _ruleRevision, ...draftRule } = rule
    const draft: ExperimentDraft = {
      ...definition,
      rule: draftRule,
      trajectory: {
        ...definition.trajectory,
        keyframes: definition.trajectory.keyframes.map((frame) => ({
          ...frame,
          joints: remapRecord(frame.joints)
        }))
      },
      sourceUnits: {
        ...definition.sourceUnits,
        joints: remapRecord(definition.sourceUnits.joints)
      },
      scope: {
        ...definition.scope,
        primaryBodyIds: definition.scope.primaryBodyIds.map(remap),
        influencingBodyIds: definition.scope.influencingBodyIds.map(remap),
        acknowledgedExcludedVisibleBodyIds:
          definition.scope.acknowledgedExcludedVisibleBodyIds.map(remap),
        excludedPairs: definition.scope.excludedPairs.map((pair) => ({
          ...pair,
          a: remap(pair.a),
          b: remap(pair.b)
        }))
      }
    }
    return { name: experiment.name, draft }
  })
  const nextLineage: CandidateLineage = {
    version: 1,
    copiedFromCandidateId: sourceId,
    bodyOrigins: Object.fromEntries(
      source.bodies.map((body) => [
        remap(body.id),
        lineage?.bodyOrigins[body.id] ?? {
          candidateId: sourceId,
          bodyId: body.id
        }
      ])
    )
  }
  return runTransaction(() => {
    const id = createCandidate(core, name, workcell)
    core.updateElementProperties([
      {
        elementId: id,
        values: {
          [PropertyFields.CANDIDATE]: {
            robotRootId: workcell.robotRootId,
            lineage: nextLineage
          }
        }
      }
    ])
    for (const experiment of experiments)
      createExperiment(core, id, experiment.name, experiment.draft)
    return id
  })
}
