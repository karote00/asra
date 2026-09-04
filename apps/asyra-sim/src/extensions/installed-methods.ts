import {
  OFFICIAL_CLEARANCE_METHOD,
  runOfficialClearanceMethod
} from '../analysis/methods/official-method'
import {
  STATIC_SPHERE_METHOD,
  runStaticSphereMethod
} from '../analysis/methods/static-spheres'
import { createMethodCatalog } from './catalog'
import type { InstalledMethodDescriptor } from './contracts'

const official: InstalledMethodDescriptor = {
  ...OFFICIAL_CLEARANCE_METHOD,
  manifest: {
    contractVersion: 1,
    name: 'Continuous proxy clearance',
    origin: 'official',
    author: 'Asyra Sim contributors',
    source: 'src/analysis/methods/official-method.ts',
    license: 'MIT',
    purpose:
      'Static and continuous collision/clearance experiments on rigid proxies.',
    units: 'm-rad-s',
    coordinates: 'right-handed-y-up',
    applicability:
      'Machine-scale v0: box, sphere, capsule; one serial robot; 64 bodies, 12 actuated joints, 2000 frames. Dimensions 0.0001-20 m; local translations up to 1000 m. No dynamics, metrology or physical-safety guarantee.',
    numericalSemantics:
      'Outward kinematic and support bounds over complete intervals; strict witnesses distinguish findings from unresolved contact/threshold overlap. Actual bounds, not requested decimal precision, are evidence.',
    controls:
      'distanceTolerance targets static-search width; timeTolerance stops subdivision; maxIterations bounds convex search. None guarantees the target can be reached.',
    reproducibility:
      'Deterministic binary64/BigInt interval certificates; no random seed. Chromium arithmetic conformance is required; other runtimes remain unverified.',
    resources:
      'Global evaluations, pairs, evidence bytes/leaves and wall-time bounds apply. One owned Worker with cooperative checkpoints and forced termination after the platform grace period.',
    services: {
      network: false,
      additionalFiles: false,
      commercialRuntime: false
    },
    validation: {
      status: 'unverified',
      evidence:
        'Local analytical, convex, continuous and browser arithmetic tests. Independent numerical review, reference-hardware and release gates remain open; official origin is not release approval.'
    }
  },
  parameterSchema: {}
}

/** The single deployment composition imported by both the App and Worker. Restart after edits. */
export const INSTALLED_METHOD_CATALOG = createMethodCatalog([
  {
    descriptor: official,
    execute: (snapshot, context) =>
      runOfficialClearanceMethod(snapshot, context.checkpoint, context.emitPair)
  },
  {
    descriptor: STATIC_SPHERE_METHOD,
    execute: (snapshot, context) =>
      runStaticSphereMethod(snapshot, context.checkpoint, context.emitPair)
  }
])
