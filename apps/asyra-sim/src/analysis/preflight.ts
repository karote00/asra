import {
  validateTrajectory,
  validateWorkcell,
  type Workcell
} from '../domain/workcell'
import { hasExactOwnKeys } from '../domain/records'
import type { TrajectoryJointUnit } from '../domain/trajectory-source'
import {
  validateExperimentDefinition,
  type AnalysisPair,
  type ExperimentDefinition,
  type MethodDescriptor,
  type PreflightIssue,
  type PreflightReport
} from './contracts'

const pairKey = (a: string, b: string): string =>
  a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`

const issue = (
  code: string,
  message: string,
  bodyIds?: readonly string[]
): PreflightIssue => ({ code, message, ...(bodyIds ? { bodyIds } : {}) })

function invalidReport(message: string): PreflightReport {
  const code = message.toLowerCase().includes('exclusion')
    ? 'invalid-exclusion'
    : 'invalid-definition'
  return {
    blockers: [issue(code, message)],
    assumptions: [],
    resourceWarnings: [],
    pairs: [],
    estimate: {
      pairCount: 0,
      segmentCount: 0,
      workUnits: 0,
      reliableTimeEstimate: false
    }
  }
}

export function preflightExperiment(
  workcell: Workcell,
  definition: ExperimentDefinition,
  methods: readonly MethodDescriptor[]
): PreflightReport {
  return inspectExperiment(workcell, definition, methods)
}

/** History validates data and scope without asserting method availability. */
export function inspectHistoricalExperiment(
  workcell: Workcell,
  definition: ExperimentDefinition
): PreflightReport {
  return inspectExperiment(workcell, definition, null)
}

function inspectExperiment(
  workcell: Workcell,
  definition: ExperimentDefinition,
  methods: readonly MethodDescriptor[] | null
): PreflightReport {
  try {
    validateWorkcell(workcell)
    validateExperimentDefinition(definition)
    validateTrajectory(workcell, definition.trajectory)
  } catch (error) {
    return invalidReport(
      error instanceof Error ? error.message : 'Invalid experiment input'
    )
  }

  const blockers: PreflightIssue[] = [],
    assumptions: PreflightIssue[] = [],
    resourceWarnings: PreflightIssue[] = [],
    bodies = new Map(workcell.bodies.map((body) => [body.id, body])),
    primary = new Set(definition.scope.primaryBodyIds),
    influencing = new Set(definition.scope.influencingBodyIds),
    selected = new Set([...primary, ...influencing])

  for (const id of selected)
    if (!bodies.has(id))
      blockers.push(
        issue('missing-body', `Selected body ${id} does not exist.`, [id])
      )
  for (const id of primary)
    if (influencing.has(id))
      blockers.push(
        issue(
          'overlapping-scope',
          `Body ${id} cannot be both primary and influencing.`,
          [id]
        )
      )
  for (const id of selected) {
    const body = bodies.get(id)
    if (body && body.colliders.length === 0)
      blockers.push(
        issue(
          'missing-collider',
          `Selected body ${id} has no analysis collider.`,
          [id]
        )
      )
  }

  const method = methods?.find(
    (candidate) =>
      candidate.id === definition.method.id &&
      candidate.version === definition.method.version
  )
  if (!method && methods !== null)
    blockers.push(
      issue(
        'method-unavailable',
        `Method ${definition.method.id}@${definition.method.version} is unavailable.`
      )
    )
  else if (method) {
    const moving = definition.trajectory.keyframes.length > 1
    if (
      (moving && !method.supportsMotion) ||
      (!moving && !method.supportsStatic)
    )
      blockers.push(
        issue(
          'method-capability',
          `The selected method does not support this trajectory route.`
        )
      )
    const unsupported = [...selected]
      .flatMap((id) => bodies.get(id)?.colliders ?? [])
      .filter(
        (collider) => !method.geometryKinds.includes(collider.geometry.kind)
      )
    if (unsupported.length)
      blockers.push(
        issue(
          'unsupported-geometry',
          'The selected method does not support every selected collider.'
        )
      )
  }

  const actuated = workcell.bodies.filter((body) => body.joint.kind !== 'fixed')
  if (
    !hasExactOwnKeys(
      definition.sourceUnits.joints,
      actuated.map((body) => body.id)
    )
  )
    blockers.push(
      issue(
        'source-unit-mismatch',
        'Source units must cover every actuated joint exactly.'
      )
    )
  else
    for (const body of actuated) {
      const unit = definition.sourceUnits.joints[body.id] as TrajectoryJointUnit
      if (
        (body.joint.kind === 'revolute' && unit !== 'deg' && unit !== 'rad') ||
        (body.joint.kind === 'prismatic' && unit !== 'mm' && unit !== 'm')
      )
        blockers.push(
          issue(
            'source-unit-mismatch',
            `Source unit for ${body.id} does not match its joint kind.`,
            [body.id]
          )
        )
    }

  const first = definition.trajectory.keyframes[0],
    last = definition.trajectory.keyframes.at(-1)
  if (
    !first ||
    !last ||
    definition.interval[0] < first.time ||
    definition.interval[1] > last.time
  )
    blockers.push(
      issue(
        'interval-uncovered',
        'The trajectory does not cover the full analysis interval.'
      )
    )

  const candidateBodyPairs = new Map<string, readonly [string, string]>()
  const primaryIds = [...primary]
  if (definition.scope.selfCollision)
    for (let a = 0; a < primaryIds.length; a++)
      for (let b = a + 1; b < primaryIds.length; b++) {
        const left = primaryIds[a],
          right = primaryIds[b]
        if (left && right)
          candidateBodyPairs.set(pairKey(left, right), [left, right])
      }
  if (definition.scope.externalCollision)
    for (const left of primary)
      for (const right of influencing)
        if (left !== right)
          candidateBodyPairs.set(pairKey(left, right), [left, right])

  const exclusions = new Set<string>()
  for (const exclusion of definition.scope.excludedPairs) {
    const key = pairKey(exclusion.a, exclusion.b)
    if (
      !bodies.has(exclusion.a) ||
      !bodies.has(exclusion.b) ||
      !candidateBodyPairs.has(key) ||
      exclusions.has(key)
    )
      blockers.push(
        issue(
          'invalid-exclusion',
          `Exclusion ${exclusion.a} / ${exclusion.b} is duplicate, unknown, or outside the selected pair policy.`,
          [exclusion.a, exclusion.b]
        )
      )
    else exclusions.add(key)
  }

  const pairs: AnalysisPair[] = []
  for (const [key, [leftId, rightId]] of candidateBodyPairs) {
    if (exclusions.has(key)) continue
    const left = bodies.get(leftId),
      right = bodies.get(rightId)
    if (!left || !right) continue
    for (const a of left.colliders)
      for (const b of right.colliders)
        pairs.push({
          id: `${left.id}/${a.id}::${right.id}/${b.id}`,
          a: { bodyId: left.id, colliderId: a.id },
          b: { bodyId: right.id, colliderId: b.id }
        })
  }
  if (!pairs.length)
    blockers.push(
      issue(
        'no-pairs',
        'The selected scope contains no checkable collider pairs.'
      )
    )
  if (method && pairs.length > method.maxPairs)
    blockers.push(
      issue(
        'method-pair-limit',
        `The selected scope exceeds the method hard limit of ${method.maxPairs} pairs.`
      )
    )

  const acknowledged = new Set(
    definition.scope.acknowledgedExcludedVisibleBodyIds
  )
  const visibleExcluded = workcell.bodies
    .filter(
      (body) =>
        body.visible && body.colliders.length > 0 && !selected.has(body.id)
    )
    .map((body) => body.id)
  const staleAcknowledgements = [...acknowledged].filter(
    (id) => !visibleExcluded.includes(id)
  )
  if (staleAcknowledgements.length)
    blockers.push(
      issue(
        'invalid-acknowledgement',
        'Background acknowledgements must reference currently visible excluded bodies.',
        staleAcknowledgements
      )
    )
  const unacknowledged = visibleExcluded.filter((id) => !acknowledged.has(id))
  if (unacknowledged.length)
    assumptions.push(
      issue(
        'visible-background-unacknowledged',
        'Visible modeled bodies outside the selected scope require explicit acknowledgement.',
        unacknowledged
      )
    )

  const segmentCount = Math.max(1, definition.trajectory.keyframes.length - 1),
    workUnits = pairs.length * segmentCount
  if (method && workUnits > (method.warningWorkUnits ?? 500))
    resourceWarnings.push(
      issue(
        'large-workload',
        'This scope may consume substantial local resources; no reliable time estimate is available yet.'
      )
    )

  return {
    blockers,
    assumptions,
    resourceWarnings,
    pairs,
    estimate: {
      pairCount: pairs.length,
      segmentCount,
      workUnits,
      reliableTimeEstimate: false
    }
  }
}
