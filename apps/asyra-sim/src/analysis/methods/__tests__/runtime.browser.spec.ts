import { expect, test } from '@playwright/test'

test('Chromium original-triangle predicates distinguish containment from diagonal interval clearance', async ({
  page
}, info) => {
  await page.goto('/')
  const evidence = await page.evaluate(async () => {
    const algebraPath = '/src/domain/kinematic-algebra.ts',
      queryPath = '/src/analysis/methods/original-mesh-query.ts'
    const { poseOperations, intervalAlgebra } = (await import(
      algebraPath
    )) as typeof import('../../../domain/kinematic-algebra')
    const { OriginalMeshQuery } = (await import(
      queryPath
    )) as typeof import('../original-mesh-query')
    const ops = poseOperations(intervalAlgebra),
      query = new OriginalMeshQuery()
    const pose = ops.fromPose({ position: [0, 0, 0], rotation: [0, 0, 0, 1] })
    const part = {
      pose,
      geometry: {
        kind: 'mesh',
        version: 1,
        source: { assetId: 'a'.repeat(64), scale: [1, 1, 1] },
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
        indices: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]
      }
    } as const
    const inside = {
      geometry: { kind: 'sphere', radius: 0.02 },
      pose: ops.fromPose({ position: [0.2, 0.2, 0.2], rotation: [0, 0, 0, 1] })
    } as const
    const outside = {
      geometry: { kind: 'sphere', radius: 0.1 },
      pose: ops.fromPose({ position: [0.9, 0.9, 0], rotation: [0, 0, 0, 1] })
    } as const
    const containment = query.distance(part, inside, 0, 1e-6, 48)
    const clearance = query.distance(part, outside, 0.02, 1e-6, 48)
    return {
      containment,
      clearance,
      intervalLower: query.lowerOver(part, outside, 0.02, clearance)
    }
  })
  expect(evidence.containment.penetration).toBe(true)
  expect(evidence.containment.upper).toBe(0)
  // The closest original edge point is (0.5, 0.5, 0), not its enclosing box.
  const exact = Math.hypot(0.4, 0.4) - 0.1
  expect(evidence.clearance.lower).toBeLessThanOrEqual(exact)
  expect(evidence.clearance.upper).toBeGreaterThanOrEqual(exact)
  expect(evidence.intervalLower).toBeGreaterThan(0.02)
  expect(evidence.intervalLower).toBeLessThanOrEqual(exact)
  await info.attach('original-triangle-runtime', {
    contentType: 'application/json',
    body: JSON.stringify(evidence)
  })
})

test('Chromium encloses the analytical 3 m gap for every supported shape pair', async ({
  page
}, testInfo) => {
  await page.goto('/')
  const results = await page.evaluate(async () => {
    const algebraPath = '/src/domain/kinematic-algebra.ts',
      queryPath = '/src/analysis/methods/convex-query.ts'
    const { poseOperations, intervalAlgebra } = (await import(
      algebraPath
    )) as typeof import('../../../domain/kinematic-algebra')
    const { convexDistance } = (await import(
      queryPath
    )) as typeof import('../convex-query')
    const ops = poseOperations(intervalAlgebra),
      geometries = [
        { kind: 'sphere', radius: 1 },
        { kind: 'box', size: [2, 2, 2] },
        { kind: 'capsule', radius: 1, length: 2 }
      ] as const
    const output = []
    for (let a = 0; a < geometries.length; a++)
      for (let b = a; b < geometries.length; b++) {
        const start = performance.now(),
          evidence = convexDistance(
            {
              geometry: geometries[a],
              pose: ops.fromPose({
                position: [0, 0, 0],
                rotation: [0, 0, 0, 1]
              })
            },
            {
              geometry: geometries[b],
              pose: ops.fromPose({
                position: [5, 0, 0],
                rotation: [0, 0, 0, 1]
              })
            }
          )
        output.push({
          pair: `${geometries[a].kind}/${geometries[b].kind}`,
          evidence,
          elapsedMs: performance.now() - start
        })
      }
    return output
  })
  expect(results).toHaveLength(6)
  for (const { evidence } of results) {
    expect(evidence.lower).toBeLessThanOrEqual(3)
    expect(evidence.upper).toBeGreaterThanOrEqual(3)
    expect(evidence.upper - evidence.lower).toBeLessThan(1e-6)
    expect(evidence.penetration).toBe(false)
  }
  await testInfo.attach('static-method-runtime', {
    contentType: 'application/json',
    body: JSON.stringify(results)
  })
})

test('Chromium retains a continuous-time crossing between separated endpoints', async ({
  page
}, testInfo) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const queryPath = '/src/analysis/methods/continuous-query.ts',
      domainPath = '/src/domain/workcell.ts'
    const { queryContinuousPair } = (await import(
      queryPath
    )) as typeof import('../continuous-query')
    const domain: typeof import('../../../domain/workcell') = await import(
      domainPath
    )
    const pose = { position: [0, 0, 0], rotation: [0, 0, 0, 1] } as const
    const base = {
      id: 'base',
      name: 'base',
      parentId: null,
      role: 'robot',
      pose,
      joint: { kind: 'fixed', axis: [1, 0, 0], min: 0, max: 0, value: 0 },
      colliders: [],
      visible: true,
      color: 0
    } as const
    const sphere = {
      id: 'sphere',
      pose,
      geometry: { kind: 'sphere', radius: 0.1 }
    } as const
    const workcell = {
      version: 1,
      robotRootId: 'base',
      bodies: [
        base,
        {
          ...base,
          id: 'moving',
          parentId: 'base',
          role: 'link',
          joint: {
            kind: 'prismatic',
            axis: [1, 0, 0],
            min: -4,
            max: 4,
            value: -3
          },
          colliders: [sphere]
        },
        { ...base, id: 'obstacle', role: 'fixture', colliders: [sphere] }
      ]
    } as const
    const trajectory = {
      version: 1,
      keyframes: [
        { time: 0, joints: { moving: -3 } },
        { time: 1, joints: { moving: 3 } }
      ]
    } as const
    domain.validateWorkcell(workcell)
    domain.validateTrajectory(workcell, trajectory)
    const start = performance.now()
    const evidence = queryContinuousPair(
      {
        workcell,
        trajectory,
        a: { bodyId: 'moving', colliderId: 'sphere' },
        b: { bodyId: 'obstacle', colliderId: 'sphere' },
        interval: [0, 1]
      },
      {
        threshold: 0,
        distanceTolerance: 1e-6,
        timeTolerance: 1e-6,
        maxIntervals: 100,
        maxIterations: 64
      }
    )
    return { evidence, elapsedMs: performance.now() - start }
  })
  expect(result.evidence.coverage).toBe('complete')
  expect(
    result.evidence.leaves.some(
      (leaf) =>
        leaf.state === 'finding' && leaf.penetration && leaf.witnessTime === 0.5
    )
  ).toBe(true)
  expect(result.evidence.lower).toBe(0)
  expect(result.evidence.upper).toBe(0)
  await testInfo.attach('continuous-method-runtime', {
    contentType: 'application/json',
    body: JSON.stringify(result)
  })
})
