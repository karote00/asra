import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropsManager } from '@asyra/props-manager'
import {
  PropertyTypes,
  type ElementInstanceTypes,
  type PropertyComponentInstanceTypes
} from '@asyra/utils'
import { SceneTree } from '../sceneTree'
import Element from '../components/element'
import componentRegistry from '../component-registry'

const TARGET_ELEMENT_TYPE = 'scene-target-resolution-element'

class TargetResolutionElement extends Element {
  static readonly ordinaryPropertyDefinitions = Object.freeze([
    Object.freeze({
      name: PropertyTypes.POSITION,
      type: PropertyTypes.POSITION,
      alias: ['x', 'y']
    }),
    Object.freeze({
      name: PropertyTypes.DIMENSION,
      type: PropertyTypes.DIMENSION,
      alias: ['width', 'height']
    })
  ])

  _init(): void {
    super._init()
    this.data.type = TARGET_ELEMENT_TYPE
  }
}

const createProperty = (
  id: string,
  type: string
): PropertyComponentInstanceTypes =>
  ({
    get: vi.fn((key: string) => {
      if (key === 'id') return id
      if (key === 'type') return type
      return undefined
    })
  }) as unknown as PropertyComponentInstanceTypes

const createElement = (
  id: string,
  propertyIds: Readonly<Record<string, string>>
): ElementInstanceTypes =>
  ({
    props: {
      getPropId: vi.fn((name: string) => propertyIds[name])
    },
    get: vi.fn((key: string) => {
      if (key === 'id') return id
      if (key === 'type') return TARGET_ELEMENT_TYPE
      return undefined
    })
  }) as unknown as ElementInstanceTypes

