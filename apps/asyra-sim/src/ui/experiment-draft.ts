import type {
  ExcludedBodyPair,
  ExperimentDefinition
} from '../analysis/contracts'
import type { ExperimentDraft } from '../common-apis/experiment'
import { MethodIds, MethodVersions } from '../constants'
import type { Trajectory } from '../domain/workcell'
import { validIdentifier, type Workcell } from '../domain/workcell'
import type { TrajectoryCsvMapping } from '../storage/trajectory-import'

export function definitionToDraft(
  definition: ExperimentDefinition
): ExperimentDraft {
  const copy = structuredClone(definition)
  const { revision: _revision, rule, ...draft } = copy
  const { revision: _ruleRevision, ...draftRule } = rule
  return { ...draft, rule: draftRule }
}

export function createDefaultExperimentDraft(
  workcell: Workcell
): ExperimentDraft {
  const actuated = workcell.bodies.filter(
      (body) => body.joint.kind !== 'fixed'
    ),
    primaryBodyIds = workcell.bodies
      .filter((body) => body.role !== 'fixture')
      .map((body) => body.id),
    influencingBodyIds = workcell.bodies
      .filter((body) => body.role === 'fixture')
      .map((body) => body.id)
  return {
    version: 1,
    trajectory: {
      version: 1,
      keyframes: [
        {
          time: 0,
          joints: Object.fromEntries(
            actuated.map((body) => [body.id, body.joint.value])
          )
        }
      ]
    },
    sourceUnits: {
      time: 's',
      joints: Object.fromEntries(
        actuated.map((body) => [
          body.id,
          body.joint.kind === 'revolute' ? ('rad' as const) : ('m' as const)
        ])
      )
    },
    scope: {
      primaryBodyIds,
      influencingBodyIds,
      selfCollision: primaryBodyIds.length > 1,
      externalCollision:
        primaryBodyIds.length > 0 && influencingBodyIds.length > 0,
      excludedPairs: [],
      acknowledgedExcludedVisibleBodyIds: [],
      backgroundNote:
        'Only the selected primary and influencing modeled bodies are in scope.'
    },
    interval: [0, 0],
    method: {
      id: MethodIds.CONTINUOUS_CLEARANCE,
      version: MethodVersions.CONTINUOUS_CLEARANCE,
      settings: {
        distanceTolerance: 0.000001,
        timeTolerance: 0.0001,
        maxIterations: 64
      }
    },
    rule: { version: 1, minimumClearance: 0.02 },
    budget: { maxIntervals: 2000, maxDurationMs: 15000 }
  }
}

export function formatExclusions(
  exclusions: readonly ExcludedBodyPair[]
): string {
  return exclusions
    .map((pair) => `${pair.a}\t${pair.b}\t${pair.reason.replaceAll('\t', ' ')}`)
    .join('\n')
}

export function parseExclusions(text: string): ExcludedBodyPair[] {
  if (!text.trim()) return []
  return text.split(/\r?\n/).map((line, index) => {
    const [a, b, ...reasonParts] = line.split('\t'),
      reason = reasonParts.join(' ').trim()
    if (
      !validIdentifier(a) ||
      !validIdentifier(b) ||
      a === b ||
      !reason ||
      reason.length > 500
    )
      throw new Error(
        `Invalid exclusion on line ${index + 1}; use body-a<TAB>body-b<TAB>reason.`
      )
    return { version: 1, a, b, reason }
  })
}

export function trajectoryToCsv(
  workcell: Workcell,
  trajectory: Trajectory
): string {
  const ids = workcell.bodies
    .filter((body) => body.joint.kind !== 'fixed')
    .map((body) => body.id)
  return [
    ['time', ...ids].join(','),
    ...trajectory.keyframes.map((frame) =>
      [frame.time, ...ids.map((id) => frame.joints[id])].join(',')
    )
  ].join('\n')
}

export function canonicalCsvMapping(workcell: Workcell): TrajectoryCsvMapping {
  return {
    time: { column: 'time', unit: 's' },
    joints: Object.fromEntries(
      workcell.bodies
        .filter((body) => body.joint.kind !== 'fixed')
        .map((body) => [
          body.id,
          {
            column: body.id,
            unit: body.joint.kind === 'revolute' ? 'rad' : 'm'
          }
        ])
    )
  }
}

export function guessCsvMapping(
  columns: readonly string[],
  workcell: Workcell
): TrajectoryCsvMapping {
  const unused = new Set(columns),
    lower = (value: string) => value.toLocaleLowerCase(),
    take = (preferred: (column: string) => boolean): string => {
      const match = [...unused].find(preferred) ?? [...unused][0] ?? ''
      unused.delete(match)
      return match
    },
    timeColumn = take((column) =>
      ['time', 'clock', 'timestamp'].some((word) =>
        lower(column).includes(word)
      )
    ),
    joints: Record<string, TrajectoryCsvMapping['joints'][string]> = {}
  for (const body of workcell.bodies) {
    if (body.joint.kind === 'fixed') continue
    joints[body.id] = {
      column: take(
        (column) =>
          lower(column) === lower(body.id) ||
          lower(column).includes(lower(body.id))
      ),
      unit: body.joint.kind === 'revolute' ? 'rad' : 'm'
    }
  }
  return { time: { column: timeColumn, unit: 's' }, joints }
}
