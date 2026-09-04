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

export function compareRuns(input: readonly RunRecord[]): RunComparison {
  if (input.length < 2 || input.length > 3)
    throw new Error('Select two or three runs for comparison')
  const runs = input.map(validateRunRecord)
  if (new Set(runs.map((run) => run.result.runId)).size !== runs.length)
    throw new Error('Select distinct runs')
  const differs = (values: readonly unknown[]) =>
    new Set(values.map(stableJson)).size > 1
  const incompatibilities: string[] = []
  for (const [label, values] of [
    [
      'Methods or numerical settings differ',
      runs.map((run) => run.snapshot.method)
    ],
    [
      'Analysis scopes or exclusions differ',
      runs.map((run) => run.snapshot.scope)
    ],
    [
      'Decision rules differ',
      runs.map((run) => run.snapshot.rule.minimumClearance)
    ],
    ['Analysis intervals differ', runs.map((run) => run.snapshot.interval)]
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
  walk(
    '',
    runs.map(({ snapshot }) => ({
      workcell: snapshot.workcell,
      trajectory: snapshot.trajectory,
      sourceUnits: snapshot.sourceUnits,
      interval: snapshot.interval,
      scope: snapshot.scope,
      method: snapshot.method,
      rule: snapshot.rule,
      budget: snapshot.budget,
      acknowledgedWarnings: snapshot.acknowledgedWarnings
    }))
  )
  return {
    runs,
    directlyComparable: !incompatibilities.length,
    incompatibilities,
    differences
  }
}
