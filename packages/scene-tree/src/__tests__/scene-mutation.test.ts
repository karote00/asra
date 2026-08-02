import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropsManager } from '@asyra/props-manager'
import {
  EventTypes,
  runWithTransactionOwner,
  type TransactionOwner,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import {
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  type AddRemoveElementsChange,
  type ElementRawData,
  type ElementPropertyRelation,
  type GroupRawData,
  type GroupInstanceTypes,
  type PropsComponentRawData,
  type SceneTreeRawData,
  type SubtreeChange,
  type UpdateElementDataChange
} from '@asyra/utils'
import { SceneTree } from '../sceneTree'
import Element from '../components/element'
import Group from '../components/group'
import type Workspace from '../components/workspace'
import componentRegistry from '../component-registry'

const RAW_ELEMENT_TYPE = 'scene-raw-mutation-element'
const RAW_GROUP_TYPE = 'scene-raw-mutation-group'
const RELATION_ELEMENT_TYPE = 'scene-relation-mutation-element'
const INVALID_RELATION_ELEMENT_TYPE = 'scene-invalid-relation-mutation-element'
const SECOND_RELATION_ELEMENT_TYPE = 'scene-second-relation-mutation-element'
const MUTABLE_RELATION_ELEMENT_TYPE = 'scene-mutable-relation-mutation-element'
const CLEANUP_RELATION_ELEMENT_TYPE = 'scene-cleanup-relation-mutation-element'
const RESTORE_CONTRACT_ELEMENT_TYPE = 'scene-restore-contract-mutation-element'
const RELATION_PROPERTY_NAME = 'linked'
const RELATION_PROPERTY_TYPE = 'scene-relation-mutation-property'
const SECOND_RELATION_PROPERTY_TYPE = 'scene-second-relation-mutation-property'
const emptyProps = (): ElementRawData['props'] =>
  ({}) as ElementRawData['props']
const relationProps = (componentId: string): ElementRawData['props'] =>
  ({
    [RELATION_PROPERTY_NAME]: componentId
  }) as unknown as ElementRawData['props']

class RawMutationElement extends Element {
  static readonly ordinaryPropertyDefinitions = Object.freeze([])

  _init(): void {
    super._init()
    this.data.type = RAW_ELEMENT_TYPE
  }

  setupProps(): void {
    // This owner test component intentionally has no property relations.
  }

  save(): ElementRawData {
    return {
      id: this.get('id'),
      type: this.get('type'),
      name: this.get('name'),
      parentId: this.get('parentId'),
      visible: this.get('visible'),
      lock: this.get('lock'),
      props: emptyProps()
    }
  }
}

class RawMutationGroup extends Group {
  static readonly ordinaryPropertyDefinitions = Object.freeze([])

  _init(): void {
    super._init()
    this.data.type = RAW_GROUP_TYPE
  }

  setupProps(): void {
    // This owner test container intentionally has no property relations.
  }

  save() {
    return {
      id: this.get('id'),
      type: this.get('type'),
      name: this.get('name'),
      parentId: this.get('parentId'),
      visible: this.get('visible'),
      lock: this.get('lock'),
      props: emptyProps(),
      children: [...this.get('children')]
    }
  }
}

class RelationMutationElement extends Element {
  static readonly ordinaryPropertyDefinitions = Object.freeze([
    Object.freeze({
      name: RELATION_PROPERTY_NAME,
      type: RELATION_PROPERTY_TYPE
    })
  ])

  private relationProps?: Record<string, string>

  _init(): void {
    super._init()
    this.data.type = RELATION_ELEMENT_TYPE
  }

  setupProps(propsData?: ElementRawData['props']): void {
    this.relationProps = { ...(propsData as Record<string, string>) }
  }

  save(): ElementRawData {
    return {
      id: this.get('id'),
      type: this.get('type'),
      name: this.get('name'),
      parentId: this.get('parentId'),
      visible: this.get('visible'),
      lock: this.get('lock'),
      props: {
        ...(this.relationProps ?? {})
      } as unknown as ElementRawData['props']
    }
  }
}

class InvalidRelationMutationElement extends RelationMutationElement {
  _init(): void {
    super._init()
    this.data.type = INVALID_RELATION_ELEMENT_TYPE
  }
}

class SecondRelationMutationElement extends RelationMutationElement {
  _init(): void {
    super._init()
    this.data.type = SECOND_RELATION_ELEMENT_TYPE
  }
}

class MutableRelationMutationElement extends Element {
  static ordinaryPropertyDefinitions = [
    {
      name: RELATION_PROPERTY_NAME,
      type: RELATION_PROPERTY_TYPE
    }
  ]

  private relationProps?: Record<string, string>

  _init(): void {
    super._init()
    this.data.type = MUTABLE_RELATION_ELEMENT_TYPE
  }

  setupProps(propsData?: ElementRawData['props']): void {
    this.relationProps = { ...(propsData as Record<string, string>) }
  }

  save(): ElementRawData {
    return {
      id: this.get('id'),
      type: this.get('type'),
      name: this.get('name'),
      parentId: this.get('parentId'),
      visible: this.get('visible'),
      lock: this.get('lock'),
      props: {
        ...(this.relationProps ?? {})
      } as unknown as ElementRawData['props']
    }
  }
}

class CleanupRelationMutationElement extends RelationMutationElement {
  static materialized: CleanupRelationMutationElement[] = []
  static disposeAttempts: string[] = []
  static disposeFailureElementId = ''

  constructor(data?: Partial<ElementRawData>) {
    super(data)
    CleanupRelationMutationElement.materialized.push(this)
  }

  _init(): void {
    super._init()
    this.data.type = CLEANUP_RELATION_ELEMENT_TYPE
  }

  setupProps(propsData?: ElementRawData['props']): void {
    super.setupProps(propsData)
    this.computed = {
      dispose: () => {
        const elementId = this.get('id')
        CleanupRelationMutationElement.disposeAttempts.push(elementId)
        if (
          elementId === CleanupRelationMutationElement.disposeFailureElementId
        ) {
          throw new Error(`dispose rejected for ${elementId}`)
        }
      }
    } as unknown as CleanupRelationMutationElement['computed']
  }
}

class RestoreContractElement extends RelationMutationElement {
  static materializedIds: string[] = []

  constructor(data?: Partial<ElementRawData>) {
    super(data)
    RestoreContractElement.materializedIds.push(this.get('id'))
  }

  _init(): void {
    super._init()
    this.data.type = RESTORE_CONTRACT_ELEMENT_TYPE
  }
}

const createTransactionOwner = (
  updateTransactionBatch = vi.fn()
): TransactionOwner & {
  updateTransactionBatch: ReturnType<typeof vi.fn>
} =>
  ({
    startTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    updateTransactionBatch,
    endTransaction: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn()
  }) as TransactionOwner & {
    updateTransactionBatch: ReturnType<typeof vi.fn>
  }

const appendElementToLoadSnapshot = (
  snapshot: SceneTreeRawData,
  data: ElementRawData
): void => {
  snapshot.elements[data.id] = data
  const parentId = data.parentId
  if (typeof parentId !== 'string') {
    throw new Error(`Expected load parent for "${data.id}"`)
  }
  const parent = snapshot.elements[parentId] as GroupRawData | undefined
  if (!parent || !Array.isArray(parent.children)) {
    throw new Error(`Expected load parent "${parentId}"`)
  }
  parent.children = [...parent.children, data.id]
}

const createDetachedRestoreSnapshot = (
  sceneTree: SceneTree,
  data: ElementRawData
) => {
  const parent = sceneTree.currentWorkspace as GroupInstanceTypes
  return {
    elementId: data.id,
    removed: [
      {
        elementId: data.id,
        parentId: parent.get('id'),
        index: parent.get('children').length,
        data
      }
    ],
    rootParentChildrenAfter: [...parent.get('children')]
  }
}

describe('SceneTree owner-issued mutation prepared mutations', () => {
  let sceneTree: SceneTree
  let propsManagerOwner: PropsManager
  let activeProperties: Map<
    string,
    {
      get(key: 'id' | 'type'): string
    }
  >
  let first: RawMutationElement
  let second: RawMutationElement

  beforeEach(() => {
    componentRegistry.unregister(RAW_ELEMENT_TYPE)
    componentRegistry.unregister(RAW_GROUP_TYPE)
    componentRegistry.unregister(RELATION_ELEMENT_TYPE)
    componentRegistry.unregister(INVALID_RELATION_ELEMENT_TYPE)
    componentRegistry.unregister(SECOND_RELATION_ELEMENT_TYPE)
    componentRegistry.unregister(MUTABLE_RELATION_ELEMENT_TYPE)
    componentRegistry.unregister(CLEANUP_RELATION_ELEMENT_TYPE)
    componentRegistry.unregister(RESTORE_CONTRACT_ELEMENT_TYPE)
    componentRegistry.register({
      type: RAW_ELEMENT_TYPE,
      idPrefix: RAW_ELEMENT_TYPE,
      namePrefix: 'Raw Mutation Element',
      constructor: RawMutationElement,
      properties: [],
      defaults: {}
    })
    componentRegistry.register({
      type: RAW_GROUP_TYPE,
      idPrefix: RAW_GROUP_TYPE,
      namePrefix: 'Raw Mutation Group',
      constructor: RawMutationGroup,
      properties: [],
      defaults: {},
      isContainer: true
    })
    componentRegistry.register({
      type: RELATION_ELEMENT_TYPE,
      idPrefix: RELATION_ELEMENT_TYPE,
      namePrefix: 'Relation Mutation Element',
      constructor: RelationMutationElement,
      properties: RelationMutationElement.ordinaryPropertyDefinitions.map(
        (definition) => ({ ...definition })
      ),
      defaults: {}
    })
    componentRegistry.register({
      type: SECOND_RELATION_ELEMENT_TYPE,
      idPrefix: SECOND_RELATION_ELEMENT_TYPE,
      namePrefix: 'Second Relation Mutation Element',
      constructor: SecondRelationMutationElement,
      properties: [
        {
          name: RELATION_PROPERTY_NAME,
          type: SECOND_RELATION_PROPERTY_TYPE
        }
      ],
      defaults: {}
    })
    componentRegistry.register({
      type: MUTABLE_RELATION_ELEMENT_TYPE,
      idPrefix: MUTABLE_RELATION_ELEMENT_TYPE,
      namePrefix: 'Mutable Relation Mutation Element',
      constructor: MutableRelationMutationElement,
      properties: [],
      defaults: {}
    })
    componentRegistry.register({
      type: CLEANUP_RELATION_ELEMENT_TYPE,
      idPrefix: CLEANUP_RELATION_ELEMENT_TYPE,
      namePrefix: 'Cleanup Relation Mutation Element',
      constructor: CleanupRelationMutationElement,
      properties: [...RelationMutationElement.ordinaryPropertyDefinitions],
      defaults: {}
    })
    componentRegistry.register({
      type: RESTORE_CONTRACT_ELEMENT_TYPE,
      idPrefix: RESTORE_CONTRACT_ELEMENT_TYPE,
      namePrefix: 'Restore Contract Element',
      constructor: RestoreContractElement,
      properties: [...RelationMutationElement.ordinaryPropertyDefinitions],
      defaults: {}
    })
    CleanupRelationMutationElement.materialized = []
    CleanupRelationMutationElement.disposeAttempts = []
    CleanupRelationMutationElement.disposeFailureElementId = ''
    RestoreContractElement.materializedIds = []
    activeProperties = new Map()
    propsManagerOwner = {
      changes: [],
      save: vi.fn(() => ({})),
      getPropertyById: vi.fn((propertyId: string) =>
        activeProperties.get(propertyId)
      )
    } as unknown as PropsManager
    sceneTree = new SceneTree(propsManagerOwner)
    sceneTree.init()
    first = new RawMutationElement({
      id: 'raw-mutation-first',
      name: 'First',
      visible: true,
      lock: false
    })
    second = new RawMutationElement({
      id: 'raw-mutation-second',
      name: 'Second',
      visible: true,
      lock: false
    })
    ;(sceneTree.currentWorkspace as Workspace).addNewElements([first, second])
    sceneTree.cleanChanges()
  })

  it('exposes only typed canonical lifecycle prepared mutations without compatibility facades', () => {
    const publicSurface = sceneTree as unknown as Record<string, unknown>

    expect(publicSurface).not.toHaveProperty('addNewElementsFromCanonicalData')
    expect(publicSurface).not.toHaveProperty(
      'addNewElementsFromCanonicalDataUsingActiveProperties'
    )
    expect(publicSurface).not.toHaveProperty(
      'removeElementsUsingActiveProperties'
    )
    expect(publicSurface).not.toHaveProperty(
      'removeElementUsingActiveProperties'
    )
    expect(publicSurface).not.toHaveProperty(
      'removeSubtreeUsingActiveProperties'
    )
    expect(publicSurface).not.toHaveProperty('addChangeForRemoveElement')
  })

  it('applies one detached raw preparedMutation once through one Scene-only batch', () => {
    const requests = [
      {
        elementId: 'raw-mutation-first',
        values: {
          name: 'Renamed',
          visible: false
        }
      },
      {
        elementId: 'raw-mutation-second',
        values: {
          lock: true
        }
      }
    ]
    const propsBefore = propsManagerOwner.save()
    const preparedMutation = sceneTree.prepareElementDataMutation(requests)

    expect(first.get('name')).toBe('First')
    expect(first.get('visible')).toBe(true)
    expect(second.get('lock')).toBe(false)
    requests[0].values.name = 'Caller mutation'

    const transactionOwner = createTransactionOwner()
    const result = runWithTransactionOwner(transactionOwner, () =>
      sceneTree.applyPreparedElementMutation(preparedMutation)
    )

    expect(first.get('name')).toBe('Renamed')
    expect(first.get('visible')).toBe(false)
    expect(second.get('lock')).toBe(true)
    expect(propsManagerOwner.save()).toEqual(propsBefore)
    expect(propsManagerOwner.changes).toEqual([])
    expect(transactionOwner.updateTransactionBatch).toHaveBeenCalledOnce()

    const events = transactionOwner.updateTransactionBatch.mock
      .calls[0]?.[0] as readonly UpdateTransactionEvent[]
    expect(events).toHaveLength(2)
    expect(
      events.map(({ eventName, payload }) => ({
        eventName,
        action: (payload as UpdateElementDataChange).action,
        id: (payload as UpdateElementDataChange).id,
        changes: (payload as UpdateElementDataChange).changes
      }))
    ).toEqual([
      {
        eventName: EventTypes.UPDATE_ELEMENT_DATA,
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
        id: 'raw-mutation-first',
        changes: [
          {
            key: 'name',
            before: 'First',
            after: 'Renamed'
          },
          {
            key: 'visible',
            before: true,
            after: false
          }
        ]
      },
      {
        eventName: EventTypes.UPDATE_ELEMENT_DATA,
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
        id: 'raw-mutation-second',
        changes: [
          {
            key: 'lock',
            before: false,
            after: true
          }
        ]
      }
    ])
    expect(result.orderedElementIds).toEqual([
      'raw-mutation-first',
      'raw-mutation-second'
    ])
    expect(Object.isFrozen(preparedMutation)).toBe(true)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.evidence)).toBe(true)

    expect(() =>
      runWithTransactionOwner(createTransactionOwner(), () =>
        sceneTree.applyPreparedElementMutation(preparedMutation)
      )
    ).toThrow(/one-shot|already applied/i)
  })

  it('prepares exact canonical raw evidence without applying a prefix', () => {
    const sourcePreparation = sceneTree.prepareElementDataMutation([
      {
        elementId: 'raw-mutation-first',
        values: { name: 'Remote First', visible: false }
      },
      {
        elementId: 'raw-mutation-second',
        values: { lock: true }
      }
    ])

    const exactPreparation = sceneTree.prepareCanonicalElementDataMutation(
      sourcePreparation.evidence
    )

    expect(exactPreparation).not.toBe(sourcePreparation)
    expect(exactPreparation.evidence).toEqual(sourcePreparation.evidence)
    expect(exactPreparation.orderedElementIds).toEqual([
      'raw-mutation-first',
      'raw-mutation-second'
    ])
    expect(first.get('name')).toBe('First')
    expect(first.get('visible')).toBe(true)
    expect(second.get('lock')).toBe(false)

    const staleEvidence = sourcePreparation.evidence.map((change, index) =>
      index === 1
        ? {
            ...change,
            changes: change.changes.map((field) => ({
              ...field,
              before: field.key === 'lock' ? true : field.before
            }))
          }
        : change
    )

    expect(() =>
      sceneTree.prepareCanonicalElementDataMutation(staleEvidence)
    ).toThrow(/stale canonical element data/i)
    expect(first.get('name')).toBe('First')
    expect(first.get('visible')).toBe(true)
    expect(second.get('lock')).toBe(false)
    expect(sceneTree.changes).toEqual([])
  })

  it('rejects later-invalid, counterfeit, cross-owner, and stale prepared mutations before mutation', () => {
    expect(() =>
      sceneTree.prepareElementDataMutation([
        {
          elementId: 'raw-mutation-first',
          values: { visible: false }
        },
        {
          elementId: 'missing-element',
          values: { lock: true }
        }
      ])
    ).toThrow(/missing-element/i)
    expect(first.get('visible')).toBe(true)
    expect(second.get('lock')).toBe(false)

    expect(() =>
      runWithTransactionOwner(createTransactionOwner(), () =>
        sceneTree.applyPreparedElementMutation({
          kind: 'prepared-element-data-mutation',
          orderedElementIds: ['raw-mutation-first'],
          evidence: []
        })
      )
    ).toThrow(/owner-issued/i)

    const crossOwnerPreparation = sceneTree.prepareElementDataMutation([
      {
        elementId: 'raw-mutation-first',
        values: { visible: false }
      }
    ])
    const otherSceneTree = new SceneTree(propsManagerOwner)
    expect(() =>
      runWithTransactionOwner(createTransactionOwner(), () =>
        otherSceneTree.applyPreparedElementMutation(crossOwnerPreparation)
      )
    ).toThrow(/owner-issued/i)

    const stalePreparation = sceneTree.prepareElementDataMutation([
      {
        elementId: 'raw-mutation-first',
        values: { visible: false }
      }
    ])
    first.assignCanonicalElementData({ visible: false })
    const staleOwner = createTransactionOwner()
    expect(() =>
      runWithTransactionOwner(staleOwner, () =>
        sceneTree.applyPreparedElementMutation(stalePreparation)
      )
    ).toThrow(/stale/i)
    expect(staleOwner.updateTransactionBatch).not.toHaveBeenCalled()
  })

  it('restores all raw fields when the owner rejects the batch handoff', () => {
    const preparedMutation = sceneTree.prepareElementDataMutation([
      {
        elementId: 'raw-mutation-first',
        values: {
          name: 'Rejected',
          visible: false,
          lock: true
        }
      }
    ])
    const transactionOwner = createTransactionOwner(
      vi.fn(() => {
        throw new Error('reject raw Scene batch')
      })
    )

    expect(() =>
      runWithTransactionOwner(transactionOwner, () =>
        sceneTree.applyPreparedElementMutation(preparedMutation)
      )
    ).toThrow(/reject raw Scene batch/i)

    expect(first.get('name')).toBe('First')
    expect(first.get('visible')).toBe(true)
    expect(first.get('lock')).toBe(false)
    expect(sceneTree.changes).toEqual([])
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('keeps a one-item raw request on the same batch preparedMutation shape', () => {
    const preparedMutation = sceneTree.prepareElementDataMutation([
      {
        elementId: 'raw-mutation-first',
        values: { lock: true }
      }
    ])
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes

    expect(preparedMutation.kind).toBe('prepared-element-data-mutation')
    expect(preparedMutation.orderedElementIds).toEqual(['raw-mutation-first'])
    expect(workspace.get('children')).toEqual([
      'raw-mutation-first',
      'raw-mutation-second'
    ])
  })

  it('preflights a complete insertion batch before changing Scene or Props', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const childrenBefore = [...workspace.get('children')]
    const propsBefore = propsManagerOwner.save()

    expect(() =>
      sceneTree.prepareElementInsertion({
        parentId: workspace.get('id'),
        ownerRelations: [],
        elements: [
          {
            id: 'prepared-insertion-valid',
            type: RAW_ELEMENT_TYPE,
            name: 'Valid',
            parentId: workspace.get('id'),
            visible: true,
            lock: false,
            props: emptyProps()
          },
          {
            id: 'prepared-insertion-invalid',
            type: 'missing-scene-component',
            name: 'Invalid',
            parentId: workspace.get('id'),
            visible: true,
            lock: false,
            props: emptyProps()
          }
        ]
      })
    ).toThrow(/missing-scene-component/i)

    expect(workspace.get('children')).toEqual(childrenBefore)
    expect(sceneTree.getElementById('prepared-insertion-valid')).toBeUndefined()
    expect(propsManagerOwner.save()).toEqual(propsBefore)
    expect(propsManagerOwner.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
  })

  it('prepares relation-backed ordinary insertion while its Props owners are inactive', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const propertyId = 'inactive-relation-property'
    const data = {
      id: 'inactive-relation-element',
      type: RELATION_ELEMENT_TYPE,
      name: 'Inactive Relation Element',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: relationProps(propertyId)
    } satisfies ElementRawData
    const ownerRelations = [
      {
        ownerElementId: data.id,
        ownerElementType: data.type,
        ownerPropertyName: RELATION_PROPERTY_NAME,
        componentId: propertyId
      }
    ] satisfies readonly ElementPropertyRelation[]
    const getPropertyById = vi.mocked(propsManagerOwner.getPropertyById)

    const preparedMutation = sceneTree.prepareElementInsertion({
      parentId: workspace.get('id'),
      elements: [data],
      ownerRelations
    })

    expect(preparedMutation.orderedElementIds).toEqual([data.id])
    expect(getPropertyById).not.toHaveBeenCalled()
    expect(sceneTree.getElementById(data.id)).toBeUndefined()
    expect(workspace.get('children')).toEqual([
      'raw-mutation-first',
      'raw-mutation-second'
    ])
    expect(propsManagerOwner.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
  })

  it('registers prepared owner relations without serializing each materialized element', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const propertyId = 'prepared-relation-without-element-save'
    const data = {
      id: 'prepared-relation-save-free-element',
      type: RELATION_ELEMENT_TYPE,
      name: 'Prepared Relation Save Free Element',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: relationProps(propertyId)
    } satisfies ElementRawData
    const ownerRelations = [
      {
        ownerElementId: data.id,
        ownerElementType: data.type,
        ownerPropertyName: RELATION_PROPERTY_NAME,
        componentId: propertyId
      }
    ] satisfies readonly ElementPropertyRelation[]
    const preparedMutation = sceneTree.prepareElementInsertion({
      parentId: workspace.get('id'),
      elements: [data],
      ownerRelations
    })
    activeProperties.set(propertyId, {
      get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
    })
    const save = vi.spyOn(RelationMutationElement.prototype, 'save')

    try {
      runWithTransactionOwner(createTransactionOwner(), () =>
        sceneTree.applyPreparedElementMutation(preparedMutation)
      )

      expect(save).not.toHaveBeenCalled()
      expect(sceneTree.getElementPropertyRelations(propertyId)).toEqual(
        ownerRelations
      )
    } finally {
      save.mockRestore()
    }
  })

  it('allows one inactive property component id to serve distinct owner relations', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const propertyId = 'shared-inactive-relation-property'
    const elements = ['a', 'b'].map(
      (suffix) =>
        ({
          id: `shared-inactive-relation-element-${suffix}`,
          type: RELATION_ELEMENT_TYPE,
          name: `Shared Inactive Relation Element ${suffix.toUpperCase()}`,
          parentId: workspace.get('id'),
          visible: true,
          lock: false,
          props: relationProps(propertyId)
        }) satisfies ElementRawData
    )
    const ownerRelations = elements.map(
      (element) =>
        ({
          ownerElementId: element.id,
          ownerElementType: element.type,
          ownerPropertyName: RELATION_PROPERTY_NAME,
          componentId: propertyId
        }) satisfies ElementPropertyRelation
    )

    const preparedMutation = sceneTree.prepareElementInsertion({
      parentId: workspace.get('id'),
      elements,
      ownerRelations
    })

    expect(preparedMutation.orderedElementIds).toEqual(
      elements.map(({ id }) => id)
    )
    expect(propsManagerOwner.getPropertyById).not.toHaveBeenCalled()
    activeProperties.set(propertyId, {
      get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
    })
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(preparedMutation)
    )
    expect(
      elements.map(({ id }) => sceneTree.getElementById(id)?.save())
    ).toEqual(elements)
    const relations = sceneTree.getElementPropertyRelations(propertyId)
    expect(relations).toEqual(ownerRelations)
    expect(Object.isFrozen(relations)).toBe(true)
    expect(relations.every(Object.isFrozen)).toBe(true)
    expect(sceneTree.changes).toEqual([])
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('rejects a registry that repeats one owner relation tuple', () => {
    componentRegistry.register({
      type: INVALID_RELATION_ELEMENT_TYPE,
      idPrefix: INVALID_RELATION_ELEMENT_TYPE,
      namePrefix: 'Invalid Relation Mutation Element',
      constructor: InvalidRelationMutationElement,
      properties: [
        {
          name: RELATION_PROPERTY_NAME,
          type: RELATION_PROPERTY_TYPE
        },
        {
          name: RELATION_PROPERTY_NAME,
          type: RELATION_PROPERTY_TYPE
        }
      ],
      defaults: {}
    })
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const propertyId = 'duplicate-registry-relation-property'
    const data = {
      id: 'duplicate-registry-relation-element',
      type: INVALID_RELATION_ELEMENT_TYPE,
      name: 'Duplicate Registry Relation Element',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: relationProps(propertyId)
    } satisfies ElementRawData

    expect(() =>
      sceneTree.prepareElementInsertion({
        parentId: workspace.get('id'),
        elements: [data],
        ownerRelations: [
          {
            ownerElementId: data.id,
            ownerElementType: data.type,
            ownerPropertyName: RELATION_PROPERTY_NAME,
            componentId: propertyId
          }
        ]
      })
    ).toThrow(/registry|duplicate.*owner relation/i)

    expect(propsManagerOwner.getPropertyById).not.toHaveBeenCalled()
    expect(sceneTree.getElementById(data.id)).toBeUndefined()
    expect(sceneTree.changes).toEqual([])
    expect(propsManagerOwner.changes).toEqual([])
  })

  it.each([
    {
      name: 'missing later owner relation',
      mutate: (
        relations: ElementPropertyRelation[]
      ): ElementPropertyRelation[] => relations.slice(0, 1),
      error: /owner relation|coverage/i
    },
    {
      name: 'duplicate later owner relation',
      mutate: (
        relations: ElementPropertyRelation[]
      ): ElementPropertyRelation[] => [...relations, { ...relations[1] }],
      error: /duplicate owner relation/i
    },
    {
      name: 'unknown later owner element',
      mutate: (
        relations: ElementPropertyRelation[]
      ): ElementPropertyRelation[] => [
        relations[0],
        {
          ...relations[1],
          ownerElementId: 'not-in-this-insertion'
        }
      ],
      error: /owner element|owner relation|insertion/i
    },
    {
      name: 'wrong later owner element type',
      mutate: (
        relations: ElementPropertyRelation[]
      ): ElementPropertyRelation[] => [
        relations[0],
        {
          ...relations[1],
          ownerElementType: RAW_ELEMENT_TYPE
        }
      ],
      error: /owner element type|relation/i
    },
    {
      name: 'unknown later owner property',
      mutate: (
        relations: ElementPropertyRelation[]
      ): ElementPropertyRelation[] => [
        relations[0],
        {
          ...relations[1],
          ownerPropertyName: 'not-registered'
        }
      ],
      error: /owner property|relation/i
    },
    {
      name: 'mismatched later component id',
      mutate: (
        relations: ElementPropertyRelation[]
      ): ElementPropertyRelation[] => [
        relations[0],
        {
          ...relations[1],
          componentId: 'not-the-snapshot-owner'
        }
      ],
      error: /component|relation|props/i
    }
  ])('rejects $name without a Scene or Props prefix', ({ mutate, error }) => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const childrenBefore = [...workspace.get('children')]
    const elements = ['valid', 'later'].map(
      (suffix) =>
        ({
          id: `later-relation-${suffix}`,
          type: RELATION_ELEMENT_TYPE,
          name: `Later Relation ${suffix}`,
          parentId: workspace.get('id'),
          visible: true,
          lock: false,
          props: relationProps(`later-relation-property-${suffix}`)
        }) satisfies ElementRawData
    )
    const validRelations = elements.map(
      (element) =>
        ({
          ownerElementId: element.id,
          ownerElementType: element.type,
          ownerPropertyName: RELATION_PROPERTY_NAME,
          componentId: (element.props as Record<string, string>)[
            RELATION_PROPERTY_NAME
          ]
        }) satisfies ElementPropertyRelation
    )

    expect(() =>
      sceneTree.prepareElementInsertion({
        parentId: workspace.get('id'),
        elements,
        ownerRelations: mutate(validRelations)
      })
    ).toThrow(error)

    expect(propsManagerOwner.getPropertyById).not.toHaveBeenCalled()
    expect(workspace.get('children')).toEqual(childrenBefore)
    expect(sceneTree.getElementById('later-relation-valid')).toBeUndefined()
    expect(sceneTree.changes).toEqual([])
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('prepares exact canonical relation evidence while Props owners are inactive', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const data = {
      id: 'inactive-canonical-relation-element',
      type: RELATION_ELEMENT_TYPE,
      name: 'Inactive Canonical Relation Element',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: relationProps('inactive-canonical-relation-property')
    } satisfies ElementRawData

    const preparedMutation = sceneTree.prepareCanonicalElementInsertion({
      entries: [
        {
          data,
          parentId: workspace.get('id'),
          index: workspace.get('children').length
        }
      ]
    })

    expect(preparedMutation.orderedElementIds).toEqual([data.id])
    expect(propsManagerOwner.getPropertyById).not.toHaveBeenCalled()
    expect(sceneTree.getElementById(data.id)).toBeUndefined()
    expect(sceneTree.changes).toEqual([])
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('applies exact canonical elements against active Props through one typed Scene preparedMutation', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const propertyId = 'canonical-shared-mutation-property'
    const elements = ['first', 'second'].map(
      (suffix) =>
        ({
          id: `canonical-shared-mutation-${suffix}`,
          type: RELATION_ELEMENT_TYPE,
          name: `Canonical Shared Mutation ${suffix}`,
          parentId: workspace.get('id'),
          visible: true,
          lock: false,
          props: relationProps(propertyId)
        }) satisfies ElementRawData
    )
    const expectedElements = structuredClone(elements)
    const preparedMutation = sceneTree.prepareCanonicalElementInsertion({
      entries: elements.map((data, offset) => ({
        data,
        parentId: workspace.get('id'),
        index: workspace.get('children').length + offset
      }))
    })
    const expectedRelations = elements.map(
      ({ id, type }) =>
        ({
          ownerElementId: id,
          ownerElementType: type,
          ownerPropertyName: RELATION_PROPERTY_NAME,
          componentId: propertyId
        }) satisfies ElementPropertyRelation
    )

    expect(preparedMutation.ownerRelations).toEqual(expectedRelations)
    expect(Object.isFrozen(preparedMutation)).toBe(true)
    expect(Object.isFrozen(preparedMutation.ownerRelations)).toBe(true)
    expect(preparedMutation.ownerRelations.every(Object.isFrozen)).toBe(true)
    expect(preparedMutation.ownerRelations).not.toHaveProperty('0.propertyType')
    expect(() => {
      ;(
        preparedMutation.ownerRelations[0] as {
          componentId: string
        }
      ).componentId = 'caller-pollution'
    }).toThrow()
    ;(elements[0].props as Record<string, string>)[RELATION_PROPERTY_NAME] =
      'caller-entry-pollution'
    activeProperties.set(propertyId, {
      get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
    })

    const transactionOwner = createTransactionOwner()
    const result = runWithTransactionOwner(transactionOwner, () =>
      sceneTree.applyPreparedElementMutation(preparedMutation)
    )

    expect(result.orderedElementIds).toEqual(elements.map(({ id }) => id))
    expect(
      elements.map(({ id }) => sceneTree.getElementById(id)?.save())
    ).toEqual(expectedElements)
    expect(sceneTree.getElementPropertyRelations(propertyId)).toEqual(
      expectedRelations
    )
    expect(transactionOwner.updateTransactionBatch).toHaveBeenCalledOnce()
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('validates every active property relation before materializing the first element', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const childrenBefore = [...workspace.get('children')]
    const elements = ['active', 'missing'].map(
      (suffix) =>
        ({
          id: `apply-preflight-${suffix}`,
          type: RELATION_ELEMENT_TYPE,
          name: `Apply Preflight ${suffix}`,
          parentId: workspace.get('id'),
          visible: true,
          lock: false,
          props: relationProps(`apply-preflight-property-${suffix}`)
        }) satisfies ElementRawData
    )
    const ownerRelations = elements.map(
      (element) =>
        ({
          ownerElementId: element.id,
          ownerElementType: element.type,
          ownerPropertyName: RELATION_PROPERTY_NAME,
          componentId: (element.props as Record<string, string>)[
            RELATION_PROPERTY_NAME
          ]
        }) satisfies ElementPropertyRelation
    )
    const preparedMutation = sceneTree.prepareElementInsertion({
      parentId: workspace.get('id'),
      elements,
      ownerRelations
    })
    activeProperties.set(ownerRelations[0].componentId, {
      get: (key) =>
        key === 'id' ? ownerRelations[0].componentId : RELATION_PROPERTY_TYPE
    })
    const createElement = vi.spyOn(sceneTree, 'createElement')
    const transactionOwner = createTransactionOwner()

    expect(() =>
      runWithTransactionOwner(transactionOwner, () =>
        sceneTree.applyPreparedElementMutation(preparedMutation)
      )
    ).toThrow(/stale property relation|active property/i)

    expect(createElement).not.toHaveBeenCalled()
    expect(transactionOwner.updateTransactionBatch).not.toHaveBeenCalled()
    expect(workspace.get('children')).toEqual(childrenBefore)
    expect(sceneTree.getElementById(elements[0].id)).toBeUndefined()
    expect(sceneTree.getElementById(elements[1].id)).toBeUndefined()
    expect(sceneTree.changes).toEqual([])
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('detaches insertion data and owner relations before apply', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const originalPropertyId = 'detached-insertion-property'
    const data = {
      id: 'detached-insertion-element',
      type: RELATION_ELEMENT_TYPE,
      name: 'Detached Insertion Element',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: relationProps(originalPropertyId)
    } satisfies ElementRawData
    const ownerRelations: ElementPropertyRelation[] = [
      {
        ownerElementId: data.id,
        ownerElementType: data.type,
        ownerPropertyName: RELATION_PROPERTY_NAME,
        componentId: originalPropertyId
      }
    ]
    const preparedMutation = sceneTree.prepareElementInsertion({
      parentId: workspace.get('id'),
      elements: [data],
      ownerRelations
    })
    data.name = 'Caller-only name'
    ;(data.props as Record<string, string>)[RELATION_PROPERTY_NAME] =
      'caller-only-property'
    ;(
      ownerRelations[0] as {
        componentId: string
      }
    ).componentId = 'caller-only-property'
    activeProperties.set(originalPropertyId, {
      get: (key) => (key === 'id' ? originalPropertyId : RELATION_PROPERTY_TYPE)
    })

    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(preparedMutation)
    )

    expect(
      sceneTree.getElementById('detached-insertion-element')?.save()
    ).toEqual(
      expect.objectContaining({
        name: 'Detached Insertion Element',
        props: {
          [RELATION_PROPERTY_NAME]: originalPropertyId
        }
      })
    )
  })

  it('preserves the primary rejected handoff while attempting every insertion cleanup', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const childrenBefore = [...workspace.get('children')]
    const propertyId = 'cleanup-shared-property'
    const elements = ['first', 'second'].map(
      (suffix) =>
        ({
          id: `cleanup-rejected-${suffix}`,
          type: CLEANUP_RELATION_ELEMENT_TYPE,
          name: `Cleanup Rejected ${suffix}`,
          parentId: workspace.get('id'),
          visible: true,
          lock: false,
          props: relationProps(propertyId)
        }) satisfies ElementRawData
    )
    const ownerRelations = elements.map(
      (element) =>
        ({
          ownerElementId: element.id,
          ownerElementType: element.type,
          ownerPropertyName: RELATION_PROPERTY_NAME,
          componentId: propertyId
        }) satisfies ElementPropertyRelation
    )
    const preparedMutation = sceneTree.prepareElementInsertion({
      parentId: workspace.get('id'),
      elements,
      ownerRelations
    })
    activeProperties.set(propertyId, {
      get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
    })
    CleanupRelationMutationElement.disposeFailureElementId = elements[0].id
    const primaryFailure = new Error('primary insertion handoff rejection')
    const transactionOwner = createTransactionOwner(
      vi.fn(() => {
        throw primaryFailure
      })
    )

    let thrown: unknown
    try {
      runWithTransactionOwner(transactionOwner, () =>
        sceneTree.applyPreparedElementMutation(preparedMutation)
      )
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBe(primaryFailure)
    expect(CleanupRelationMutationElement.disposeAttempts).toEqual(
      elements.map(({ id }) => id)
    )
    expect(CleanupRelationMutationElement.materialized).toHaveLength(2)
    expect(
      CleanupRelationMutationElement.materialized.map((element) =>
        element.get('parentId')
      )
    ).toEqual(['', ''])
    expect(workspace.get('children')).toEqual(childrenBefore)
    elements.forEach(({ id }) => {
      expect(sceneTree.getElementById(id)).toBeUndefined()
      expect(sceneTree._deletedMap.has(id)).toBe(false)
    })
    expect(transactionOwner.updateTransactionBatch).toHaveBeenCalledOnce()
    expect(sceneTree.changes).toEqual([])
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('rejects in-place registration definition drift before reading Props', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const propertyId = 'registration-drift-property'
    const data = {
      id: 'registration-drift-element',
      type: RELATION_ELEMENT_TYPE,
      name: 'Registration Drift Element',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: relationProps(propertyId)
    } satisfies ElementRawData
    const preparedMutation = sceneTree.prepareElementInsertion({
      parentId: workspace.get('id'),
      elements: [data],
      ownerRelations: [
        {
          ownerElementId: data.id,
          ownerElementType: data.type,
          ownerPropertyName: RELATION_PROPERTY_NAME,
          componentId: propertyId
        }
      ]
    })
    activeProperties.set(propertyId, {
      get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
    })
    const registration = componentRegistry.get(RELATION_ELEMENT_TYPE)
    expect(registration).toBeDefined()
    const originalType = registration?.properties[0]?.type
    ;(
      registration?.properties[0] as {
        type: string
      }
    ).type = SECOND_RELATION_PROPERTY_TYPE
    const createElement = vi.spyOn(sceneTree, 'createElement')

    try {
      expect(() =>
        runWithTransactionOwner(createTransactionOwner(), () =>
          sceneTree.applyPreparedElementMutation(preparedMutation)
        )
      ).toThrow(/stale.*registration|stale.*relation/i)
      expect(propsManagerOwner.getPropertyById).not.toHaveBeenCalled()
      expect(createElement).not.toHaveBeenCalled()
      expect(sceneTree.getElementById(data.id)).toBeUndefined()
    } finally {
      ;(
        registration?.properties[0] as {
          type: string
        }
      ).type = originalType as string
    }
  })

  it('rejects in-place constructor relation drift before reading Props', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const propertyId = 'constructor-drift-property'
    const data = {
      id: 'constructor-drift-element',
      type: MUTABLE_RELATION_ELEMENT_TYPE,
      name: 'Constructor Drift Element',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: relationProps(propertyId)
    } satisfies ElementRawData
    const preparedMutation = sceneTree.prepareElementInsertion({
      parentId: workspace.get('id'),
      elements: [data],
      ownerRelations: [
        {
          ownerElementId: data.id,
          ownerElementType: data.type,
          ownerPropertyName: RELATION_PROPERTY_NAME,
          componentId: propertyId
        }
      ]
    })
    activeProperties.set(propertyId, {
      get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
    })
    const definition =
      MutableRelationMutationElement.ordinaryPropertyDefinitions[0]
    const originalType = definition.type
    definition.type = SECOND_RELATION_PROPERTY_TYPE
    const createElement = vi.spyOn(sceneTree, 'createElement')

    try {
      expect(() =>
        runWithTransactionOwner(createTransactionOwner(), () =>
          sceneTree.applyPreparedElementMutation(preparedMutation)
        )
      ).toThrow(/stale.*registration|stale.*constructor|stale.*relation/i)
      expect(propsManagerOwner.getPropertyById).not.toHaveBeenCalled()
      expect(createElement).not.toHaveBeenCalled()
      expect(sceneTree.getElementById(data.id)).toBeUndefined()
    } finally {
      definition.type = originalType
    }
  })

  it.each(['ordinary', 'canonical'] as const)(
    'rejects %s insertion when one component id has incompatible property types',
    (lifecycle) => {
      const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
      const propertyId = `incompatible-${lifecycle}-shared-property`
      const elements = [
        {
          id: `incompatible-${lifecycle}-first`,
          type: RELATION_ELEMENT_TYPE,
          name: `Incompatible ${lifecycle} First`,
          parentId: workspace.get('id'),
          visible: true,
          lock: false,
          props: relationProps(propertyId)
        },
        {
          id: `incompatible-${lifecycle}-second`,
          type: SECOND_RELATION_ELEMENT_TYPE,
          name: `Incompatible ${lifecycle} Second`,
          parentId: workspace.get('id'),
          visible: true,
          lock: false,
          props: relationProps(propertyId)
        }
      ] satisfies ElementRawData[]

      expect(() => {
        if (lifecycle === 'ordinary') {
          sceneTree.prepareElementInsertion({
            parentId: workspace.get('id'),
            elements,
            ownerRelations: elements.map((element) => ({
              ownerElementId: element.id,
              ownerElementType: element.type,
              ownerPropertyName: RELATION_PROPERTY_NAME,
              componentId: propertyId
            }))
          })
          return
        }
        sceneTree.prepareCanonicalElementInsertion({
          entries: elements.map((data, offset) => ({
            data,
            parentId: workspace.get('id'),
            index: workspace.get('children').length + offset
          }))
        })
      }).toThrow(/component.*type|incompatible.*property/i)

      expect(propsManagerOwner.getPropertyById).not.toHaveBeenCalled()
      expect(sceneTree.getElementById(elements[0].id)).toBeUndefined()
      expect(sceneTree.getElementById(elements[1].id)).toBeUndefined()
      expect(sceneTree.changes).toEqual([])
      expect(propsManagerOwner.changes).toEqual([])
    }
  )

  it('keeps empty insertion prepared mutations transaction-free and rejects orphan relations', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const ordinary = sceneTree.prepareElementInsertion({
      parentId: workspace.get('id'),
      elements: [],
      ownerRelations: []
    })
    const canonical = sceneTree.prepareCanonicalElementInsertion({
      entries: []
    })

    expect(canonical.ownerRelations).toEqual([])
    expect(Object.isFrozen(canonical.ownerRelations)).toBe(true)
    expect(sceneTree.applyPreparedElementMutation(ordinary)).toEqual({
      orderedElementIds: [],
      evidence: []
    })
    expect(sceneTree.applyPreparedElementMutation(canonical)).toEqual({
      orderedElementIds: [],
      evidence: []
    })
    expect(() =>
      sceneTree.prepareElementInsertion({
        parentId: workspace.get('id'),
        elements: [],
        ownerRelations: [
          {
            ownerElementId: 'orphan-owner',
            ownerElementType: RELATION_ELEMENT_TYPE,
            ownerPropertyName: RELATION_PROPERTY_NAME,
            componentId: 'orphan-property'
          }
        ]
      })
    ).toThrow(/outside.*insertion batch|orphan/i)
    expect(propsManagerOwner.getPropertyById).not.toHaveBeenCalled()
    expect(sceneTree.changes).toEqual([])
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('adds the Scene shared channel while preserving caller event options', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const cases = [
      {
        id: 'default-shared-undefined',
        options: undefined,
        expectedOptions: {
          shared: SharedDataChannelNames.SCENE_TREE
        }
      },
      {
        id: 'default-shared-undoable',
        options: {
          undoable: true
        },
        expectedOptions: {
          undoable: true,
          shared: SharedDataChannelNames.SCENE_TREE
        }
      },
      {
        id: 'explicit-shared-channel',
        options: {
          undoable: false,
          shared: SharedDataChannelNames.PROPS
        },
        expectedOptions: {
          undoable: false,
          shared: SharedDataChannelNames.PROPS
        }
      }
    ] as const

    cases.forEach(({ id, options, expectedOptions }) => {
      const preparedMutation = sceneTree.prepareElementInsertion({
        parentId: workspace.get('id'),
        elements: [
          {
            id,
            type: RAW_ELEMENT_TYPE,
            name: id,
            parentId: workspace.get('id'),
            visible: true,
            lock: false,
            props: emptyProps()
          }
        ],
        ownerRelations: []
      })
      const transactionOwner = createTransactionOwner()

      runWithTransactionOwner(transactionOwner, () =>
        sceneTree.applyPreparedElementMutation(preparedMutation, options)
      )

      const events = transactionOwner.updateTransactionBatch.mock
        .calls[0]?.[0] as readonly UpdateTransactionEvent[]
      expect(events).toHaveLength(1)
      expect(events[0]?.options).toEqual(expectedOptions)
      expect(events[0]?.canonicalEvidence).toMatchObject({
        orderedIds: [id]
      })
    })
  })

  it('applies one insertion preparedMutation with one parent replacement and one owner batch', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const source = [
      {
        id: 'prepared-insertion-first',
        type: RAW_ELEMENT_TYPE,
        name: 'Inserted First',
        parentId: workspace.get('id'),
        visible: true,
        lock: false,
        props: emptyProps()
      },
      {
        id: 'prepared-insertion-second',
        type: RAW_ELEMENT_TYPE,
        name: 'Inserted Second',
        parentId: workspace.get('id'),
        visible: true,
        lock: false,
        props: emptyProps()
      }
    ] satisfies ElementRawData[]
    const preparedMutation = sceneTree.prepareElementInsertion({
      parentId: workspace.get('id'),
      index: 1,
      elements: source,
      ownerRelations: []
    })
    source[0].name = 'Caller mutation'
    const transactionOwner = createTransactionOwner()

    const result = runWithTransactionOwner(transactionOwner, () =>
      sceneTree.applyPreparedElementMutation(preparedMutation, {
        shared: SharedDataChannelNames.SCENE_TREE
      })
    )

    expect(result.orderedElementIds).toEqual([
      'prepared-insertion-first',
      'prepared-insertion-second'
    ])
    expect(workspace.get('children')).toEqual([
      'raw-mutation-first',
      'prepared-insertion-first',
      'prepared-insertion-second',
      'raw-mutation-second'
    ])
    expect(
      sceneTree.getElementById('prepared-insertion-first')?.get('name')
    ).toBe('Inserted First')
    expect(transactionOwner.updateTransactionBatch).toHaveBeenCalledOnce()
    const events = transactionOwner.updateTransactionBatch.mock
      .calls[0]?.[0] as readonly UpdateTransactionEvent[]
    expect(events).toHaveLength(1)
    const payload = events[0]?.payload as AddRemoveElementsChange
    expect(payload.action).toBe(SCENE_TREE_ACTIONS.ADD_ELEMENTS)
    expect(payload.entries.map(({ data }) => data.id)).toEqual([
      'prepared-insertion-first',
      'prepared-insertion-second'
    ])
    expect(transactionOwner.updateTransactionBatch.mock.calls[0]).toHaveLength(
      1
    )
    expect(events[0]?.canonicalEvidence).toMatchObject({
      orderedIds: ['prepared-insertion-first', 'prepared-insertion-second']
    })
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('rolls back an insertion prefix when the owner rejects its batch', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const childrenBefore = [...workspace.get('children')]
    const preparedMutation = sceneTree.prepareCanonicalElementInsertion({
      entries: [
        {
          data: {
            id: 'rejected-insertion',
            type: RAW_ELEMENT_TYPE,
            name: 'Rejected',
            parentId: workspace.get('id'),
            visible: true,
            lock: false,
            props: emptyProps()
          },
          parentId: workspace.get('id'),
          index: childrenBefore.length
        }
      ]
    })
    const transactionOwner = createTransactionOwner(
      vi.fn(() => {
        throw new Error('reject insertion batch')
      })
    )

    expect(() =>
      runWithTransactionOwner(transactionOwner, () =>
        sceneTree.applyPreparedElementMutation(preparedMutation)
      )
    ).toThrow(/reject insertion batch/i)

    expect(workspace.get('children')).toEqual(childrenBefore)
    expect(sceneTree.getElementById('rejected-insertion')).toBeUndefined()
    expect(propsManagerOwner.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
  })

  it('prepares ordinary and canonical removals without cleaning Props', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const laterInvalidChildren = [...workspace.get('children')]

    expect(() =>
      sceneTree.prepareElementRemoval(['raw-mutation-first', 'missing-removal'])
    ).toThrow(/missing-removal/i)
    expect(workspace.get('children')).toEqual(laterInvalidChildren)
    expect(sceneTree.getElementById('raw-mutation-first')).toBe(first)

    const exactRemoval = {
      data: second.save(),
      parentId: workspace.get('id'),
      index: 1
    }
    const preparedMutation = sceneTree.prepareCanonicalElementRemoval([
      exactRemoval
    ])
    const transactionOwner = createTransactionOwner()
    const result = runWithTransactionOwner(transactionOwner, () =>
      sceneTree.applyPreparedElementMutation(preparedMutation, {
        shared: SharedDataChannelNames.SCENE_TREE
      })
    )

    expect(result.orderedElementIds).toEqual(['raw-mutation-second'])
    expect(workspace.get('children')).toEqual(['raw-mutation-first'])
    expect(sceneTree.getElementById('raw-mutation-second')).toBeUndefined()
    expect(transactionOwner.updateTransactionBatch).toHaveBeenCalledOnce()
    const events = transactionOwner.updateTransactionBatch.mock
      .calls[0]?.[0] as readonly UpdateTransactionEvent[]
    expect(events).toHaveLength(1)
    const payload = events[0]?.payload as AddRemoveElementsChange
    expect(payload.action).toBe(SCENE_TREE_ACTIONS.REMOVE_ELEMENTS)
    expect(payload.entries.map(({ data }) => data.id)).toEqual([
      'raw-mutation-second'
    ])
    expect(transactionOwner.updateTransactionBatch.mock.calls[0]).toHaveLength(
      1
    )
    expect(events[0]?.canonicalEvidence).toMatchObject({
      orderedIds: ['raw-mutation-second']
    })
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('delegates public single-element removal to one typed Scene preparedMutation', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const exactRemoval = {
      data: first.save(),
      parentId: workspace.get('id'),
      index: 0
    }
    const prepareCanonicalElementRemoval = vi.fn(
      sceneTree.prepareCanonicalElementRemoval.bind(sceneTree)
    )
    const applyPreparedElementMutation = vi.fn(
      sceneTree.applyPreparedElementMutation.bind(sceneTree)
    )
    sceneTree.prepareCanonicalElementRemoval = prepareCanonicalElementRemoval
    sceneTree.applyPreparedElementMutation = applyPreparedElementMutation
    const transactionOwner = createTransactionOwner()

    const removed = runWithTransactionOwner(transactionOwner, () =>
      sceneTree.removeElement({ id: first.get('id') })
    )

    expect(removed).toBe(true)
    expect(prepareCanonicalElementRemoval).toHaveBeenCalledOnce()
    expect(prepareCanonicalElementRemoval).toHaveBeenCalledWith([exactRemoval])
    expect(applyPreparedElementMutation).toHaveBeenCalledOnce()
    expect(transactionOwner.updateTransactionBatch).toHaveBeenCalledOnce()
    expect(sceneTree.getElementById(first.get('id'))).toBeUndefined()
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('prepares one child-first subtree removal preparedMutation with one Scene evidence record', () => {
    const workspace = sceneTree.currentWorkspace as Workspace
    const root = new RawMutationGroup({
      id: 'typed-subtree-root',
      name: 'Typed Subtree Root',
      visible: true,
      lock: false
    })
    const nested = new RawMutationGroup({
      id: 'typed-subtree-nested',
      name: 'Typed Subtree Nested',
      visible: true,
      lock: false
    })
    const leaf = new RawMutationElement({
      id: 'typed-subtree-leaf',
      name: 'Typed Subtree Leaf',
      visible: true,
      lock: false
    })
    workspace.addNewElements([root])
    workspace.addNewElements([nested], root)
    workspace.addNewElements([leaf], nested)
    sceneTree.cleanChanges()
    const sceneBefore = sceneTree.save()

    expect(() => sceneTree.prepareElementRemoval([root.get('id')])).toThrow(
      /subtree lifecycle/i
    )

    const preparedMutation = sceneTree.prepareSubtreeRemoval(root.get('id'))
    const change = preparedMutation.evidence[0] as SubtreeChange

    expect(preparedMutation.kind).toBe('prepared-subtree-removal')
    expect(preparedMutation.orderedElementIds).toEqual([
      leaf.get('id'),
      nested.get('id'),
      root.get('id')
    ])
    expect(preparedMutation.evidence).toHaveLength(1)
    expect(change).toMatchObject({
      eventName: EventTypes.CHANGE_SUBTREE,
      elementId: root.get('id'),
      action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
      undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE
    })
    expect(change.removed.map(({ elementId }) => elementId)).toEqual(
      preparedMutation.orderedElementIds
    )
    expect(sceneTree.save()).toEqual(sceneBefore)

    const owner = createTransactionOwner()
    const result = runWithTransactionOwner(owner, () =>
      sceneTree.applyPreparedElementMutation(preparedMutation)
    )

    expect(result.orderedElementIds).toEqual(preparedMutation.orderedElementIds)
    expect(sceneTree.getElementById(root.get('id'))).toBeUndefined()
    expect(sceneTree.getElementById(nested.get('id'))).toBeUndefined()
    expect(sceneTree.getElementById(leaf.get('id'))).toBeUndefined()
    expect(owner.updateTransactionBatch).toHaveBeenCalledOnce()
    const events = owner.updateTransactionBatch.mock
      .calls[0]?.[0] as readonly UpdateTransactionEvent[]
    expect(events).toHaveLength(1)
    expect(events[0]?.canonicalEvidence).toEqual({
      orderedIds: preparedMutation.orderedElementIds
    })
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('prepares exact canonical subtree evidence without removing a prefix', () => {
    const workspace = sceneTree.currentWorkspace as Workspace
    const root = new RawMutationGroup({
      id: 'exact-subtree-root',
      name: 'Exact Subtree Root',
      visible: true,
      lock: false
    })
    const leaf = new RawMutationElement({
      id: 'exact-subtree-leaf',
      name: 'Exact Subtree Leaf',
      visible: true,
      lock: false
    })
    workspace.addNewElements([root])
    workspace.addNewElements([leaf], root)
    sceneTree.cleanChanges()

    const sourcePreparation = sceneTree.prepareSubtreeRemoval(root.get('id'))
    const sourceEvidence = sourcePreparation.evidence[0] as SubtreeChange
    const exactPreparation =
      sceneTree.prepareCanonicalSubtreeRemoval(sourceEvidence)

    expect(exactPreparation).not.toBe(sourcePreparation)
    expect(exactPreparation.evidence).toEqual(sourcePreparation.evidence)
    expect(exactPreparation.orderedElementIds).toEqual([
      leaf.get('id'),
      root.get('id')
    ])
    expect(sceneTree.getElementById(root.get('id'))).toBe(root)
    expect(sceneTree.getElementById(leaf.get('id'))).toBe(leaf)

    expect(() =>
      sceneTree.prepareCanonicalSubtreeRemoval({
        ...sourceEvidence,
        rootParentChildrenAfter: ['counterfeit-child']
      })
    ).toThrow(/stale canonical subtree removal/i)
    expect(sceneTree.getElementById(root.get('id'))).toBe(root)
    expect(sceneTree.getElementById(leaf.get('id'))).toBe(leaf)
    expect(sceneTree.changes).toEqual([])
  })

  it('routes public subtree removal through the typed preparedMutation and caller transaction owner', () => {
    const workspace = sceneTree.currentWorkspace as Workspace
    const root = new RawMutationGroup({
      id: 'public-typed-subtree-root',
      name: 'Public Typed Subtree Root',
      visible: true,
      lock: false
    })
    const child = new RawMutationElement({
      id: 'public-typed-subtree-child',
      name: 'Public Typed Subtree Child',
      visible: true,
      lock: false
    })
    workspace.addNewElements([root])
    workspace.addNewElements([child], root)
    sceneTree.cleanChanges()
    const sceneBefore = sceneTree.save()

    expect(() => sceneTree.removeSubtree(root.get('id'))).toThrow(
      /active transaction owner/i
    )
    expect(sceneTree.save()).toEqual(sceneBefore)

    const owner = createTransactionOwner()
    const result = runWithTransactionOwner(owner, () =>
      sceneTree.removeSubtree(root.get('id'))
    )
    expect(result.elementId).toBe(root.get('id'))
    expect(result.removed.map(({ elementId }) => elementId)).toEqual([
      child.get('id'),
      root.get('id')
    ])
    expect(owner.updateTransactionBatch).toHaveBeenCalledOnce()
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('retains a shared root and restores the complete subtree when owner handoff rejects', () => {
    const workspace = sceneTree.currentWorkspace as Workspace
    const propertyId = 'typed-subtree-shared-property'
    activeProperties.set(propertyId, {
      get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
    })
    const root = new RawMutationGroup({
      id: 'typed-subtree-shared-root',
      name: 'Typed Subtree Shared Root',
      visible: true,
      lock: false
    })
    const child = new RelationMutationElement({
      id: 'typed-subtree-shared-child',
      name: 'Typed Subtree Shared Child',
      visible: true,
      lock: false,
      props: relationProps(propertyId)
    })
    const retained = new RelationMutationElement({
      id: 'typed-subtree-shared-retained',
      name: 'Typed Subtree Shared Retained',
      visible: true,
      lock: false,
      props: relationProps(propertyId)
    })
    workspace.addNewElements([root, retained])
    workspace.addNewElements([child], root)
    sceneTree.cleanChanges()

    const preparedMutation = sceneTree.prepareSubtreeRemoval(root.get('id'))
    const retainedRelation = {
      ownerElementId: retained.get('id'),
      ownerElementType: retained.get('type'),
      ownerPropertyName: RELATION_PROPERTY_NAME,
      componentId: propertyId
    } satisfies ElementPropertyRelation
    expect(preparedMutation.orphanRootPropertyIds).toEqual([])
    expect(preparedMutation.retainedRootPropertyIds).toContain(propertyId)
    expect(preparedMutation.relationReleases).toEqual([
      expect.objectContaining({
        componentId: propertyId,
        retainedRelations: [retainedRelation]
      })
    ])

    const sceneBefore = sceneTree.save()
    const relationsBefore = sceneTree.getElementPropertyRelations(propertyId)
    const ownerFailure = new Error('typed subtree owner rejected')
    const owner = createTransactionOwner(
      vi.fn(() => {
        throw ownerFailure
      })
    )

    expect(() =>
      runWithTransactionOwner(owner, () =>
        sceneTree.applyPreparedElementMutation(preparedMutation)
      )
    ).toThrow(ownerFailure)
    expect(sceneTree.save()).toEqual(sceneBefore)
    expect(sceneTree.getElementPropertyRelations(propertyId)).toEqual(
      relationsBefore
    )
    expect(sceneTree.getElementById(root.get('id'))).toBe(root)
    expect(sceneTree.getElementById(child.get('id'))).toBe(child)
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('rejects a stale typed subtree parent without removing a prefix', () => {
    const workspace = sceneTree.currentWorkspace as Workspace
    const root = new RawMutationGroup({
      id: 'typed-subtree-stale-root',
      name: 'Typed Subtree Stale Root',
      visible: true,
      lock: false
    })
    const firstChild = new RawMutationElement({
      id: 'typed-subtree-stale-first',
      name: 'Typed Subtree Stale First',
      visible: true,
      lock: false
    })
    workspace.addNewElements([root])
    workspace.addNewElements([firstChild], root)
    sceneTree.cleanChanges()
    const preparedMutation = sceneTree.prepareSubtreeRemoval(root.get('id'))
    const laterChild = new RawMutationElement({
      id: 'typed-subtree-stale-later',
      name: 'Typed Subtree Stale Later',
      visible: true,
      lock: false
    })
    workspace.addNewElements([laterChild], root)
    sceneTree.cleanChanges()
    const sceneBefore = sceneTree.save()

    expect(() =>
      runWithTransactionOwner(createTransactionOwner(), () =>
        sceneTree.applyPreparedElementMutation(preparedMutation)
      )
    ).toThrow(/stale.*parent|stale.*removal/i)
    expect(sceneTree.save()).toEqual(sceneBefore)
    expect(sceneTree.getElementById(root.get('id'))).toBe(root)
    expect(sceneTree.getElementById(firstChild.get('id'))).toBe(firstChild)
    expect(sceneTree.getElementById(laterChild.get('id'))).toBe(laterChild)
  })

  it('records retained and final-orphan relation releases without cleaning Props', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const propertyId = 'shared-removal-property'
    activeProperties.set(propertyId, {
      get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
    })
    const elements = ['z', 'a'].map(
      (suffix) =>
        ({
          id: `shared-removal-element-${suffix}`,
          type: RELATION_ELEMENT_TYPE,
          name: `Shared Removal ${suffix}`,
          parentId: workspace.get('id'),
          visible: true,
          lock: false,
          props: relationProps(propertyId)
        }) satisfies ElementRawData
    )
    const ownerRelations = elements.map(
      (element) =>
        ({
          ownerElementId: element.id,
          ownerElementType: element.type,
          ownerPropertyName: RELATION_PROPERTY_NAME,
          componentId: propertyId
        }) satisfies ElementPropertyRelation
    )
    const insertion = sceneTree.prepareElementInsertion({
      parentId: workspace.get('id'),
      elements,
      ownerRelations
    })
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(insertion)
    )

    expect(sceneTree.getElementPropertyRelations(propertyId)).toEqual([
      ownerRelations[1],
      ownerRelations[0]
    ])

    const firstRemoval = sceneTree.prepareElementRemoval([elements[0].id])
    expect(firstRemoval.relationReleases).toEqual([
      {
        componentId: propertyId,
        relationsBefore: [ownerRelations[1], ownerRelations[0]],
        releasedRelations: [ownerRelations[0]],
        retainedRelations: [ownerRelations[1]]
      }
    ])
    expect(firstRemoval.orphanRootPropertyIds).toEqual([])
    expect(firstRemoval.retainedRootPropertyIds).toEqual([propertyId])
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(firstRemoval)
    )

    expect(sceneTree.getElementPropertyRelations(propertyId)).toEqual([
      ownerRelations[1]
    ])
    expect(activeProperties.has(propertyId)).toBe(true)
    expect(propsManagerOwner.changes).toEqual([])

    const finalRemoval = sceneTree.prepareCanonicalElementRemoval([
      {
        data: elements[1],
        parentId: workspace.get('id'),
        index: workspace.get('children').indexOf(elements[1].id)
      }
    ])
    expect(finalRemoval.relationReleases).toEqual([
      {
        componentId: propertyId,
        relationsBefore: [ownerRelations[1]],
        releasedRelations: [ownerRelations[1]],
        retainedRelations: []
      }
    ])
    expect(finalRemoval.orphanRootPropertyIds).toEqual([propertyId])
    expect(finalRemoval.retainedRootPropertyIds).toEqual([])
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(finalRemoval)
    )

    expect(sceneTree.getElementPropertyRelations(propertyId)).toEqual([])
    expect(activeProperties.has(propertyId)).toBe(true)
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('deduplicates one orphan root when a batch releases every shared relation', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const propertyId = 'batch-orphan-property'
    activeProperties.set(propertyId, {
      get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
    })
    const elements = ['first', 'second'].map(
      (suffix) =>
        ({
          id: `batch-orphan-element-${suffix}`,
          type: RELATION_ELEMENT_TYPE,
          name: `Batch Orphan ${suffix}`,
          parentId: workspace.get('id'),
          visible: true,
          lock: false,
          props: relationProps(propertyId)
        }) satisfies ElementRawData
    )
    const ownerRelations = elements.map((element) => ({
      ownerElementId: element.id,
      ownerElementType: element.type,
      ownerPropertyName: RELATION_PROPERTY_NAME,
      componentId: propertyId
    }))
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(
        sceneTree.prepareElementInsertion({
          parentId: workspace.get('id'),
          elements,
          ownerRelations
        })
      )
    )

    const preparedMutation = sceneTree.prepareElementRemoval(
      elements.map(({ id }) => id)
    )

    expect(preparedMutation.orphanRootPropertyIds).toEqual([propertyId])
    expect(preparedMutation.retainedRootPropertyIds).toEqual([])
    expect(preparedMutation.relationReleases).toHaveLength(1)
    expect(
      preparedMutation.relationReleases[0]?.releasedRelations
    ).toHaveLength(2)
    expect(preparedMutation.relationReleases[0]?.retainedRelations).toEqual([])
  })

  it('reports every retained Scene root when an orphan graph may contain another element root', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const orphanRootId = 'nested-retained-root-r'
    const retainedChildRootId = 'nested-retained-root-c'
    ;[orphanRootId, retainedChildRootId].forEach((propertyId) => {
      activeProperties.set(propertyId, {
        get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
      })
    })
    const elements = [
      {
        id: 'nested-retained-root-owner-a',
        type: RELATION_ELEMENT_TYPE,
        name: 'Root R Owner',
        parentId: workspace.get('id'),
        visible: true,
        lock: false,
        props: relationProps(orphanRootId)
      },
      {
        id: 'nested-retained-root-owner-b',
        type: RELATION_ELEMENT_TYPE,
        name: 'Root C Owner',
        parentId: workspace.get('id'),
        visible: true,
        lock: false,
        props: relationProps(retainedChildRootId)
      }
    ] satisfies readonly ElementRawData[]
    const ownerRelations = elements.map((element) => ({
      ownerElementId: element.id,
      ownerElementType: element.type,
      ownerPropertyName: RELATION_PROPERTY_NAME,
      componentId: (element.props as Readonly<Record<string, string>>)[
        RELATION_PROPERTY_NAME
      ]
    }))
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(
        sceneTree.prepareElementInsertion({
          parentId: workspace.get('id'),
          elements,
          ownerRelations
        })
      )
    )

    const preparedMutation = sceneTree.prepareElementRemoval([elements[0].id])

    expect(preparedMutation.orphanRootPropertyIds).toEqual([orphanRootId])
    expect(preparedMutation.retainedRootPropertyIds).toEqual([
      retainedChildRootId
    ])
    expect(activeProperties.has(retainedChildRootId)).toBe(true)
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('prepares a large shared relation release with linear indexed reads', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const propertyId = 'linear-shared-relation-property'
    activeProperties.set(propertyId, {
      get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
    })
    const elements = Array.from(
      { length: 128 },
      (_, index) =>
        ({
          id: `linear-shared-relation-${index}`,
          type: RELATION_ELEMENT_TYPE,
          name: `Linear Shared Relation ${index}`,
          parentId: workspace.get('id'),
          visible: true,
          lock: false,
          props: relationProps(propertyId)
        }) satisfies ElementRawData
    )
    const ownerRelations = elements.map((element) => ({
      ownerElementId: element.id,
      ownerElementType: element.type,
      ownerPropertyName: RELATION_PROPERTY_NAME,
      componentId: propertyId
    }))
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(
        sceneTree.prepareElementInsertion({
          parentId: workspace.get('id'),
          elements,
          ownerRelations
        })
      )
    )

    const relations = sceneTree.getElementPropertyRelations(propertyId)
    const find = vi.spyOn(Array.prototype, 'find')
    const findCallsBefore = find.mock.calls.length

    try {
      const preparedMutation = sceneTree.prepareElementRemoval(
        elements.map(({ id }) => id)
      )

      expect(preparedMutation.orphanRootPropertyIds).toEqual([propertyId])
      expect(find.mock.calls.length - findCallsBefore).toBeLessThanOrEqual(2)
      expect(relations).toHaveLength(elements.length)
    } finally {
      find.mockRestore()
    }
  })

  it('keeps the active Scene and relation index unchanged when a later load relation is missing', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const baselinePropertyId = 'load-baseline-relation'
    activeProperties.set(baselinePropertyId, {
      get: (key) => (key === 'id' ? baselinePropertyId : RELATION_PROPERTY_TYPE)
    })
    const baselineData = {
      id: 'load-baseline-element',
      type: RELATION_ELEMENT_TYPE,
      name: 'Load Baseline',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: relationProps(baselinePropertyId)
    } satisfies ElementRawData
    const baselineRelation = {
      ownerElementId: baselineData.id,
      ownerElementType: baselineData.type,
      ownerPropertyName: RELATION_PROPERTY_NAME,
      componentId: baselinePropertyId
    } satisfies ElementPropertyRelation
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(
        sceneTree.prepareElementInsertion({
          parentId: workspace.get('id'),
          elements: [baselineData],
          ownerRelations: [baselineRelation]
        })
      )
    )
    const sceneBefore = sceneTree.save()
    const replacement = structuredClone(sceneBefore)
    const validPropertyId = 'load-valid-relation'
    const missingPropertyId = 'load-missing-relation'
    activeProperties.set(validPropertyId, {
      get: (key) => (key === 'id' ? validPropertyId : RELATION_PROPERTY_TYPE)
    })
    appendElementToLoadSnapshot(replacement, {
      id: 'load-valid-element',
      type: RELATION_ELEMENT_TYPE,
      name: 'Load Valid',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: relationProps(validPropertyId)
    })
    appendElementToLoadSnapshot(replacement, {
      id: 'load-later-invalid-element',
      type: RELATION_ELEMENT_TYPE,
      name: 'Load Later Invalid',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: relationProps(missingPropertyId)
    })
    const validation = sceneTree.validateLoadData(replacement)

    expect(() => sceneTree.applyValidatedLoad(validation)).toThrow(
      /load-later-invalid-element|load-missing-relation/i
    )

    expect(sceneTree.save()).toEqual(sceneBefore)
    expect(sceneTree.getElementPropertyRelations(baselinePropertyId)).toEqual([
      baselineRelation
    ])
    expect(sceneTree.getElementPropertyRelations(validPropertyId)).toEqual([])
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('preflights detached load relations without reading active Props or consuming the Scene artifact', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const replacement = structuredClone(sceneTree.save())
    const propertyId = 'detached-load-relation'
    appendElementToLoadSnapshot(replacement, {
      id: 'detached-load-element',
      type: RELATION_ELEMENT_TYPE,
      name: 'Detached Load Element',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: relationProps(propertyId)
    })
    appendElementToLoadSnapshot(replacement, {
      id: 'detached-load-shared-element',
      type: RELATION_ELEMENT_TYPE,
      name: 'Detached Load Shared Element',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: relationProps(propertyId)
    })
    const validation = sceneTree.validateLoadData(replacement)
    const detachedProps = {
      [propertyId]: {
        id: propertyId,
        type: RELATION_PROPERTY_TYPE
      }
    } as PropsComponentRawData
    const activeReadCountBefore = vi.mocked(propsManagerOwner.getPropertyById)
      .mock.calls.length
    const sceneBefore = sceneTree.save()

    sceneTree.preflightLoadPropertyRelations(validation, detachedProps)
    sceneTree.preflightLoadPropertyRelations(validation, detachedProps)

    expect(vi.mocked(propsManagerOwner.getPropertyById).mock.calls.length).toBe(
      activeReadCountBefore
    )
    expect(sceneTree.save()).toEqual(sceneBefore)
    expect(() =>
      sceneTree.preflightLoadPropertyRelations(validation, {})
    ).toThrow(/detached-load-element|detached-load-relation/i)
    expect(sceneTree.save()).toEqual(sceneBefore)
  })

  it.each([
    {
      label: 'a mismatched raw component id',
      propertyData: {
        id: 'detached-load-other-id',
        type: RELATION_PROPERTY_TYPE
      }
    },
    {
      label: 'a mismatched property type',
      propertyData: {
        id: 'detached-load-invalid-property',
        type: SECOND_RELATION_PROPERTY_TYPE
      }
    }
  ])(
    'rejects detached load relations with $label without consuming the artifact',
    ({ propertyData }) => {
      const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
      const propertyId = 'detached-load-invalid-property'
      const replacement = structuredClone(sceneTree.save())
      appendElementToLoadSnapshot(replacement, {
        id: 'detached-load-invalid-element',
        type: RELATION_ELEMENT_TYPE,
        name: 'Detached Load Invalid Element',
        parentId: workspace.get('id'),
        visible: true,
        lock: false,
        props: relationProps(propertyId)
      })
      const validation = sceneTree.validateLoadData(replacement)
      const sceneBefore = sceneTree.save()
      const detachedProps = {
        [propertyId]: propertyData
      } as PropsComponentRawData

      expect(() =>
        sceneTree.preflightLoadPropertyRelations(validation, detachedProps)
      ).toThrow(/invalid detached property relation/i)
      expect(() =>
        sceneTree.preflightLoadPropertyRelations(validation, detachedProps)
      ).toThrow(/invalid detached property relation/i)
      expect(sceneTree.save()).toEqual(sceneBefore)
    }
  )

  it('rejects foreign and registration-stale detached load validation without active Props reads', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const propertyId = 'detached-load-stale-registration-property'
    const replacement = structuredClone(sceneTree.save())
    appendElementToLoadSnapshot(replacement, {
      id: 'detached-load-stale-registration-element',
      type: MUTABLE_RELATION_ELEMENT_TYPE,
      name: 'Detached Load Stale Registration Element',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: relationProps(propertyId)
    })
    const validation = sceneTree.validateLoadData(replacement)
    const detachedProps = {
      [propertyId]: {
        id: propertyId,
        type: RELATION_PROPERTY_TYPE
      }
    } as PropsComponentRawData
    const foreignSceneTree = new SceneTree(propsManagerOwner)
    const activeReadCountBefore = vi.mocked(propsManagerOwner.getPropertyById)
      .mock.calls.length

    expect(() =>
      foreignSceneTree.preflightLoadPropertyRelations(validation, detachedProps)
    ).toThrow(/owner-issued/i)

    const definition =
      MutableRelationMutationElement.ordinaryPropertyDefinitions[0]
    const originalType = definition.type
    definition.type = SECOND_RELATION_PROPERTY_TYPE
    try {
      expect(() =>
        sceneTree.preflightLoadPropertyRelations(validation, detachedProps)
      ).toThrow(/stale registered property slots/i)
    } finally {
      definition.type = originalType
    }
    expect(vi.mocked(propsManagerOwner.getPropertyById).mock.calls.length).toBe(
      activeReadCountBefore
    )
  })

  it.each([
    {
      label: 'wrong active property type',
      propertyName: RELATION_PROPERTY_NAME,
      propertyType: SECOND_RELATION_PROPERTY_TYPE
    },
    {
      label: 'unregistered element property slot',
      propertyName: 'unregistered-slot',
      propertyType: RELATION_PROPERTY_TYPE
    }
  ])(
    'rejects load relation preflight for $label before replacing Scene state',
    ({ propertyName, propertyType }) => {
      const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
      const propertyId = `invalid-load-relation-${propertyName}`
      activeProperties.set(propertyId, {
        get: (key) => (key === 'id' ? propertyId : propertyType)
      })
      const sceneBefore = sceneTree.save()
      const replacement = structuredClone(sceneBefore)
      appendElementToLoadSnapshot(replacement, {
        id: `invalid-load-element-${propertyName}`,
        type: RELATION_ELEMENT_TYPE,
        name: 'Invalid Load Relation',
        parentId: workspace.get('id'),
        visible: true,
        lock: false,
        props: {
          [propertyName]: propertyId
        } as ElementRawData['props']
      })
      const validation = sceneTree.validateLoadData(replacement)

      expect(() => sceneTree.applyValidatedLoad(validation)).toThrow(
        /property relation|property slot/i
      )

      expect(sceneTree.save()).toEqual(sceneBefore)
      expect(
        sceneTree.getElementById(`invalid-load-element-${propertyName}`)
      ).toBeUndefined()
      expect(propsManagerOwner.changes).toEqual([])
    }
  )

  it.each([
    {
      label: 'a missing registered slot',
      propertyId: 'restore-missing-slot-property',
      props: emptyProps(),
      activeType: RELATION_PROPERTY_TYPE
    },
    {
      label: 'a missing active property id',
      propertyId: 'restore-missing-active-property',
      props: relationProps('restore-missing-active-property'),
      activeType: undefined
    },
    {
      label: 'an active property with the wrong type',
      propertyId: 'restore-wrong-type-property',
      props: relationProps('restore-wrong-type-property'),
      activeType: SECOND_RELATION_PROPERTY_TYPE
    }
  ])(
    'rejects subtree restore preflight for $label without any owner prefix',
    ({ propertyId, props, activeType }) => {
      if (activeType) {
        activeProperties.set(propertyId, {
          get: (key) => (key === 'id' ? propertyId : activeType)
        })
      }
      const data = {
        id: `restore-contract-${propertyId}`,
        type: RESTORE_CONTRACT_ELEMENT_TYPE,
        name: 'Restore Contract Invalid Relation',
        parentId: sceneTree.workspace,
        visible: true,
        lock: false,
        props
      } satisfies ElementRawData
      const snapshot = createDetachedRestoreSnapshot(sceneTree, data)
      const sceneBefore = sceneTree.save()
      const propsBefore = propsManagerOwner.save()

      expect(() => sceneTree.preflightRestoreSubtree(snapshot)).toThrow(
        /property|slot|relation/i
      )

      expect(sceneTree.save()).toEqual(sceneBefore)
      expect(sceneTree.getElementPropertyRelations(propertyId)).toEqual([])
      expect(propsManagerOwner.save()).toEqual(propsBefore)
      expect(propsManagerOwner.changes).toEqual([])
      expect(RestoreContractElement.materializedIds).toEqual([])
    }
  )

  it('rejects a stale subtree restore registration before materialization', () => {
    const propertyId = 'restore-stale-registration-property'
    activeProperties.set(propertyId, {
      get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
    })
    const data = {
      id: 'restore-stale-registration-element',
      type: RESTORE_CONTRACT_ELEMENT_TYPE,
      name: 'Restore Stale Registration Element',
      parentId: sceneTree.workspace,
      visible: true,
      lock: false,
      props: relationProps(propertyId)
    } satisfies ElementRawData
    const snapshot = createDetachedRestoreSnapshot(sceneTree, data)
    const preparedMutation = sceneTree.preflightRestoreSubtree(snapshot)
    const sceneBefore = sceneTree.save()
    const propsBefore = propsManagerOwner.save()

    componentRegistry.unregister(RESTORE_CONTRACT_ELEMENT_TYPE)
    componentRegistry.register({
      type: RESTORE_CONTRACT_ELEMENT_TYPE,
      idPrefix: RESTORE_CONTRACT_ELEMENT_TYPE,
      namePrefix: 'Restore Contract Element',
      constructor: RestoreContractElement,
      properties: [...RelationMutationElement.ordinaryPropertyDefinitions],
      defaults: {}
    })

    expect(() => sceneTree.applyRestoreSubtree(preparedMutation)).toThrow(
      /stale.*registered|registration/i
    )

    expect(sceneTree.save()).toEqual(sceneBefore)
    expect(sceneTree.getElementPropertyRelations(propertyId)).toEqual([])
    expect(propsManagerOwner.save()).toEqual(propsBefore)
    expect(propsManagerOwner.changes).toEqual([])
    expect(RestoreContractElement.materializedIds).toEqual([])
  })

  it('attempts every subtree restore rollback stage while preserving the primary failure', () => {
    const workspace = sceneTree.currentWorkspace as Workspace
    const propertyId = 'restore-all-attempt-property'
    activeProperties.set(propertyId, {
      get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
    })
    const element = new CleanupRelationMutationElement({
      id: 'restore-all-attempt-element',
      name: 'Restore All Attempt Element',
      visible: true,
      lock: false,
      props: relationProps(propertyId)
    })
    workspace.addNewElements([element])
    vi.spyOn(element, 'getAllComputedData').mockReturnValue({})
    sceneTree.cleanChanges()
    const removed = runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.removeSubtree(element.get('id'))
    )
    const preparedMutation = sceneTree.preflightRestoreSubtree(removed)
    CleanupRelationMutationElement.disposeAttempts = []
    CleanupRelationMutationElement.disposeFailureElementId = element.get('id')

    const primaryFailure = new Error('primary restore hierarchy failure')
    const cleanupFailure = new Error('cleanup parent restoration failure')
    const replaceBatchParentChildren =
      workspace.replaceBatchParentChildren.bind(workspace)
    let replacementAttempt = 0
    workspace.replaceBatchParentChildren = vi.fn((parent, children) => {
      replacementAttempt += 1
      if (replacementAttempt === 1) {
        throw primaryFailure
      }
      if (replacementAttempt === 2) {
        throw cleanupFailure
      }
      replaceBatchParentChildren(parent, children)
    })

    let capturedFailure: unknown
    try {
      sceneTree.applyRestoreSubtree(preparedMutation)
    } catch (error) {
      capturedFailure = error
    } finally {
      workspace.replaceBatchParentChildren = replaceBatchParentChildren
    }

    expect(capturedFailure).toBe(primaryFailure)
    expect(replacementAttempt).toBeGreaterThanOrEqual(2)
    expect(CleanupRelationMutationElement.disposeAttempts).toEqual([
      element.get('id')
    ])
    expect(sceneTree.getElementById(element.get('id'))).toBeUndefined()
    expect(sceneTree._deletedMap.get(element.get('id'))).toBe(element)
    expect(sceneTree.getElementPropertyRelations(propertyId)).toEqual([])
    expect(element.get('parentId')).toBe('')
    expect(workspace.get('children')).toEqual(removed.rootParentChildrenAfter)
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('uses bounded strategy lookups while rolling back a large subtree restore', () => {
    const workspace = sceneTree.currentWorkspace as Workspace
    const group = new RawMutationGroup({
      id: 'restore-strategy-group',
      name: 'Restore Strategy Group',
      visible: true,
      lock: false
    })
    const children = Array.from(
      { length: 128 },
      (_, index) =>
        new RawMutationElement({
          id: `restore-strategy-child-${index}`,
          name: `Restore Strategy Child ${index}`,
          visible: true,
          lock: false
        })
    )
    workspace.addNewElements([group])
    workspace.addNewElements(children, group)
    const removedElements = [group, ...children]
    removedElements.forEach((element) => {
      vi.spyOn(element, 'getAllComputedData').mockReturnValue({})
    })
    sceneTree.cleanChanges()
    const removed = runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.removeSubtree(group.get('id'))
    )
    const preparedMutation = sceneTree.preflightRestoreSubtree(removed)
    const primaryFailure = new Error('reject large restore hierarchy')
    const replaceBatchParentChildren =
      workspace.replaceBatchParentChildren.bind(workspace)
    let replacementAttempt = 0
    workspace.replaceBatchParentChildren = vi.fn((parent, nextChildren) => {
      replacementAttempt += 1
      if (replacementAttempt === 1) {
        throw primaryFailure
      }
      replaceBatchParentChildren(parent, nextChildren)
    })
    const find = vi.spyOn(Array.prototype, 'find')
    const findCallsBefore = find.mock.calls.length

    let capturedFailure: unknown
    try {
      sceneTree.applyRestoreSubtree(preparedMutation)
    } catch (error) {
      capturedFailure = error
    } finally {
      workspace.replaceBatchParentChildren = replaceBatchParentChildren
    }
    const restoreFindCalls = find.mock.calls.length - findCallsBefore
    find.mockRestore()

    expect(capturedFailure).toBe(primaryFailure)
    expect(restoreFindCalls).toBeLessThanOrEqual(4)
    expect(sceneTree.getElementById(group.get('id'))).toBeUndefined()
    expect(sceneTree._deletedMap.get(group.get('id'))).toBe(group)
    expect(
      children.every(
        (element) => sceneTree._deletedMap.get(element.get('id')) === element
      )
    ).toBe(true)
  })

  it('keeps the relation index equivalent through subtree removal and typed restore', () => {
    const propertyId = 'subtree-restore-relation'
    activeProperties.set(propertyId, {
      get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
    })
    const group = new RawMutationGroup({
      id: 'subtree-relation-group',
      name: 'Subtree Relation Group',
      visible: true,
      lock: false
    })
    ;(sceneTree.currentWorkspace as Workspace).addNewElements([group])
    const data = {
      id: 'subtree-relation-child',
      type: RELATION_ELEMENT_TYPE,
      name: 'Subtree Relation Child',
      parentId: group.get('id'),
      visible: true,
      lock: false,
      props: relationProps(propertyId)
    } satisfies ElementRawData
    const relation = {
      ownerElementId: data.id,
      ownerElementType: data.type,
      ownerPropertyName: RELATION_PROPERTY_NAME,
      componentId: propertyId
    } satisfies ElementPropertyRelation
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(
        sceneTree.prepareElementInsertion({
          parentId: group.get('id'),
          elements: [data],
          ownerRelations: [relation]
        })
      )
    )
    const child = sceneTree.getElementById(data.id)
    if (!child) {
      throw new Error('Expected subtree relation child')
    }
    ;[group, child].forEach((element) => {
      ;(
        element as unknown as {
          computed: { dispose: ReturnType<typeof vi.fn> }
        }
      ).computed = { dispose: vi.fn() }
      vi.spyOn(element, 'getAllComputedData').mockReturnValue({})
    })
    sceneTree.cleanChanges()

    const removed = runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.removeSubtree(group.get('id'))
    )
    expect(sceneTree.getElementPropertyRelations(propertyId)).toEqual([])

    const preparedRestore = sceneTree.preflightRestoreSubtree(removed)
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyRestoreSubtree(preparedRestore)
    )

    expect(sceneTree.getElementPropertyRelations(propertyId)).toEqual([
      relation
    ])
    expect(sceneTree.getElementById(data.id)?.save()).toEqual(data)
    expect(propsManagerOwner.changes).toEqual([])
  })

  it('rejects a stale relation-set removal before any Scene write', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const propertyId = 'stale-relation-set-property'
    activeProperties.set(propertyId, {
      get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
    })
    const firstData = {
      id: 'stale-relation-set-first',
      type: RELATION_ELEMENT_TYPE,
      name: 'Stale Relation First',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: relationProps(propertyId)
    } satisfies ElementRawData
    const firstRelation = {
      ownerElementId: firstData.id,
      ownerElementType: firstData.type,
      ownerPropertyName: RELATION_PROPERTY_NAME,
      componentId: propertyId
    } satisfies ElementPropertyRelation
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(
        sceneTree.prepareElementInsertion({
          parentId: workspace.get('id'),
          elements: [firstData],
          ownerRelations: [firstRelation]
        })
      )
    )
    const stalePreparation = sceneTree.prepareElementRemoval([firstData.id])
    const laterData = {
      ...firstData,
      id: 'stale-relation-set-later',
      name: 'Stale Relation Later'
    }
    const laterRelation = {
      ...firstRelation,
      ownerElementId: laterData.id
    }
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(
        sceneTree.prepareElementInsertion({
          parentId: workspace.get('id'),
          elements: [laterData],
          ownerRelations: [laterRelation]
        })
      )
    )
    const childrenBefore = [...workspace.get('children')]
    const owner = createTransactionOwner()

    expect(() =>
      runWithTransactionOwner(owner, () =>
        sceneTree.applyPreparedElementMutation(stalePreparation)
      )
    ).toThrow(/stale.*relation/i)

    expect(workspace.get('children')).toEqual(childrenBefore)
    expect(sceneTree.getElementById(firstData.id)).toBeDefined()
    expect(sceneTree.getElementPropertyRelations(propertyId)).toEqual([
      firstRelation,
      laterRelation
    ])
    expect(owner.updateTransactionBatch).not.toHaveBeenCalled()
  })

  it('rejects a stale removal when another parent adds a relation to an already-retained root', () => {
    const workspace = sceneTree.currentWorkspace as Workspace
    const removalParent = new RawMutationGroup({
      id: 'exact-stale-removal-parent',
      name: 'Exact Stale Removal Parent',
      visible: true,
      lock: false
    })
    const unrelatedParent = new RawMutationGroup({
      id: 'exact-stale-unrelated-parent',
      name: 'Exact Stale Unrelated Parent',
      visible: true,
      lock: false
    })
    workspace.addNewElements([removalParent, unrelatedParent])

    const removedRootId = 'exact-stale-removed-root'
    const retainedRootId = 'exact-stale-retained-root'
    ;[removedRootId, retainedRootId].forEach((propertyId) => {
      activeProperties.set(propertyId, {
        get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
      })
    })

    const insertRelation = (
      parent: GroupInstanceTypes,
      data: ElementRawData
    ): void => {
      const relation = {
        ownerElementId: data.id,
        ownerElementType: data.type,
        ownerPropertyName: RELATION_PROPERTY_NAME,
        componentId: (data.props as Readonly<Record<string, string>>)[
          RELATION_PROPERTY_NAME
        ]
      } satisfies ElementPropertyRelation
      runWithTransactionOwner(createTransactionOwner(), () =>
        sceneTree.applyPreparedElementMutation(
          sceneTree.prepareElementInsertion({
            parentId: parent.get('id'),
            elements: [data],
            ownerRelations: [relation]
          })
        )
      )
    }

    const removableData = {
      id: 'exact-stale-removable',
      type: RELATION_ELEMENT_TYPE,
      name: 'Exact Stale Removable',
      parentId: removalParent.get('id'),
      visible: true,
      lock: false,
      props: relationProps(removedRootId)
    } satisfies ElementRawData
    const retainedData = {
      id: 'exact-stale-retained',
      type: RELATION_ELEMENT_TYPE,
      name: 'Exact Stale Retained',
      parentId: unrelatedParent.get('id'),
      visible: true,
      lock: false,
      props: relationProps(retainedRootId)
    } satisfies ElementRawData
    insertRelation(removalParent, removableData)
    insertRelation(unrelatedParent, retainedData)

    const stalePreparation = sceneTree.prepareElementRemoval([removableData.id])
    const laterData = {
      ...retainedData,
      id: 'exact-stale-later',
      name: 'Exact Stale Later'
    }
    insertRelation(unrelatedParent, laterData)
    const removalParentChildrenBefore = [...removalParent.get('children')]
    const owner = createTransactionOwner()

    expect(() =>
      runWithTransactionOwner(owner, () =>
        sceneTree.applyPreparedElementMutation(stalePreparation)
      )
    ).toThrow(/stale.*relation/i)

    expect(removalParent.get('children')).toEqual(removalParentChildrenBefore)
    expect(sceneTree.getElementById(removableData.id)).toBeDefined()
    expect(owner.updateTransactionBatch).not.toHaveBeenCalled()
  })

  it('restores the relation index when removal handoff rejects before acceptance', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const propertyId = 'rejected-removal-relation-property'
    activeProperties.set(propertyId, {
      get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
    })
    const data = {
      id: 'rejected-removal-relation-element',
      type: RELATION_ELEMENT_TYPE,
      name: 'Rejected Removal Relation',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: relationProps(propertyId)
    } satisfies ElementRawData
    const relation = {
      ownerElementId: data.id,
      ownerElementType: data.type,
      ownerPropertyName: RELATION_PROPERTY_NAME,
      componentId: propertyId
    } satisfies ElementPropertyRelation
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(
        sceneTree.prepareElementInsertion({
          parentId: workspace.get('id'),
          elements: [data],
          ownerRelations: [relation]
        })
      )
    )
    const preparedMutation = sceneTree.prepareElementRemoval([data.id])
    const owner = createTransactionOwner(
      vi.fn(() => {
        throw new Error('reject relation removal handoff')
      })
    )

    expect(() =>
      runWithTransactionOwner(owner, () =>
        sceneTree.applyPreparedElementMutation(preparedMutation)
      )
    ).toThrow(/reject relation removal handoff/i)

    expect(sceneTree.getElementById(data.id)?.save()).toEqual(data)
    expect(sceneTree.getElementPropertyRelations(propertyId)).toEqual([
      relation
    ])
    expect(workspace.get('children')).toContain(data.id)
  })

  it('keeps relation tuples exact across canonical remove, Undo insertion, and Redo removal', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const propertyId = 'relation-undo-redo-property'
    activeProperties.set(propertyId, {
      get: (key) => (key === 'id' ? propertyId : RELATION_PROPERTY_TYPE)
    })
    const data = {
      id: 'relation-undo-redo-element',
      type: RELATION_ELEMENT_TYPE,
      name: 'Relation Undo Redo',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: relationProps(propertyId)
    } satisfies ElementRawData
    const relation = {
      ownerElementId: data.id,
      ownerElementType: data.type,
      ownerPropertyName: RELATION_PROPERTY_NAME,
      componentId: propertyId
    } satisfies ElementPropertyRelation
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(
        sceneTree.prepareElementInsertion({
          parentId: workspace.get('id'),
          elements: [data],
          ownerRelations: [relation]
        })
      )
    )
    const removalEntry = {
      data,
      parentId: workspace.get('id'),
      index: workspace.get('children').indexOf(data.id)
    }
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(
        sceneTree.prepareCanonicalElementRemoval([removalEntry])
      )
    )
    expect(sceneTree.getElementPropertyRelations(propertyId)).toEqual([])

    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(
        sceneTree.prepareCanonicalElementInsertion({
          entries: [removalEntry]
        })
      )
    )
    expect(sceneTree.getElementPropertyRelations(propertyId)).toEqual([
      relation
    ])

    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(
        sceneTree.prepareCanonicalElementRemoval([removalEntry])
      )
    )
    expect(sceneTree.getElementPropertyRelations(propertyId)).toEqual([])
  })

  it('rolls back every parent when a later parent replacement rejects removal', () => {
    const workspace = sceneTree.currentWorkspace as Workspace
    const firstParent = new RawMutationGroup({
      id: 'removal-parent-first',
      name: 'First Parent',
      visible: true,
      lock: false
    })
    const secondParent = new RawMutationGroup({
      id: 'removal-parent-second',
      name: 'Second Parent',
      visible: true,
      lock: false
    })
    workspace.addNewElements([firstParent, secondParent])

    const firstChild = new RawMutationElement({
      id: 'removal-child-first',
      name: 'First Child',
      visible: true,
      lock: false
    })
    const secondChild = new RawMutationElement({
      id: 'removal-child-second',
      name: 'Second Child',
      visible: true,
      lock: false
    })
    workspace.addNewElements([firstChild], firstParent)
    workspace.addNewElements([secondChild], secondParent)
    sceneTree.cleanChanges()

    const preparedMutation = sceneTree.prepareElementRemoval([
      firstChild.get('id'),
      secondChild.get('id')
    ])
    const replaceParentChildren = vi.spyOn(
      workspace,
      'replaceBatchParentChildren'
    )
    replaceParentChildren.mockImplementationOnce((parent, children) => {
      ;(parent as Group).replaceChildrenFromCanonicalBatch(children)
    })
    replaceParentChildren.mockImplementationOnce(() => {
      throw new Error('reject second parent replacement')
    })

    expect(() =>
      runWithTransactionOwner(createTransactionOwner(), () =>
        sceneTree.applyPreparedElementMutation(preparedMutation)
      )
    ).toThrow(/reject second parent replacement/i)

    expect(firstParent.get('children')).toEqual([firstChild.get('id')])
    expect(secondParent.get('children')).toEqual([secondChild.get('id')])
    expect(sceneTree.getElementById(firstChild.get('id'))).toBe(firstChild)
    expect(sceneTree.getElementById(secondChild.get('id'))).toBe(secondChild)
  })

  it('preflights and applies a large sibling removal with parent-bounded reads', () => {
    const workspace = sceneTree.currentWorkspace as Workspace
    const siblings = Array.from(
      { length: 100 },
      (_, index) =>
        new RawMutationElement({
          id: `bounded-removal-${index}`,
          name: `Bounded Removal ${index}`,
          visible: true,
          lock: false
        })
    )
    workspace.addNewElements(siblings)
    sceneTree.cleanChanges()
    const getContainerChildren = vi.spyOn(
      sceneTree as unknown as {
        getContainerChildren: (
          parent: GroupInstanceTypes,
          owner: string
        ) => readonly string[]
      },
      'getContainerChildren'
    )

    const preparedMutation = sceneTree.prepareElementRemoval(
      siblings.map((element) => element.get('id'))
    )
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(preparedMutation)
    )

    expect(getContainerChildren.mock.calls.length).toBeLessThanOrEqual(4)
  })

  it('reuses an exact tombstone only for canonical insertion replay', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const data = second.save()
    const removal = sceneTree.prepareCanonicalElementRemoval([
      {
        data,
        parentId: workspace.get('id'),
        index: 1
      }
    ])
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(removal)
    )

    expect(sceneTree._deletedMap.get(data.id)).toBe(second)
    expect(() =>
      sceneTree.prepareElementInsertion({
        parentId: workspace.get('id'),
        index: 1,
        elements: [data],
        ownerRelations: []
      })
    ).toThrow(/inactive|tombstone|exact/i)

    const restoration = sceneTree.prepareCanonicalElementInsertion({
      entries: [
        {
          data,
          parentId: workspace.get('id'),
          index: 1
        }
      ]
    })
    runWithTransactionOwner(createTransactionOwner(), () =>
      sceneTree.applyPreparedElementMutation(restoration)
    )

    expect(sceneTree.getElementById(data.id)).toBe(second)
    expect(sceneTree._deletedMap.has(data.id)).toBe(false)
    expect(workspace.get('children')).toEqual([
      'raw-mutation-first',
      'raw-mutation-second'
    ])
    expect(second.save()).toEqual(data)
  })

  it('keeps an accepted removal canonical when computed disposal rejects', () => {
    const workspace = sceneTree.currentWorkspace as GroupInstanceTypes
    const preparedMutation = sceneTree.prepareElementRemoval([
      'raw-mutation-second'
    ])
    const transactionOwner = createTransactionOwner()
    const disposeComputed = vi.fn(() => {
      throw new Error('reject computed disposal after accepted handoff')
    })
    ;(
      second as unknown as {
        computed: {
          dispose: () => void
        }
      }
    ).computed = {
      dispose: disposeComputed
    }

    expect(() =>
      runWithTransactionOwner(transactionOwner, () =>
        sceneTree.applyPreparedElementMutation(preparedMutation)
      )
    ).toThrow(/reject computed disposal after accepted handoff/i)

    expect(transactionOwner.updateTransactionBatch).toHaveBeenCalledOnce()
    expect(sceneTree.getElementById('raw-mutation-second')).toBeUndefined()
    expect(sceneTree._deletedMap.get('raw-mutation-second')).toBe(second)
    expect(workspace.get('children')).toEqual(['raw-mutation-first'])
    expect(disposeComputed).toHaveBeenCalledOnce()
  })
})
