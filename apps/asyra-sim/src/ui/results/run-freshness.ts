import type { ExperimentSnapshot } from '../../analysis/contracts'
import type { AnalysisResult } from '../../analysis/result'
import type { ExperimentDraft } from '../../common-apis/experiment'
import type { Workcell } from '../../domain/workcell'
import { definitionToDraft } from '../experiments/experiment-draft'

export interface PresentedRun {
  snapshot: ExperimentSnapshot
  result: AnalysisResult
}

export function geometryIdentity(workcell: Workcell, originalParts: boolean) {
  return JSON.stringify({
    robotRootId: workcell.robotRootId,
    bodies: workcell.bodies.map(
      ({ id, parentId, pose, joint, colliders, visuals }) => ({
        id,
        parentId,
        pose,
        joint,
        ...(originalParts && visuals?.length
          ? { originalParts: visuals }
          : { colliders })
      })
    )
  })
}

export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item

    return Object.fromEntries(
      Object.keys(item)
        .sort()
        .map((key) => [key, item[key]])
    )
  })
}

export function isPresentedRunStale(
  run: PresentedRun,
  workcell: Workcell,
  draft: ExperimentDraft
): boolean {
  const { snapshot } = run

  return (
    geometryIdentity(snapshot.workcell, snapshot.version === 2) !==
      geometryIdentity(workcell, snapshot.version === 2) ||
    stableJson(
      definitionToDraft({
        version: 1,
        revision: 1,
        trajectory: snapshot.trajectory,
        sourceUnits: snapshot.sourceUnits,
        scope: snapshot.scope,
        interval: snapshot.interval,
        method: snapshot.method,
        rule: snapshot.rule,
        budget: snapshot.budget
      })
    ) !== stableJson(draft)
  )
}
