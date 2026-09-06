import { describe, expect, it } from 'vitest'
import { IDENTITY_POSE } from '../../../domain/math'
import type { Body, Workcell } from '../../../domain/workcell'
import {
  canonicalCsvMapping,
  createDefaultExperimentDraft,
  definitionToDraft,
  formatExclusions,
  guessCsvMapping,
  parseExclusions,
  trajectoryToCsv
} from '../experiment-draft'

const body = (id: string, parentId: string | null): Body => ({
  id,
  parentId,
  name: id,
  role: 'fixture',
  pose: IDENTITY_POSE,
  joint: { kind: 'fixed', axis: [0, 1, 0], value: 0, min: 0, max: 0 },
  colliders: [
    {
      id: 'shape',
      pose: IDENTITY_POSE,
      geometry: { kind: 'box', size: [1, 1, 1] }
    }
  ],
  visible: true,
  color: 0
})

const workcell: Workcell = {
  version: 1,
  robotRootId: 'base',
  bodies: [
    { ...body('base', null), role: 'robot' },
    {
      ...body('joint', 'base'),
      role: 'link',
      joint: {
        kind: 'revolute',
        axis: [0, 0, 1],
        value: 0.5,
        min: -2,
        max: 2
      }
    },
    body('fixture', null)
  ]
}

describe('experiment UI draft helpers', () => {
  it('creates a static explicit draft from a current workcell', () => {
    const draft = createDefaultExperimentDraft(workcell)

    expect(draft.budget).toEqual({ maxIntervals: 100000, maxDurationMs: 30000 })

    expect(draft.trajectory.keyframes).toEqual([
      { time: 0, joints: { joint: 0.5 } }
    ])

    expect(draft.sourceUnits).toEqual({
      time: 's',
      joints: { joint: 'rad' }
    })

    expect(draft.scope.primaryBodyIds).toEqual(['base', 'joint'])

    expect(draft.scope.influencingBodyIds).toEqual(['fixture'])
  })

  it('removes owner revisions without mutating a canonical definition', () => {
    const draft = createDefaultExperimentDraft(workcell)

    const definition = {
      ...draft,
      revision: 4,
      rule: { ...draft.rule, revision: 3 }
    }

    const copy = definitionToDraft(definition)

    copy.rule.minimumClearance = 0.2

    expect(definition.rule.minimumClearance).toBe(0.02)

    expect(copy).not.toHaveProperty('revision')

    expect(copy.rule).not.toHaveProperty('revision')
  })

  it('roundtrips tab-separated versioned exclusion reasons', () => {
    const pairs = [
      {
        version: 1 as const,
        a: 'base',
        b: 'joint',
        reason: 'Mounted interface, explicitly excluded.'
      }
    ]

    expect(parseExclusions(formatExclusions(pairs))).toEqual(pairs)

    expect(() => parseExclusions('base\tjoint')).toThrow('line 1')

    expect(() => parseExclusions('base\tbase\tnot a pair')).toThrow('line 1')
  })

  it('serializes canonical trajectory columns and builds explicit mappings', () => {
    const draft = createDefaultExperimentDraft(workcell)

    expect(trajectoryToCsv(workcell, draft.trajectory)).toBe(
      'time,joint\n0,0.5'
    )

    expect(canonicalCsvMapping(workcell)).toEqual({
      time: { column: 'time', unit: 's' },
      joints: { joint: { column: 'joint', unit: 'rad' } }
    })

    expect(guessCsvMapping(['clock', 'axis'], workcell)).toEqual({
      time: { column: 'clock', unit: 's' },
      joints: { joint: { column: 'axis', unit: 'rad' } }
    })
  })
})
