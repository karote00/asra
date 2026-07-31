import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  componentRegistry,
  type PreparedCanonicalElementInsertion,
  type CanonicalElementRemoval,
  type PreparedCanonicalElementRemoval,
  type PreparedElementDataMutation,
  type PreparedElementInsertion,
  type PreparedSubtreeRemoval
} from '@asyra/scene-tree'
import type {
  PropertyMutation,
  PreparedPropertyMutationBatch,
  PropertyMutationBatchResult
} from '@asyra/props-manager'
import { EventTypes } from '@asyra/reactive-events'
import {
  EntityTypes,
  SCENE_TREE_ACTIONS,
  type HierarchyMove,
  type ElementPropertyRelation,
  type ElementRawData,
  type PropertyComponentRawData,
  type SubtreeChange,
  type UpdateElementDataChange
} from '@asyra/utils'
import { createAPIs } from '../apis/create-apis'

const COMPONENT_TYPE = 'core-owner-coordinate-element'
const PROPERTY_TYPE = 'core-owner-coordinate-property'

const emptyPropertyResult = (
  ownerRelations: readonly ElementPropertyRelation[] = []
): PropertyMutationBatchResult =>
  Object.freeze({
    owners: Object.freeze([]),
    ownerRelations,
    orderedPropertyIds: Object.freeze([]),
    evidence: Object.freeze([])
  })

const preparedProperties = (
  ownerRelations: readonly ElementPropertyRelation[] = [],
  orderedPropertyIds: readonly string[] = []
): PreparedPropertyMutationBatch =>
  Object.freeze({
    kind: 'prepared-property-mutation-batch',
    owners: Object.freeze([]),
    ownerRelations,
    orderedPropertyIds: Object.freeze([...orderedPropertyIds])
  })