describe('SceneTree element-property target resolution', () => {
  let sceneTree: SceneTree
  let propsManagerOwner: PropsManager
  let properties: Map<string, PropertyComponentInstanceTypes>

  beforeEach(() => {
    componentRegistry.unregister(TARGET_ELEMENT_TYPE)
    componentRegistry.register({
      type: TARGET_ELEMENT_TYPE,
      idPrefix: TARGET_ELEMENT_TYPE,
      namePrefix: 'Target Resolution Element',
      constructor: TargetResolutionElement,
      properties: [...TargetResolutionElement.ordinaryPropertyDefinitions],
      defaults: {}
    })

    properties = new Map([
      ['position-1', createProperty('position-1', PropertyTypes.POSITION)],
      ['dimension-1', createProperty('dimension-1', PropertyTypes.DIMENSION)]
    ])
    propsManagerOwner = {
      changes: [],
      getPropertyById: vi.fn((id: string) => properties.get(id))
    } as unknown as PropsManager
    sceneTree = new SceneTree(propsManagerOwner)
    sceneTree._elements.set(
      'element-1',
      createElement('element-1', {
        [PropertyTypes.POSITION]: 'position-1',
        [PropertyTypes.DIMENSION]: 'dimension-1'
      })
    )
    sceneTree._elements.set(
      'element-2',
      createElement('element-2', {
        [PropertyTypes.POSITION]: 'position-1',
        [PropertyTypes.DIMENSION]: 'dimension-1'
      })
    )
  })

  it('resolves aliases to exact property ids and owner relations without mutation', () => {
    const values = { x: 12, y: 24, width: 160, height: 90 }
    const elementBefore = sceneTree.getElementById('element-1')
    const changesBefore = [...propsManagerOwner.changes]

    const resolvedTargets = sceneTree.resolveElementPropertyTargets([
      {
        kind: 'values',
        elementId: 'element-1',
        values
      }
    ])
    values.x = 999

    expect(resolvedTargets).toEqual({
      kind: 'resolved-element-property-targets',
      orderedElementIds: ['element-1'],
      relations: [
        {
          ownerElementId: 'element-1',
          ownerElementType: TARGET_ELEMENT_TYPE,
          ownerPropertyName: PropertyTypes.POSITION,
          componentId: 'position-1'
        },
        {
          ownerElementId: 'element-1',
          ownerElementType: TARGET_ELEMENT_TYPE,
          ownerPropertyName: PropertyTypes.DIMENSION,
          componentId: 'dimension-1'
        }
      ],
      mutations: [
        {
          kind: 'values',
          propertyId: 'position-1',
          values: { x: 12, y: 24 }
        },
        {
          kind: 'values',
          propertyId: 'dimension-1',
          values: { width: 160, height: 90 }
        }
      ]
    })
    expect(Object.isFrozen(resolvedTargets)).toBe(true)
    expect(Object.isFrozen(resolvedTargets.mutations)).toBe(true)
    expect(sceneTree.getElementById('element-1')).toBe(elementBefore)
    expect(propsManagerOwner.changes).toEqual(changesBefore)
    expect(sceneTree.changes).toEqual([])
  })

  it('resolves record patches without asking Scene to validate property values', () => {
    const resolvedTargets = sceneTree.resolveElementPropertyTargets([
      {
        kind: 'records',
        elementId: 'element-1',
        values: { width: 160 },
        records: [
          {
            key: PropertyTypes.DIMENSION,
            set: {
              variant: {
                arbitraryPayload: true
              }
            },
            remove: ['obsolete']
          }
        ]
      }
    ])

    expect(resolvedTargets.mutations).toEqual([
      {
        kind: 'records',
        propertyId: 'dimension-1',
        key: PropertyTypes.DIMENSION,
        values: { width: 160 },
        set: {
          variant: {
            arbitraryPayload: true
          }
        },
        remove: ['obsolete']
      }
    ])
    expect(resolvedTargets.relations).toEqual([
      {
        ownerElementId: 'element-1',
        ownerElementType: TARGET_ELEMENT_TYPE,
        ownerPropertyName: PropertyTypes.DIMENSION,
        componentId: 'dimension-1'
      }
    ])
  })

  it('aggregates equivalent and disjoint shared field writes once by property id', () => {
    const resolvedTargets = sceneTree.resolveElementPropertyTargets([
      {
        kind: 'values',
        elementId: 'element-1',
        values: { x: 12, y: 24 }
      },
      {
        kind: 'values',
        elementId: 'element-2',
        values: { x: 12, width: 160 }
      }
    ])

    expect(resolvedTargets.orderedElementIds).toEqual([
      'element-1',
      'element-2'
    ])
    expect(resolvedTargets.relations).toEqual([
      {
        ownerElementId: 'element-1',
        ownerElementType: TARGET_ELEMENT_TYPE,
        ownerPropertyName: PropertyTypes.POSITION,
        componentId: 'position-1'
      },
      {
        ownerElementId: 'element-2',
        ownerElementType: TARGET_ELEMENT_TYPE,
        ownerPropertyName: PropertyTypes.POSITION,
        componentId: 'position-1'
      },
      {
        ownerElementId: 'element-2',
        ownerElementType: TARGET_ELEMENT_TYPE,
        ownerPropertyName: PropertyTypes.DIMENSION,
        componentId: 'dimension-1'
      }
    ])
    expect(resolvedTargets.mutations).toEqual([
      {
        kind: 'values',
        propertyId: 'position-1',
        values: { x: 12, y: 24 }
      },
      {
        kind: 'values',
        propertyId: 'dimension-1',
        values: { width: 160 }
      }
    ])
  })

  it('rejects conflicting shared field writes before returning a resolved targets', () => {
    expect(() =>
      sceneTree.resolveElementPropertyTargets([
        {
          kind: 'values',
          elementId: 'element-1',
          values: { x: 12 }
        },
        {
          kind: 'values',
          elementId: 'element-2',
          values: { x: 24 }
        }
      ])
    ).toThrow(/conflicting.*position-1.*x/i)

    expect(propsManagerOwner.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
  })

  it('merges equivalent and disjoint shared record operations once', () => {
    const resolvedTargets = sceneTree.resolveElementPropertyTargets([
      {
        kind: 'records',
        elementId: 'element-1',
        values: { width: 160 },
        records: [
          {
            key: PropertyTypes.DIMENSION,
            set: {
              shared: { value: 1 },
              first: { value: 2 }
            },
            remove: ['obsolete']
          }
        ]
      },
      {
        kind: 'records',
        elementId: 'element-2',
        values: { width: 160, height: 90 },
        records: [
          {
            key: PropertyTypes.DIMENSION,
            set: {
              shared: { value: 1 },
              second: { value: 3 }
            },
            remove: ['obsolete', 'later-obsolete']
          }
        ]
      }
    ])

    expect(resolvedTargets.mutations).toEqual([
      {
        kind: 'records',
        propertyId: 'dimension-1',
        key: PropertyTypes.DIMENSION,
        values: { width: 160, height: 90 },
        set: {
          shared: { value: 1 },
          first: { value: 2 },
          second: { value: 3 }
        },
        remove: ['obsolete', 'later-obsolete']
      }
    ])
  })

  it.each([
    {
      label: 'different payloads for one record',
      second: {
        set: { shared: { value: 2 } }
      }
    },
    {
      label: 'setting and removing one record',
      second: {
        remove: ['shared']
      }
    }
  ])('rejects conflicting shared records: $label', ({ second }) => {
    expect(() =>
      sceneTree.resolveElementPropertyTargets([
        {
          kind: 'records',
          elementId: 'element-1',
          records: [
            {
              key: PropertyTypes.DIMENSION,
              set: { shared: { value: 1 } }
            }
          ]
        },
        {
          kind: 'records',
          elementId: 'element-2',
          records: [
            {
              key: PropertyTypes.DIMENSION,
              ...second
            }
          ]
        }
      ])
    ).toThrow(/conflicting.*dimension-1.*shared/i)
  })

  it('rejects a direct value replacement that conflicts with a record patch', () => {
    expect(() =>
      sceneTree.resolveElementPropertyTargets([
        {
          kind: 'values',
          elementId: 'element-1',
          values: {
            [PropertyTypes.DIMENSION]: ['replacement-child']
          }
        },
        {
          kind: 'records',
          elementId: 'element-2',
          records: [
            {
              key: PropertyTypes.DIMENSION,
              set: {
                patched: { value: 1 }
              }
            }
          ]
        }
      ])
    ).toThrow(/conflicting.*dimension-1.*dimension/i)
  })

  it('rejects a later invalid target without returning a partial resolution or mutation prefix', () => {
    const propsChangesBefore = [...propsManagerOwner.changes]

    expect(() =>
      sceneTree.resolveElementPropertyTargets([
        {
          kind: 'values',
          elementId: 'element-1',
          values: { x: 12 }
        },
        {
          kind: 'values',
          elementId: 'missing-element',
          values: { width: 160 }
        }
      ])
    ).toThrow(/missing-element/i)

    expect(propsManagerOwner.changes).toEqual(propsChangesBefore)
    expect(sceneTree.changes).toEqual([])
    expect(sceneTree.getElementById('element-1')).toBeDefined()
  })

  it('returns one immutable empty resolved targets for an empty request', () => {
    const resolvedTargets = sceneTree.resolveElementPropertyTargets([])

    expect(resolvedTargets).toEqual({
      kind: 'resolved-element-property-targets',
      orderedElementIds: [],
      relations: [],
      mutations: []
    })
    expect(Object.isFrozen(resolvedTargets)).toBe(true)
    expect(Object.isFrozen(resolvedTargets.orderedElementIds)).toBe(true)
    expect(Object.isFrozen(resolvedTargets.relations)).toBe(true)
    expect(Object.isFrozen(resolvedTargets.mutations)).toBe(true)
  })
})
