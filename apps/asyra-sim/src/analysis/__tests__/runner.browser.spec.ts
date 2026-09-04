import { expect, test } from '@playwright/test'
import { MethodIds, MethodVersions } from '../../constants'
import { IDENTITY_POSE } from '../../domain/math'
import type { Body, Workcell } from '../../domain/workcell'
import type { ExperimentSnapshot } from '../contracts'

const body = (id: string, x: number): Body => ({
  id,
  parentId: null,
  name: id,
  role: id === 'primary' ? 'tool' : 'fixture',
  pose: { ...IDENTITY_POSE, position: [x, 0, 0] },
  joint: { kind: 'fixed', axis: [1, 0, 0], value: 0, min: 0, max: 0 },
  colliders: [
    {
      id: 'shape',
      pose: IDENTITY_POSE,
      geometry: { kind: 'sphere', radius: 0.1 }
    }
  ],
  visible: true,
  color: 0
})

const snapshot = (): ExperimentSnapshot => {
  const workcell: Workcell = {
    version: 1,
    robotRootId: null,
    bodies: [body('primary', 0), body('obstacle', 0)]
  }
  return {
    version: 1,
    snapshotId: 'browser-snapshot',
    source: {
      candidateId: 'candidate-1',
      experimentId: 'experiment-1',
      experimentRevision: 1
    },
    workcell,
    trajectory: { version: 1, keyframes: [{ time: 0, joints: {} }] },
    sourceUnits: { time: 's', joints: {} },
    interval: [0, 0],
    scope: {
      primaryBodyIds: ['primary'],
      influencingBodyIds: ['obstacle'],
      selfCollision: false,
      externalCollision: true,
      excludedPairs: [],
      acknowledgedExcludedVisibleBodyIds: [],
      backgroundNote: 'Complete browser proof scope.'
    },
    pairs: [
      {
        id: 'primary/shape::obstacle/shape',
        a: { bodyId: 'primary', colliderId: 'shape' },
        b: { bodyId: 'obstacle', colliderId: 'shape' }
      }
    ],
    method: {
      id: MethodIds.CONTINUOUS_CLEARANCE,
      version: MethodVersions.CONTINUOUS_CLEARANCE,
      settings: {
        distanceTolerance: 0.000001,
        timeTolerance: 0.0001,
        maxIterations: 64
      }
    },
    rule: { version: 1, revision: 1, minimumClearance: 0.01 },
    budget: { maxIntervals: 64, maxDurationMs: 5000 },
    acknowledgedWarnings: []
  }
}

test('the production analysis worker returns validated collision evidence', async ({
  page
}, testInfo) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.goto('/')
  const result = await page.evaluate(
    async ({ input, moduleUrl }) => {
      const { AnalysisRunner } = await import(moduleUrl)
      const runner = new AnalysisRunner()
      try {
        return await runner.run(input)
      } finally {
        await runner.dispose()
      }
    },
    { input: snapshot(), moduleUrl: '/src/analysis/runner.ts' }
  )
  expect(result).toMatchObject({
    execution: 'completed',
    coverage: 'complete',
    verdict: 'does-not-meet',
    summary: 'issue-found',
    findingPairCount: 1
  })
  expect(
    requests.filter((url) => new URL(url).origin !== new URL(page.url()).origin)
  ).toEqual([])
  await testInfo.attach('analysis-worker-result', {
    contentType: 'application/json',
    body: JSON.stringify(result)
  })
})