const createHarness = () => {
  const sequence: string[] = []
  const parent = {
    get: vi.fn((key: string) => {
      if (key === 'id') return 'workspace-1'
      if (key === 'type') return EntityTypes.WORKSPACE
      if (key === 'children') return []
      return undefined
    })
  }
  const sceneTree = {
    workspace: 'workspace-1',
    getElementById: vi.fn((elementId: string) =>
      elementId === 'workspace-1' ? parent : undefined
    ),
    prepareElementInsertion: vi.fn(() => {
      sequence.push('scene-prepare')
      return Object.freeze({
        kind: 'prepared-element-insertion',
        orderedElementIds: Object.freeze(['ordinary-element']),
        evidence: Object.freeze([])
      }) as PreparedElementInsertion
    }),
    prepareCanonicalElementInsertion: vi.fn(() => {
      sequence.push('scene-prepare')
      return Object.freeze({
        kind: 'prepared-canonical-element-insertion',
        orderedElementIds: Object.freeze(['canonical-element']),
        ownerRelations: Object.freeze([
          Object.freeze({
            ownerElementId: 'canonical-element',
            ownerElementType: COMPONENT_TYPE,
            ownerPropertyName: 'value',
            componentId: 'canonical-property'
          })
        ]),
        evidence: Object.freeze([])
      }) as PreparedCanonicalElementInsertion
    }),
    prepareSubtreeRemoval: vi.fn(() => {
      sequence.push('scene-prepare')
      return Object.freeze({
        kind: 'prepared-subtree-removal',
        orderedElementIds: Object.freeze(['subtree-child', 'subtree-root']),
        relationReleases: Object.freeze([]),
        orphanRootPropertyIds: Object.freeze(['subtree-property']),
        retainedRootPropertyIds: Object.freeze(['retained-property']),
        evidence: Object.freeze([
          Object.freeze({
            eventName: EventTypes.CHANGE_SUBTREE,
            elementId: 'subtree-root',
            removed: Object.freeze([]),
            rootParentChildrenAfter: Object.freeze([]),
            action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
            undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE
          })
        ])
      }) as PreparedSubtreeRemoval
    }),
    prepareCanonicalSubtreeRemoval: vi.fn((change: SubtreeChange) => {
      sequence.push('scene-prepare')
      return Object.freeze({
        kind: 'prepared-subtree-removal',
        orderedElementIds: Object.freeze(
          change.removed.map(({ elementId }) => elementId)
        ),
        relationReleases: Object.freeze([]),
        orphanRootPropertyIds: Object.freeze(['subtree-property']),
        retainedRootPropertyIds: Object.freeze(['retained-property']),
        evidence: Object.freeze([change])
      }) as PreparedSubtreeRemoval
    }),
    prepareCanonicalElementDataMutation: vi.fn(
      (changes: readonly UpdateElementDataChange[]) => {
        sequence.push('scene-prepare')
        return Object.freeze({
          kind: 'prepared-element-data-mutation',
          orderedElementIds: Object.freeze(changes.map(({ id }) => id)),
          evidence: Object.freeze([...changes])
        }) as PreparedElementDataMutation
      }
    ),
    applyHierarchyMoves: vi.fn((moves: readonly HierarchyMove[]) => {
      sequence.push('scene-apply')
      return moves.length > 0
    }),
    preflightRestoreSubtree: vi.fn((snapshot) => {
      sequence.push('scene-prepare')
      return Object.freeze({
        kind: 'prepared-scene-tree-restore',
        elementId: snapshot.elementId,
        entries: Object.freeze([]),
        propertyOwnerRelations: Object.freeze([])
      })
    }),
    applyRestoreSubtree: vi.fn((prepared) => {
      sequence.push('scene-apply')
      return Object.freeze({
        elementId: prepared.elementId,
        removed: Object.freeze([]),
        rootParentChildrenAfter: Object.freeze([])
      })
    }),
    prepareCanonicalElementRemoval: vi.fn(
      (removals: readonly CanonicalElementRemoval[]) => {
        sequence.push('scene-prepare')
        return Object.freeze({
          kind: 'prepared-canonical-element-removal',
          orderedElementIds: Object.freeze(removals.map(({ data }) => data.id)),
          relationReleases: Object.freeze([]),
          orphanRootPropertyIds: Object.freeze(['canonical-property']),
          retainedRootPropertyIds: Object.freeze([]),
          evidence: Object.freeze([])
        }) as PreparedCanonicalElementRemoval
      }
    ),
    applyPreparedElementMutation: vi.fn((prepared) => {
      sequence.push('scene-apply')
      return Object.freeze({
        orderedElementIds: prepared.orderedElementIds,
        evidence: prepared.evidence
      })
    }),
    resolveElementPropertyTargets: vi.fn(),
    save: vi.fn(() => ({
      workspace: 'workspace-1',
      workspaceList: ['workspace-1'],
      elements: {}
    })),
    getAllElements: vi.fn(() => new Map())
  }
  const props = {
    preparePropertyMutationBatch: vi.fn(
      (request: {
        operations: readonly PropertyMutation[]
        options?: unknown
      }) => {
        sequence.push('props-prepare')
        const operation = request.operations[0]
        if (operation?.kind === 'create-owner-properties') {
          return preparedProperties(
            Object.freeze([
              Object.freeze({
                ownerElementId: 'ordinary-element',
                ownerElementType: COMPONENT_TYPE,
                ownerPropertyName: 'value',
                componentId: 'ordinary-property'
              })
            ])
          )
        }
        if (operation?.kind === 'values') {
          return preparedProperties(
            [],
            request.operations.flatMap((mutation) =>
              mutation.kind === 'values' ? [mutation.propertyId] : []
            )
          )
        }
        return preparedProperties()
      }
    ),
    applyPreparedPropertyMutationBatch: vi.fn((prepared) => {
      sequence.push('props-apply')
      return Object.freeze({
        ...emptyPropertyResult(prepared.ownerRelations),
        orderedPropertyIds: prepared.orderedPropertyIds
      })
    }),
    preflightRestoreProperties: vi.fn((_snapshot, ownerRelations) => {
      sequence.push('props-prepare')
      return Object.freeze({
        kind: 'prepared-props-restore',
        entries: Object.freeze([]),
        ownerRelations
      })
    }),
    applyRestoreProperties: vi.fn(() => {
      sequence.push('props-apply')
      return Object.freeze([])
    }),
    save: vi.fn(() => ({})),
    getPropertyById: vi.fn()
  }
  const apis = createAPIs(
    sceneTree as never,
    {
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1
    } as never,
    { get: vi.fn() } as never,
    props as never,
    {
      registerTransactionInverter: vi.fn(),
      registerTransactionReplayHandler: vi.fn()
    } as never
  )
  return { apis, parent, props, sceneTree, sequence }
}

