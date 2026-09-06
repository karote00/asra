import { MethodIds, MethodVersions } from '../../constants'
import {
  EXPERIMENT_RESOURCE_PROFILE,
  type ExperimentSnapshot
} from '../contracts'
import type {
  InstalledMethodDescriptor,
  MethodContext
} from '../../extensions/contracts'
import type { MeshGeometry } from '../../domain/part-geometry'
import type { PreparedMeshIndex } from './mesh-index'
import {
  queryContinuousPair,
  type PairQuery,
  type QuerySettings
} from './continuous-query'
import { separationLowerBound } from './convex-query'
import { MeshWorkLimit, OriginalMeshQuery } from './original-mesh-query'
import {
  runClearanceQueries,
  type OfficialMethodEvidence,
  type OfficialPairEvidence
} from './official-method'

export const ORIGINAL_PART_METHOD: InstalledMethodDescriptor = {
  id: MethodIds.ORIGINAL_PART_CLEARANCE,
  version: MethodVersions.ORIGINAL_PART_CLEARANCE,
  geometryKinds: ['mesh', 'box', 'sphere', 'capsule'],
  supportsStatic: true,
  supportsMotion: true,
  maxPairs: EXPERIMENT_RESOURCE_PROFILE.maxPairs,
  warningWorkUnits: EXPERIMENT_RESOURCE_PROFILE.warningWorkUnits,
  parameterSchema: {},
  manifest: {
    contractVersion: 1,
    name: 'Original-part continuous clearance',
    origin: 'official',
    author: 'Asyra Sim contributors',
    source: 'src/analysis/methods/original-part-method.ts',
    license: 'MIT',
    purpose:
      'Collision and clearance experiments on complete supplied original part triangles and native analytical parts.',
    units: 'm-rad-s',
    coordinates: 'right-handed-y-up',
    applicability:
      'Machine-scale rigid parts. Closed oriented manifold components interpreted as a union of solids using nonzero signed winding per component. Every source triangle is retained; unsupported topology blocks analysis. Not manufacturer CAD certification, dynamics, metrology or physical-safety approval.',
    numericalSemantics:
      'Outward binary64 kinematics, original-triangle support certificates and signed ray membership. Conservative hierarchy rejection only. Complete time intervals or explicit unresolved coverage; sampled frames never prove clearance. Bounds, not requested precision, are evidence.',
    controls:
      'distanceTolerance bounds requested search width, timeTolerance stops time subdivision, maxIterations bounds each triangle/primitive convex search. Uncertain boundary predicates remain unresolved.',
    reproducibility:
      'Deterministic source-order geometry and median hierarchy; fixed ray directions with enclosed predicates. No random seed. Chromium arithmetic conformance required.',
    resources:
      'At most 500000 logical mesh work units per invocation plus the global temporal/evidence/byte budgets. One owned Worker; topology and triangle traversal checkpoint cancellation and wall-time. Immutable indices may be reused within its admitted live input lifetime; preparation work is charged equivalently on hits.',
    services: {
      network: false,
      additionalFiles: false,
      commercialRuntime: false
    },
    validation: {
      status: 'unverified',
      evidence:
        'Permanent local original-part, hole, containment, crossing, interval and hierarchy-equivalence tests. Independent numerical review, reference hardware and release gates remain open.'
    }
  }
}

export function queryOriginalPartPair(
  query: PairQuery,
  settings: QuerySettings,
  checkpoint: () => void = () => undefined,
  context = new OriginalMeshQuery(checkpoint)
) {
  const bounded = <T>(operation: () => T): T | null => {
    try {
      return operation()
    } catch (error) {
      if (error instanceof MeshWorkLimit) return null
      throw error
    }
  }
  return queryContinuousPair(query, settings, checkpoint, {
    relativeFrames: true,
    distance: (a, b) =>
      bounded(() =>
        context.distance(
          a,
          b,
          settings.threshold,
          settings.distanceTolerance,
          settings.maxIterations
        )
      ),
    lower: (a, b, witness) =>
      bounded(() =>
        a.geometry.kind === 'mesh' || b.geometry.kind === 'mesh'
          ? context.lowerOver(
              a,
              b,
              settings.threshold,
              witness,
              settings.distanceTolerance,
              settings.maxIterations
            )
          : separationLowerBound(a, b, witness.axis)
      ),
    exhaustionReason:
      'Original-triangle work budget exhausted; complete source geometry was not simplified.'
  })
}

export function runOriginalPartMethod(
  snapshot: ExperimentSnapshot,
  checkpoint: () => void = () => undefined,
  onPair: (pair: OfficialPairEvidence) => void = () => undefined,
  prepared?: WeakMap<MeshGeometry, PreparedMeshIndex>
): OfficialMethodEvidence {
  const context = new OriginalMeshQuery(checkpoint, undefined, true, prepared)
  return runClearanceQueries(
    snapshot,
    ORIGINAL_PART_METHOD,
    (query, settings, check) =>
      queryOriginalPartPair(query, settings, check, context),
    checkpoint,
    onPair
  )
}

/** One Worker-owned input lifetime; every invocation still owns fresh query work. */
export function createOriginalPartExecutor() {
  const prepared = new WeakMap<MeshGeometry, PreparedMeshIndex>()

  return (snapshot: ExperimentSnapshot, context: MethodContext) =>
    runOriginalPartMethod(
      snapshot,
      context.checkpoint,
      context.emitPair,
      prepared
    )
}
