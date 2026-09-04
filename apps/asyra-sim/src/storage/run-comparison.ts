import { stableJson, validateRunRecord, type RunRecord } from './run-record'

export interface RunDifference {
  path: string
  values: readonly unknown[]
}
export interface RunComparison {
  runs: readonly RunRecord[]
  directlyComparable: boolean
  incompatibilities: readonly string[]
  differences: readonly RunDifference[]
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const lexical = (a: string, b: string) => {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/** Correspondence changes identity labels only, never modeled quantities. */
function comparableInputs(run: RunRecord) {
  const { snapshot } = run
  const id = (bodyId: string) => {
    const origin = run.lineage?.bodyOrigins[bodyId] ?? {
      candidateId: snapshot.source.candidateId,
      bodyId
    }
    return JSON.stringify([origin.candidateId, origin.bodyId])
  }
  const remapRecord = <T>(value: Readonly<Record<string, T>>) =>
    Object.fromEntries(
      Object.entries(value).map(([key, item]) => [id(key), item])
    )
  return {
    workcell: {
      ...snapshot.workcell,
      robotRootId:
        snapshot.workcell.robotRootId === null
          ? null
          : id(snapshot.workcell.robotRootId),
      bodies: snapshot.workcell.bodies
        .map((body) => ({
          ...body,
          id: id(body.id),
          parentId: body.parentId === null ? null : id(body.parentId)
        }))
        .sort((a, b) => lexical(a.id, b.id))
    },
    trajectory: {
      ...snapshot.trajectory,
      keyframes: snapshot.trajectory.keyframes.map((frame) => ({
        ...frame,
        joints: remapRecord(frame.joints)
      }))
    },
    sourceUnits: {
      ...snapshot.sourceUnits,
      joints: remapRecord(snapshot.sourceUnits.joints)
    },
    interval: snapshot.interval,
    scope: {
      ...snapshot.scope,
      primaryBodyIds: snapshot.scope.primaryBodyIds.map(id).sort(),
      influencingBodyIds: snapshot.scope.influencingBodyIds.map(id).sort(),
      acknowledgedExcludedVisibleBodyIds:
        snapshot.scope.acknowledgedExcludedVisibleBodyIds.map(id).sort(),
      excludedPairs: snapshot.scope.excludedPairs
        .map((pair) => {
          const [a, b] = [id(pair.a), id(pair.b)].sort()
          return { ...pair, a, b }
        })
        .sort((a, b) => lexical(stableJson(a), stableJson(b)))
    },
    method: snapshot.method,
    methodDescriptor: snapshot.methodDescriptor ?? null,
    rule: snapshot.rule,
    budget: snapshot.budget,
    acknowledgedWarnings: snapshot.acknowledgedWarnings
  }
}

export function compareRuns(input: readonly RunRecord[]): RunComparison {
  if (input.length < 2 || input.length > 3)
    throw new Error('Select two or three runs for comparison')
  const runs = input.map(validateRunRecord)
  const inputs = runs.map(comparableInputs)
  if (new Set(runs.map((run) => run.result.runId)).size !== runs.length)
    throw new Error('Select distinct runs')
  const differs = (values: readonly unknown[]) =>
    new Set(values.map(stableJson)).size > 1
  const incompatibilities: string[] = []
  for (const [label, values] of [
    [
      'Methods or numerical settings differ',
      inputs.map((input) => input.method)
    ],
    [
      'Retained method declarations differ',
      inputs.map((input) => input.methodDescriptor)
    ],
    [
      'Analysis scopes or exclusions differ',
      inputs.map((input) => input.scope)
    ],
    [
      'Decision rules differ',
      inputs.map((input) => {
        const { revision: _revision, ...conditions } = input.rule
        return conditions
      })
    ],
    ['Analysis intervals differ', inputs.map((input) => input.interval)],
    ['Source units differ', inputs.map((input) => input.sourceUnits)]
  ] as const)
    if (differs(values)) incompatibilities.push(label)
  const differences: RunDifference[] = []
  const walk = (path: string, values: readonly unknown[]) => {
    if (!differs(values)) return
    if (values.every(record)) {
      const keys = [
        ...new Set(values.flatMap((value) => Object.keys(value)))
      ].sort()
      for (const key of keys)
        walk(
          path ? `${path}.${key}` : key,
          values.map((value) => value[key])
        )
    } else differences.push({ path, values })
  }
  walk('', inputs)
  return {
    runs,
    directlyComparable: !incompatibilities.length,
    incompatibilities,
    differences
  }
}