describe('Core canonical owner coordination', () => {
  beforeEach(() => {
    componentRegistry.register({
      type: COMPONENT_TYPE,
      idPrefix: 'core-owner-element',
      namePrefix: 'Core Owner Element',
      constructor: class CoreOwnerCoordinateElement {
        private readonly ownerMarker = true
      } as never,
      properties: [{ name: 'value', type: PROPERTY_TYPE }],
      defaults: {}
    })
  })

  afterEach(() => {
    componentRegistry.unregister(COMPONENT_TYPE)
  })

  it('prepares both ordinary creation owners before applying Props then Scene', () => {
    const { apis, props, sceneTree, sequence } = createHarness()
    const options = { sharedDelivery: 'immediate' as const }

    const result = apis.createElementsInParent(
      [
        {
          id: 'ordinary-element',
          name: 'Ordinary Element',
          type: COMPONENT_TYPE,
          x: 0,
          y: 0,
          value: 42
        }
      ],
      'workspace-1',
      0,
      options
    )

    expect(sequence).toEqual([
      'props-prepare',
      'scene-prepare',
      'props-apply',
      'scene-apply'
    ])
    expect(props.preparePropertyMutationBatch).toHaveBeenCalledWith({
      operations: [
        {
          kind: 'create-owner-properties',
          ownerElementId: 'ordinary-element',
          ownerElementType: COMPONENT_TYPE,
          definitions: [{ name: 'value', type: PROPERTY_TYPE }],
          data: expect.objectContaining({
            id: 'ordinary-element',
            value: 42
          })
        }
      ],
      options
    })
    expect(sceneTree.prepareElementInsertion).toHaveBeenCalledWith({
      parentId: 'workspace-1',
      index: 0,
      elements: [
        {
          id: 'ordinary-element',
          name: 'Ordinary Element',
          type: COMPONENT_TYPE,
          parentId: 'workspace-1',
          visible: true,
          lock: false,
          props: { value: 'ordinary-property' }
        }
      ],
      ownerRelations:
        props.preparePropertyMutationBatch.mock.results[0]?.value.ownerRelations
    })
    expect(result).toEqual(['ordinary-element'])
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('indexes one ordinary owner-relation batch without rescanning it for every element', () => {
    const { apis, props, sceneTree } = createHarness()
    const descriptors = Array.from({ length: 64 }, (_, index) => ({
      id: `ordinary-indexed-element-${index}`,
      name: `Ordinary Indexed Element ${index}`,
      type: COMPONENT_TYPE,
      x: 0,
      y: 0,
      value: index
    }))
    let ownerRelationReads = 0
    const ownerRelations = Object.freeze(
      descriptors.map(({ id }, index) =>
        Object.freeze({
          get ownerElementId() {
            ownerRelationReads += 1
            return id
          },
          ownerElementType: COMPONENT_TYPE,
          ownerPropertyName: 'value',
          componentId: `ordinary-indexed-property-${index}`
        })
      )
    )
    props.preparePropertyMutationBatch.mockReturnValue(
      preparedProperties(ownerRelations)
    )
    sceneTree.prepareElementInsertion.mockImplementation(((request: {
      readonly elements: readonly ElementRawData[]
    }) =>
      Object.freeze({
        kind: 'prepared-element-insertion',
        orderedElementIds: Object.freeze(request.elements.map(({ id }) => id)),
        evidence: Object.freeze([])
      } as PreparedElementInsertion)) as never)

    expect(apis.createElementsInParent(descriptors, 'workspace-1')).toEqual(
      descriptors.map(({ id }) => id)
    )
    expect(ownerRelationReads).toBe(ownerRelations.length)
  })

  it('passes Scene-issued canonical owner relations unchanged into Props', () => {
    const { apis, props, sceneTree, sequence } = createHarness()
    const elements = [
      {
        id: 'canonical-element',
        name: 'Canonical Element',
        type: COMPONENT_TYPE,
        parentId: 'workspace-1',
        visible: true,
        lock: false,
        props: { value: 'canonical-property' }
      }
    ] as unknown as readonly ElementRawData[]
    const properties = [
      {
        id: 'canonical-property',
        type: PROPERTY_TYPE,
        value: 91
      }
    ] as readonly PropertyComponentRawData[]

    expect(
      apis.createElementsInParentFromCanonicalData(
        elements,
        properties,
        'workspace-1',
        0
      )
    ).toEqual(['canonical-element'])

    const preparedSceneMutation =
      sceneTree.prepareCanonicalElementInsertion.mock.results[0]?.value
    if (!preparedSceneMutation) {
      throw new Error('Expected one canonical Scene insertion prepared')
    }
    expect(props.preparePropertyMutationBatch).toHaveBeenCalledWith({
      operations: [
        {
          kind: 'create-exact-property-graph',
          ownerRelations: preparedSceneMutation.ownerRelations,
          components: properties
        }
      ],
      options: undefined
    })
    const propertyOperation =
      props.preparePropertyMutationBatch.mock.calls[0]?.[0].operations[0]
    if (propertyOperation?.kind !== 'create-exact-property-graph') {
      throw new Error('Expected one exact canonical property operation')
    }
    const exactOperation = propertyOperation as Extract<
      PropertyMutation,
      { kind: 'create-exact-property-graph' }
    >
    expect(exactOperation.ownerRelations).toBe(
      preparedSceneMutation.ownerRelations
    )
    expect(sequence).toEqual([
      'scene-prepare',
      'props-prepare',
      'props-apply',
      'scene-apply'
    ])
  })

  it('prepares full subtree orphan cleanup before applying Scene then Props', () => {
    const { apis, props, sequence } = createHarness()
    const options = { rollbackable: false as const }

    const result = apis.removeSubtree('subtree-root', options)

    expect(sequence).toEqual([
      'scene-prepare',
      'props-prepare',
      'scene-apply',
      'props-apply'
    ])
    expect(props.preparePropertyMutationBatch).toHaveBeenCalledWith({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds: ['subtree-property'],
          retainedRootPropertyIds: ['retained-property']
        }
      ],
      options
    })
    expect(result).toEqual({
      elementId: 'subtree-root',
      removed: [],
      rootParentChildrenAfter: []
    })
  })

  it('uses the same full removal owner for detached canonical evidence', () => {
    const { apis, sceneTree, sequence } = createHarness()
    const removals = [
      {
        data: {
          id: 'canonical-element',
          name: 'Canonical Element',
          type: COMPONENT_TYPE,
          parentId: 'workspace-1',
          visible: true,
          lock: false,
          props: { value: 'canonical-property' }
        } as unknown as ElementRawData,
        parentId: 'workspace-1',
        index: 0
      }
    ] satisfies readonly CanonicalElementRemoval[]

    const result = apis.removeElementsFromCanonicalData(removals)

    expect(sequence).toEqual([
      'scene-prepare',
      'props-prepare',
      'scene-apply',
      'props-apply'
    ])
    expect(sceneTree.prepareCanonicalElementRemoval).toHaveBeenCalledWith(
      removals
    )
    expect(result).toEqual(['canonical-element'])
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('coordinates one direct property-component batch through Props once', () => {
    const { apis, props, sequence } = createHarness()
    const updates = [
      { propertyId: 'shared-position', values: { x: 10, y: 20 } },
      { propertyId: 'shared-stroke', values: { width: 4 } }
    ]

    const result = apis.updatePropertyComponents(updates, {
      sharedDelivery: 'immediate'
    })

    expect(sequence).toEqual(['props-prepare', 'props-apply'])
    expect(props.preparePropertyMutationBatch).toHaveBeenCalledWith({
      operations: [
        {
          kind: 'values',
          propertyId: 'shared-position',
          values: { x: 10, y: 20 }
        },
        {
          kind: 'values',
          propertyId: 'shared-stroke',
          values: { width: 4 }
        }
      ],
      options: { sharedDelivery: 'immediate' }
    })
    expect(props.applyPreparedPropertyMutationBatch).toHaveBeenCalledOnce()
    expect(result).toEqual(['shared-position', 'shared-stroke'])
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('routes exact raw, hierarchy, and subtree evidence through typed Core owners', () => {
    const { apis, props, sceneTree, sequence } = createHarness()
    const rawChanges = [
      {
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
        eventName: EventTypes.UPDATE_ELEMENT_DATA,
        id: 'raw-element',
        changes: [
          {
            key: 'visible' as const,
            before: true,
            after: false
          }
        ]
      }
    ] satisfies readonly UpdateElementDataChange[]
    const moves = [
      {
        elementId: 'moved-element',
        before: { parentId: 'workspace-1', index: 0 },
        after: { parentId: 'group-1', index: 0 }
      }
    ] satisfies readonly HierarchyMove[]
    const subtreeChange = {
      action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
      undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
      eventName: EventTypes.CHANGE_SUBTREE,
      elementId: 'subtree-root',
      removed: [
        {
          elementId: 'subtree-child',
          parentId: 'subtree-root',
          index: 0,
          data: {
            id: 'subtree-child',
            type: COMPONENT_TYPE,
            name: 'Subtree Child',
            parentId: 'subtree-root',
            visible: true,
            lock: false
          } as unknown as ElementRawData
        },
        {
          elementId: 'subtree-root',
          parentId: 'workspace-1',
          index: 0,
          data: {
            id: 'subtree-root',
            type: COMPONENT_TYPE,
            name: 'Subtree Root',
            parentId: 'workspace-1',
            visible: true,
            lock: false
          } as unknown as ElementRawData
        }
      ],
      rootParentChildrenAfter: []
    } satisfies SubtreeChange

    expect(apis.applyElementDataChanges(rawChanges)).toEqual(['raw-element'])
    expect(apis.applyHierarchyMoves(moves)).toBe(true)
    expect(apis.removeSubtreeFromCanonicalData(subtreeChange)).toEqual({
      elementId: 'subtree-root',
      removed: subtreeChange.removed,
      rootParentChildrenAfter: []
    })

    expect(sceneTree.prepareCanonicalElementDataMutation).toHaveBeenCalledWith(
      rawChanges
    )
    expect(sceneTree.applyHierarchyMoves).toHaveBeenCalledWith(moves, undefined)
    expect(sceneTree.prepareCanonicalSubtreeRemoval).toHaveBeenCalledWith(
      subtreeChange
    )
    expect(props.preparePropertyMutationBatch).toHaveBeenCalledOnce()
    expect(sequence).toEqual([
      'scene-prepare',
      'scene-apply',
      'scene-apply',
      'scene-prepare',
      'props-prepare',
      'scene-apply',
      'props-apply'
    ])
  })

  it('applies one ordered canonical change batch through Core-owned facades', () => {
    const { apis, props, sceneTree, sequence } = createHarness()
    const rawChange = {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
      eventName: EventTypes.UPDATE_ELEMENT_DATA,
      id: 'canonical-raw-element',
      changes: [
        {
          key: 'visible' as const,
          before: true,
          after: false
        }
      ]
    } satisfies UpdateElementDataChange
    const applyCanonicalChanges = (
      apis as unknown as {
        applyCanonicalChanges: (
          changes: readonly (
            | {
                kind: 'property-components'
                updates: readonly {
                  propertyId: string
                  values: Readonly<Record<string, unknown>>
                }[]
              }
            | {
                kind: 'element-data'
                changes: readonly UpdateElementDataChange[]
              }
          )[]
        ) => void
      }
    ).applyCanonicalChanges

    applyCanonicalChanges([
      {
        kind: 'property-components',
        updates: [
          {
            propertyId: 'canonical-property',
            values: { value: 12 }
          }
        ]
      },
      {
        kind: 'element-data',
        changes: [rawChange]
      }
    ])

    expect(props.preparePropertyMutationBatch).toHaveBeenCalledOnce()
    expect(props.applyPreparedPropertyMutationBatch).toHaveBeenCalledOnce()
    expect(sceneTree.prepareCanonicalElementDataMutation).toHaveBeenCalledWith([
      rawChange
    ])
    expect(sequence).toEqual([
      'props-prepare',
      'props-apply',
      'scene-prepare',
      'scene-apply'
    ])
  })

  it('coordinates every remaining canonical lifecycle kind without a second apply path', () => {
    const { apis, sequence } = createHarness()
    const subtreeChange = {
      action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
      undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
      eventName: EventTypes.CHANGE_SUBTREE,
      elementId: 'subtree-root',
      removed: [
        {
          elementId: 'subtree-root',
          parentId: 'workspace-1',
          index: 0,
          data: {
            id: 'subtree-root',
            type: COMPONENT_TYPE,
            name: 'Subtree Root',
            parentId: 'workspace-1',
            visible: true,
            lock: false
          } as unknown as ElementRawData
        }
      ],
      rootParentChildrenAfter: []
    } satisfies SubtreeChange
    const canonicalElement = {
      id: 'canonical-element',
      name: 'Canonical Element',
      type: COMPONENT_TYPE,
      parentId: 'workspace-1',
      visible: true,
      lock: false,
      props: { value: 'canonical-property' }
    } as unknown as ElementRawData

    apis.applyCanonicalChanges([
      {
        kind: 'hierarchy-moves',
        moves: [
          {
            elementId: 'moved-element',
            before: { parentId: 'workspace-1', index: 0 },
            after: { parentId: 'group-1', index: 0 }
          }
        ]
      },
      {
        kind: 'subtree-removal',
        change: subtreeChange
      },
      {
        kind: 'subtree-restore',
        sceneSnapshot: {
          elementId: 'subtree-root',
          removed: subtreeChange.removed,
          rootParentChildrenAfter: []
        },
        propsSnapshot: { components: [] }
      },
      {
        kind: 'element-creation',
        elements: [canonicalElement],
        properties: [
          {
            id: 'canonical-property',
            type: PROPERTY_TYPE,
            value: 91
          }
        ],
        parentId: 'workspace-1',
        index: 0
      },
      {
        kind: 'element-removal',
        removals: [
          {
            data: canonicalElement,
            parentId: 'workspace-1',
            index: 0
          }
        ]
      }
    ])

    expect(sequence).toEqual([
      'scene-apply',
      'scene-prepare',
      'props-prepare',
      'scene-apply',
      'props-apply',
      'scene-prepare',
      'props-prepare',
      'props-apply',
      'scene-apply',
      'scene-prepare',
      'props-prepare',
      'props-apply',
      'scene-apply',
      'scene-prepare',
      'props-prepare',
      'scene-apply',
      'props-apply'
    ])
  })
})
