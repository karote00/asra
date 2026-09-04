import { expect, it } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import { validateExperimentDefinition } from '../contracts'
import {
  createExperimentSnapshot,
  validateHistoricalSnapshot
} from '../snapshot'
import { OFFICIAL_CLEARANCE_METHOD } from '../methods/official-method'

const predicate = { kind: 'clearance', operator: 'above', value: 0.01 }
function definition(acceptance?: unknown) {
  const draft = createSyntheticExperimentDraft(createSyntheticExample())
  return {
    ...draft,
    revision: 1,
    rule: {
      ...draft.rule,
      revision: 1,
      ...(acceptance === undefined ? {} : { acceptance })
    }
  }
}

it('admits and freezes typed acceptance trees without adding them to legacy snapshots', () => {
  const input = definition({
    kind: 'all',
    conditions: [
      predicate,
      {
        kind: 'any',
        conditions: [
          { kind: 'penetration', expected: 'absent' },
          { kind: 'clearance', operator: 'below', value: 20 }
        ]
      }
    ]
  })
  expect(() => validateExperimentDefinition(input)).not.toThrow()
  validateExperimentDefinition(input)
  const snapshot = createExperimentSnapshot({
    snapshotId: 'rules',
    candidateId: 'candidate',
    experimentId: 'study',
    workcell: createSyntheticExample().workcell,
    definition: input,
    methods: [OFFICIAL_CLEARANCE_METHOD],
    acknowledgedWarningCodes: []
  })
  expect(snapshot.rule.acceptance).toEqual(input.rule.acceptance)
  expect(Object.isFrozen(snapshot.rule.acceptance)).toBe(true)
  expect(snapshot.rule.acceptance).not.toBe(input.rule.acceptance)
  expect(validateHistoricalSnapshot(snapshot)).toEqual(snapshot)
  const legacy = definition()
  validateExperimentDefinition(legacy)
  expect(legacy.rule).not.toHaveProperty('acceptance')
})

it('rejects unsupported, malformed, oversized and cyclic rule expressions', () => {
  let tooDeep: unknown = predicate
  for (let i = 0; i < 4; i++)
    tooDeep = { kind: 'all', conditions: [predicate, tooDeep] }
  const cycle: { kind: string; conditions: unknown[] } = {
    kind: 'all',
    conditions: [predicate]
  }
  cycle.conditions.push(cycle)
  const tooMany = {
    kind: 'all',
    conditions: Array.from({ length: 8 }, () => ({
      kind: 'any',
      conditions: Array.from({ length: 4 }, () => predicate)
    }))
  }
  for (const invalid of [
    null,
    false,
    'return true',
    {},
    { ...predicate, code: 'true' },
    { ...predicate, operator: '>=' },
    { ...predicate, value: NaN },
    { ...predicate, value: Infinity },
    { ...predicate, value: -1 },
    { ...predicate, value: 20.01 },
    { ...predicate, kind: 'force' },
    { kind: 'penetration', expected: 'not-detected' },
    { kind: 'all', conditions: [] },
    { kind: 'any', conditions: [predicate] },
    { kind: 'all', conditions: Array.from({ length: 9 }, () => predicate) },
    tooDeep,
    tooMany,
    cycle
  ])
    expect(() => validateExperimentDefinition(definition(invalid))).toThrow()
})

it('accepts exactly 31 nodes at four levels and preserves strict zero thresholds', () => {
  const leaf = { ...predicate, value: 0 }
  const level3 = {
    kind: 'any',
    conditions: Array.from({ length: 4 }, () => leaf)
  }
  const level2 = {
    kind: 'all',
    conditions: Array.from({ length: 3 }, () => level3)
  }
  const tree = { kind: 'all', conditions: [level2, level2] }
  // 1 + 2 * (1 + 3 * (1 + 4)) = 33: reduce two leaves to reach the exact limit.
  const exact = JSON.parse(JSON.stringify(tree)) as typeof tree
  exact.conditions[0].conditions[0].conditions.splice(0, 2)
  expect(JSON.stringify(exact).match(/"kind"/g)).toHaveLength(31)
  expect(() => validateExperimentDefinition(definition(exact))).not.toThrow()
  expect(() => validateExperimentDefinition(definition(tree))).toThrow()
})
