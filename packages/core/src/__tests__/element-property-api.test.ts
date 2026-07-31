import { describe, expect, it, vi } from 'vitest'
import type {
  PreparedPropertyMutationBatch,
  PropertyMutationBatchResult
} from '@asyra/props-manager'
import type {
  ResolvedElementPropertyTargets,
  ElementPropertyTargetRequest
} from '@asyra/scene-tree'
import { createElementPropertyAPIs } from '../apis/element-properties'

const emptyPreparedProps: PreparedPropertyMutationBatch = Object.freeze({
  kind: 'prepared-property-mutation-batch',
  owners: Object.freeze([]),
  ownerRelations: Object.freeze([]),
  orderedPropertyIds: Object.freeze([])
})

const emptyPropsResult: PropertyMutationBatchResult = Object.freeze({
  owners: Object.freeze([]),
  ownerRelations: Object.freeze([]),
  orderedPropertyIds: Object.freeze([]),
  evidence: Object.freeze([])
})

describe('Core canonical element property APIs', () => {
  it('coordinates one complete target and Props prepared before applying replacements', () => {
    const sequence: string[] = []
    const resolvedTargets: ResolvedElementPropertyTargets = Object.freeze({
      kind: 'resolved-element-property-targets',
      orderedElementIds: Object.freeze(['element-a', 'element-b']),
      relations: Object.freeze([]),
      mutations: Object.freeze([
        Object.freeze({
          kind: 'values',
          propertyId: 'position-a',
          values: Object.freeze({ x: 10 }),
          owner: Object.freeze({
            ownerElementId: 'element-a',
            ownerPropertyName: 'position'
          })
        }),
        Object.freeze({
          kind: 'values',
          propertyId: 'position-b',
          values: Object.freeze({ x: 20 }),
          owner: Object.freeze({
            ownerElementId: 'element-b',
            ownerPropertyName: 'position'
          })
        })
      ])
    })
    const resolveElementPropertyTargets = vi.fn(
      (_requests: readonly ElementPropertyTargetRequest[]) => {
        sequence.push('target')
        return resolvedTargets
      }
    )
    const preparePropertyMutationBatch = vi.fn(() => {
      sequence.push('props-preflight')
      return emptyPreparedProps
    })
    const applyPreparedPropertyMutationBatch = vi.fn(() => {
      sequence.push('props-apply')
      return emptyPropsResult
    })
    const apis = createElementPropertyAPIs({
      resolveElementPropertyTargets,
      preparePropertyMutationBatch,
      applyPreparedPropertyMutationBatch
    })

    const result = apis.updateElementProperties(
      [
        { elementId: 'element-a', values: { x: 10 } },
        { elementId: 'element-b', values: { x: 20 } }
      ],
      { shared: 'props' }
    )

    expect(sequence).toEqual(['target', 'props-preflight', 'props-apply'])
    expect(resolveElementPropertyTargets).toHaveBeenCalledWith([
      { kind: 'values', elementId: 'element-a', values: { x: 10 } },
      { kind: 'values', elementId: 'element-b', values: { x: 20 } }
    ])
    expect(preparePropertyMutationBatch).toHaveBeenCalledWith({
      operations: resolvedTargets.mutations,
      options: {
        shared: 'props'
      }
    })
    expect(applyPreparedPropertyMutationBatch).toHaveBeenCalledWith(
      emptyPreparedProps
    )
    expect(result).toEqual(['element-a', 'element-b'])
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('keeps value replacement and ordered record patch missions disjoint', () => {
    const resolveElementPropertyTargets = vi.fn(
      (requests: readonly ElementPropertyTargetRequest[]) =>
        Object.freeze({
          kind: 'resolved-element-property-targets' as const,
          orderedElementIds: Object.freeze(
            requests.map(({ elementId }) => elementId)
          ),
          relations: Object.freeze([]),
          mutations: Object.freeze([])
        })
    )
    const preparePropertyMutationBatch = vi.fn(() => emptyPreparedProps)
    const applyPreparedPropertyMutationBatch = vi.fn(() => emptyPropsResult)
    const apis = createElementPropertyAPIs({
      resolveElementPropertyTargets,
      preparePropertyMutationBatch,
      applyPreparedPropertyMutationBatch
    })

    apis.updateElementProperties([
      { elementId: 'vector-a', values: { closed: true } }
    ])
    apis.patchElementProperties([
      {
        elementId: 'vector-a',
        values: { fillRule: 'evenodd' },
        records: [
          {
            key: 'points',
            set: {
              p2: { x: 20, y: 10 },
              p1: { x: 10, y: 10 }
            },
            remove: ['p0']
          }
        ]
      }
    ])

    expect(resolveElementPropertyTargets).toHaveBeenNthCalledWith(1, [
      {
        kind: 'values',
        elementId: 'vector-a',
        values: { closed: true }
      }
    ])
    expect(resolveElementPropertyTargets).toHaveBeenNthCalledWith(2, [
      {
        kind: 'records',
        elementId: 'vector-a',
        values: { fillRule: 'evenodd' },
        records: [
          {
            key: 'points',
            set: {
              p2: { x: 20, y: 10 },
              p1: { x: 10, y: 10 }
            },
            remove: ['p0']
          }
        ]
      }
    ])
  })

  it('keeps empty element property requests inert', () => {
    const requests = {
      resolveElementPropertyTargets: vi.fn(),
      preparePropertyMutationBatch: vi.fn(),
      applyPreparedPropertyMutationBatch: vi.fn()
    }
    const apis = createElementPropertyAPIs(requests)

    expect(apis.updateElementProperties([])).toEqual([])
    expect(apis.patchElementProperties([])).toEqual([])
    expect(requests.resolveElementPropertyTargets).not.toHaveBeenCalled()
    expect(requests.preparePropertyMutationBatch).not.toHaveBeenCalled()
    expect(requests.applyPreparedPropertyMutationBatch).not.toHaveBeenCalled()
  })
})
