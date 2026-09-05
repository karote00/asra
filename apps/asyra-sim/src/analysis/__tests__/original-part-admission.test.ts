import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createMechanicalVisuals } from '../../../samples/mechanical-visuals'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import { IDENTITY_POSE } from '../../domain/math'
import { decodeRestrictedGlb } from '../../engine/glb/decode'
import { createMethodCatalog } from '../../extensions/catalog'
import { INSTALLED_METHOD_CATALOG } from '../../extensions/installed-methods'
import { admitSnapshotExecution } from '../../extensions/execution-admission'
import { preflightExperiment } from '../preflight'
import {
  createExperimentSnapshot,
  validateHistoricalSnapshot
} from '../snapshot'
import { AnalysisRunner } from '../runner'
import { AnalysisWorkerHost } from '../worker-host'
import { AnalysisWorkerMessages } from '../worker-protocol'

let tableSourceId: string
beforeAll(async () => {
  const source = createMechanicalVisuals().find(
    (part) => part.body === 'fixture-table'
  )
  if (!source) throw new Error('Missing ordinary table source')
  const asset = await decodeRestrictedGlb(source.bytes)
  tableSourceId = asset.source.sha256
  // The imported table really has legs below the primitive tabletop's local extent.
  expect(
    asset.meshes.some((mesh) =>
      mesh.positions.some((v, i) => i % 3 === 1 && v < -0.5)
    )
  ).toBe(true)
})

function input() {
  const example = createSyntheticExample()
  const draft = createSyntheticExperimentDraft(example)
  return {
    snapshotId: 'source-study',
    candidateId: 'candidate',
    experimentId: 'study',
    workcell: example.workcell,
    definition: { ...draft, revision: 1, rule: { ...draft.rule, revision: 1 } },
    methods: INSTALLED_METHOD_CATALOG.descriptors,
    acknowledgedWarningCodes: [] as string[]
  }
}

function withTableSource(
  workcell: ReturnType<typeof input>['workcell'],
  visible = true
) {
  return {
    ...workcell,
    bodies: workcell.bodies.map((body) =>
      body.id === 'example:fixture-table'
        ? {
            ...body,
            visible,
            visuals: [
              {
                version: 1 as const,
                id: 'table-part',
                assetId: tableSourceId,
                pose: IDENTITY_POSE,
                scale: [1, 1, 1] as [number, number, number]
              }
            ]
          }
        : body
    )
  }
}

function legacySnapshot() {
  const base = createExperimentSnapshot(input())
  // Permanent v1 historical fixture: the old format legitimately retained both representations.
  return { ...base, workcell: withTableSource(base.workcell) }
}

describe('SIM-08 original-part execution admission', () => {
  it.each([true, false])(
    'blocks the complete table source instead of solving its tabletop proxy (visible=%s)',
    (visible) => {
      const base = input()
      const workcell = withTableSource(base.workcell, visible)
      const report = preflightExperiment(
        workcell,
        base.definition,
        base.methods
      )
      expect(report.blockers).toContainEqual(
        expect.objectContaining({
          code: 'original-part-geometry-unsupported',
          bodyIds: ['example:fixture-table']
        })
      )
      expect(report.assumptions.map((issue) => issue.code)).not.toContain(
        'original-part-geometry-unsupported'
      )
      expect(() =>
        createExperimentSnapshot({
          ...base,
          workcell,
          acknowledgedWarningCodes: ['original-part-geometry-unsupported']
        })
      ).toThrow(/original part geometry/i)
    }
  )

  it('retains explicit background scope without treating visibility as analysis authority', () => {
    const base = input()
    base.definition.scope.influencingBodyIds = ['example:fixture-post']
    base.definition.scope.acknowledgedExcludedVisibleBodyIds = [
      'example:fixture-table'
    ]
    const report = preflightExperiment(
      withTableSource(base.workcell),
      base.definition,
      base.methods
    )
    expect(report.blockers).toEqual([])
    expect(
      report.pairs.every(
        (pair) =>
          pair.a.bodyId !== 'example:fixture-table' &&
          pair.b.bodyId !== 'example:fixture-table'
      )
    ).toBe(true)
  })

  it('keeps historical geometry readable but never turns it into permission to rerun', () => {
    const old = legacySnapshot()
    const restored = validateHistoricalSnapshot(old)
    expect(restored).toEqual(old)
    expect(restored).not.toBe(old)
    expect(Object.isFrozen(restored.workcell.bodies)).toBe(true)
    expect(() =>
      admitSnapshotExecution(restored, INSTALLED_METHOD_CATALOG)
    ).toThrow(/original part geometry/i)
  })

  it('rejects at runner admission before allocating a worker', async () => {
    const allocate = vi.fn(() => {
      throw new Error('Unexpected worker allocation')
    })
    const runner = new AnalysisRunner(allocate)
    await expect(runner.run(legacySnapshot())).rejects.toThrow(
      /original part geometry/i
    )
    expect(allocate).not.toHaveBeenCalled()
    expect(runner.isRunning()).toBe(false)
    expect(runner.getProgress()).toBeNull()
  })

  it('rejects a direct Worker request before invoking the installed method', async () => {
    const old = legacySnapshot()
    const installed = INSTALLED_METHOD_CATALOG.resolve(
      old.method.id,
      old.method.version
    )
    const execute = vi.fn(() => {
      throw new Error('Unexpected method execution')
    })
    const post = vi.fn(),
      close = vi.fn()
    const host = new AnalysisWorkerHost(
      createMethodCatalog([{ ...installed, execute }]),
      post,
      close
    )
    await host.handle({
      type: AnalysisWorkerMessages.RUN,
      runId: 'blocked-run',
      snapshot: old
    })
    expect(execute).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AnalysisWorkerMessages.ERROR,
        error: expect.stringContaining('admission')
      })
    )
    expect(post).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: AnalysisWorkerMessages.COMPLETE })
    )
  })
})
