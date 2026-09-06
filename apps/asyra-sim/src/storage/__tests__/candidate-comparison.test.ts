import { expect, it } from 'vitest'
import { IDENTITY_POSE } from '../../domain/math'
import type { Workcell } from '../../domain/workcell'
import { DEFAULT_EXPERIMENT_DEFINITION } from '../../init/properties'
import { createExperimentSnapshot } from '../../analysis/snapshot'
import {
  OFFICIAL_CLEARANCE_METHOD,
  runOfficialClearanceMethod
} from '../../analysis/methods/official-method'
import { completeAnalysisResult } from '../../analysis/result'
import { compareRuns } from '../run-comparison'
import { validateRunRecord, type RunRecord } from '../run-record'
import { exportRunCsv, exportRunHtml, exportRunJson } from '../run-reports'

function run(candidateId: string, copied: boolean, offset = 4): RunRecord {
  const ids = [`${candidateId}:left`, `${candidateId}:right`]
  const workcell: Workcell = {
    version: 1,
    robotRootId: null,
    bodies: ids.map((id, index) => ({
      id,
      name: index ? 'Obstacle' : 'Primary',
      parentId: null,
      role: 'fixture',
      visible: true,
      color: 0x123456,
      pose: { ...IDENTITY_POSE, position: [index * offset, 0, 0] },
      joint: { kind: 'fixed', axis: [0, 1, 0], value: 0, min: 0, max: 0 },
      colliders: [
        {
          id: 'shape',
          pose: IDENTITY_POSE,
          geometry: { kind: 'sphere', radius: 0.5 }
        }
      ]
    }))
  }
  const definition = structuredClone(DEFAULT_EXPERIMENT_DEFINITION)
  definition.scope = {
    ...definition.scope,
    primaryBodyIds: [ids[0]],
    influencingBodyIds: [ids[1]],
    externalCollision: true
  }
  const snapshot = createExperimentSnapshot({
    snapshotId: `snapshot-${candidateId}`,
    candidateId,
    experimentId: `study-${candidateId}`,
    workcell,
    definition,
    methods: [OFFICIAL_CLEARANCE_METHOD],
    acknowledgedWarningCodes: []
  })
  return {
    version: 1,
    name: candidateId,
    retainedAt: '2026-09-05T00:00:00.000Z',
    environment: {
      appVersion: 'test',
      userAgent: 'Test',
      hardwareConcurrency: 8
    },
    ...(copied
      ? {
          lineage: {
            version: 1 as const,
            copiedFromCandidateId: 'A',
            bodyOrigins: {
              [ids[0]]: { candidateId: 'A', bodyId: 'A:left' },
              [ids[1]]: { candidateId: 'A', bodyId: 'A:right' }
            }
          }
        }
      : {}),
    snapshot,
    result: completeAnalysisResult(
      snapshot,
      runOfficialClearanceMethod(snapshot),
      { runId: `run-${candidateId}`, startedAt: 0, endedAt: 1 }
    )
  }
}

it('compares explicit A/B/C correspondence while preserving actual geometry differences and raw identities', () => {
  const a = run('A', false),
    b = run('B', true),
    c = run('C', true, 5),
    before = JSON.stringify([a, b, c])
  const identical = compareRuns([a, b])
  expect(identical.directlyComparable).toBe(true)
  expect(identical.differences).toEqual([])
  const changed = compareRuns([a, b, c])
  expect(changed.directlyComparable).toBe(true)
  expect(
    changed.differences.some((difference) =>
      difference.path.startsWith('workcell.bodies')
    )
  ).toBe(true)
  expect(changed.runs[1].snapshot.workcell.bodies[0].id).toBe('B:left')
  expect(JSON.stringify([a, b, c])).toBe(before)
  expect(compareRuns([a, run('unrelated', false)]).directlyComparable).toBe(
    false
  )
})

it('rejects incomplete or duplicate lineage instead of guessing and retains it in every report format', () => {
  const b = run('B', true)
  expect(validateRunRecord(b).lineage).toEqual(b.lineage)
  expect(Object.isFrozen(validateRunRecord(b).lineage?.bodyOrigins)).toBe(true)
  const incomplete = structuredClone(b)
  if (!incomplete.lineage) throw new Error('Missing test lineage')
  incomplete.lineage.bodyOrigins = {
    'B:left': { candidateId: 'A', bodyId: 'A:left' }
  }
  expect(() => validateRunRecord(incomplete)).toThrow('lineage')
  const duplicated = structuredClone(b)
  if (!duplicated.lineage) throw new Error('Missing test lineage')
  duplicated.lineage.bodyOrigins = {
    'B:left': { candidateId: 'A', bodyId: 'A:left' },
    'B:right': { candidateId: 'A', bodyId: 'A:left' }
  }
  expect(() => validateRunRecord(duplicated)).toThrow('lineage')
  expect(JSON.parse(exportRunJson(b)).run.lineage).toEqual(b.lineage)
  expect(exportRunCsv(b)).toContain('lineage_json')
  expect(exportRunCsv(b)).toContain('A:right')
  expect(exportRunHtml(b)).toContain('A:right')
})
