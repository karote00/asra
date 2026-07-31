import type {
  ComputedAttrs,
  ComputedDataPatch,
  ComputedDataPatchChange,
  ComputedDataRecordValue,
  SceneTreeRawData,
  ElementRawData,
  GroupRawData,
  ElementInstanceTypes,
  GroupInstanceTypes,
  HierarchyMove,
  LoadDiagnostic,
  MoveHierarchyRequest,
  MoveHierarchyResult,
  RemoveSubtreeResult,
  PreparedSceneTreeRestore,
  SceneTreeRestoreSnapshot,
  SceneTreeRestoreStrategy,
  SceneTreeChange,
  SubtreeChange,
  SubtreeRemovalEntry,
  AddRemoveElementEntry,
  AddRemoveElementsChange,
  AddRemovePropertyChange,
  UpdateElementDataChange,
  UpdateElementBatchChange,
  PropsComponentRawData,
  ElementPropertyRelation,
  EVENT_OPTIONS,
  CreateElementData
} from '@asyra/utils'
import {
  DataTypes,
  EntityTypes,
  PROPS_ACTIONS,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  isRecord,
  setOwnEnumerableValue
} from '@asyra/utils'
import {
  acknowledgeTransactionReplayApplied,
  EventTypes,
  getTransactionReplayMode,
  getTransactionOwner,
  issueDetachedTransactionOwnerBatch,
  publishLocalComputedDataEvents,
  runInTransactionReplayMode,
  type UpdateComputedDataBatchEvent,
  type UpdateComputedDataPatchEvent,
  type UpdateTransactionEvent,
  updateTransaction
} from '@asyra/reactive-events'
import propsManager, {
  type CanonicalPropertyDeliveryOwner,
  type PreparedOrdinaryPropertyCreationBatch,
  type PreparedPropsTransactionEvent,
  type PropertyDefinition,
  type PropsManager
} from '@asyra/props-manager'
import { isEqual } from 'lodash'
import componentRegistry from './component-registry'
import { createElement, createWorkspace, isGroupEntity } from './entity-data'
import type Element from './components/element'
import type Workspace from './components/workspace'
import type {
  PreparedCanonicalElementInsertion,
  CanonicalElementInsertionRequest,
  PreparedCanonicalElementRemoval,
  PreparedElementDataMutation,
  ElementDataMutationRequest,
  PreparedElementInsertion,
  ElementInsertionRequest,
  ElementMutationBatchResult,
  PreparedElementMutation,
  ElementPropertyRelationRelease,
  ResolvedElementPropertyTargets,
  ElementPropertyTargetRequest,
  PreparedElementRemoval,
  PreparedSubtreeRemoval
} from './element-mutation'

type SceneTreeDataType = SceneTreeRawData

const measureCanonicalSceneBatchPhase = <T>(
  phaseName: string,
  run: () => T
): T => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (name: string, durationMs: number) => void
    }
  ).__asyraBrowserDragPhaseSink
  if (!sink) {
    return run()
  }

  const start = performance.now()
  try {
    return run()
  } finally {
    try {
      sink(phaseName, performance.now() - start)
    } catch {
      // Profiling is detached observation and cannot change owner behavior.
    }
  }
}

const hasPatchChanges = (patch: ComputedDataPatchChange): boolean => {
  if (Object.keys(patch.values ?? {}).length > 0) {
    return true
  }

  return Object.values(patch.records ?? {}).some(
    (recordPatch) =>
      Object.keys(recordPatch.set ?? {}).length > 0 ||
      Object.keys(recordPatch.remove ?? {}).length > 0
  )
}

const getOverlappingPatchKey = (
  patch: ComputedDataPatch
): string | undefined => {
  const recordKeys = new Set(Object.keys(patch.records ?? {}))
  return Object.keys(patch.values ?? {}).find((key) => recordKeys.has(key))
}

const cloneRecord = (
  value: Record<string, unknown>
): Record<string, ComputedDataRecordValue> =>
  ({ ...value }) as Record<string, ComputedDataRecordValue>

const hasOwnRecordValue = (
  value: Record<string, unknown>,
  key: string
): boolean => Object.prototype.hasOwnProperty.call(value, key)

const getComputedSnapshot = (
  element: ElementInstanceTypes
): Record<string, DataTypes> => {
  const snapshot = element.getAllComputedData()
  if (!isRecord(snapshot)) {
    throw new Error('Computed data snapshot must be a record')
  }
  return snapshot as Record<string, DataTypes>
}

const validateComputedDataRecordPatches = (
  patch: ComputedDataPatch,
  computedSnapshot: Record<string, DataTypes>
): void => {
  Object.entries(patch.records ?? {}).forEach(([key, recordPatch]) => {
    if (
      !hasOwnRecordValue(computedSnapshot, key) ||
      !isRecord(computedSnapshot[key])
    ) {
      throw new Error(
        `Computed data patch record base "${key}" must already be a record`
      )
    }

    const removedIds = new Set(recordPatch.remove ?? [])
    const overlappingRecordId = Object.keys(recordPatch.set ?? {}).find(
      (recordId) => removedIds.has(recordId)
    )
    if (overlappingRecordId !== undefined) {
      throw new Error(
        `Computed data patch record "${key}.${overlappingRecordId}" cannot be both set and removed`
      )
    }
  })
}

const validateComputedDataValuePatches = (
  patch: ComputedDataPatch,
  computedSnapshot: Record<string, DataTypes>
): void => {
  Object.keys(patch.values ?? {}).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(computedSnapshot, key)) {
      throw new Error(
        `Computed data patch value base "${key}" must already exist`
      )
    }
  })
}

const validateComputedDataPatch = (
  patch: ComputedDataPatch,
  computedSnapshot: Record<string, DataTypes>
): void => {
  const overlappingKey = getOverlappingPatchKey(patch)
  if (overlappingKey !== undefined) {
    throw new Error(
      `Computed data patch key "${overlappingKey}" cannot be both value and record`
    )
  }

  validateComputedDataValuePatches(patch, computedSnapshot)
  validateComputedDataRecordPatches(patch, computedSnapshot)
}

const LOCAL_COMPUTED_RESERVED_KEYS = new Set([
  'id',
  'type',
  'name',
  'parentId',
  'visible',
  'lock'
])

export type SceneTreeLoadDiagnostic = LoadDiagnostic

export interface SceneTreeLoadValidationResult {
  data: SceneTreeRawData
  diagnostics: SceneTreeLoadDiagnostic[]
  valid: boolean
}

interface ElementBatchPreflight {
  readonly target: GroupInstanceTypes
  readonly sourceIds: readonly string[]
  readonly insertionIndex: number
  readonly tombstones: ReadonlyMap<string, ElementInstanceTypes | undefined>
  readonly preparedOrdinaryProperties:
    | PreparedOrdinaryPropertyCreationBatch
    | undefined
}

export interface CanonicalElementRemoval {
  readonly data: ElementRawData
  readonly parentId: string
  readonly index: number
}

export interface LocalComputedDataUpdate {
  readonly elementId: string
  readonly values: Readonly<Record<string, DataTypes>>
}

export interface LocalComputedDataPatchUpdate {
  readonly elementId: string
  readonly patch: ComputedDataPatch
}

interface PreparedElementDataMutationEntry {
  readonly element: ElementInstanceTypes
  readonly before: Readonly<Pick<ElementRawData, 'name' | 'visible' | 'lock'>>
  readonly after: Readonly<Pick<ElementRawData, 'name' | 'visible' | 'lock'>>
}

interface PreparedElementDataMutationArtifact {
  readonly kind: 'element-data-mutation'
  readonly entries: readonly PreparedElementDataMutationEntry[]
}

interface ElementInsertionRelationDefinition {
  readonly name: string
  readonly type: string
}

type ElementInsertionRegistration = NonNullable<
  ReturnType<typeof componentRegistry.get>
>

interface ElementInsertionRegistrationContract {
  readonly registration: ElementInsertionRegistration
  readonly constructor: ElementInsertionRegistration['constructor']
  readonly registrationDefinitions: readonly ElementInsertionRelationDefinition[]
  readonly constructorDefinitions:
    | readonly ElementInsertionRelationDefinition[]
    | undefined
  readonly effectiveDefinitions: readonly ElementInsertionRelationDefinition[]
}

interface PreparedElementInsertionArtifact {
  readonly kind: 'element-insertion' | 'canonical-element-insertion'
  readonly entries: readonly {
    readonly data: ElementRawData
    readonly tombstone?: ElementInstanceTypes
    readonly registrationContract: ElementInsertionRegistrationContract
    readonly propertyRelations: readonly {
      readonly ownerElementId: string
      readonly ownerElementType: string
      readonly ownerPropertyName: string
      readonly componentId: string
      readonly propertyType: string
    }[]
  }[]
  readonly parents: ReadonlyMap<string, GroupInstanceTypes>
  readonly parentChildrenBefore: ReadonlyMap<string, readonly string[]>
  readonly parentChildrenAfter: ReadonlyMap<string, readonly string[]>
  readonly relationIndexUpdates: readonly ElementPropertyRelationIndexUpdate[]
}

interface PreparedElementRemovalEntry {
  readonly element: ElementInstanceTypes
  readonly data: ElementRawData
  readonly parentId: string
  readonly index: number
}

interface PreparedElementRemovalArtifact {
  readonly kind:
    | 'element-removal'
    | 'canonical-element-removal'
    | 'subtree-removal'
  readonly entries: readonly PreparedElementRemovalEntry[]
  readonly relationSetBefore: readonly ElementPropertyRelation[]
  readonly parentChildrenBefore: ReadonlyMap<string, readonly string[]>
  readonly parentChildrenAfter: ReadonlyMap<string, readonly string[]>
}

interface PreparedElementPropertyRelation extends ElementPropertyRelation {
  readonly propertyType: string
}

interface PreparedElementPropertyContract {
  readonly relations: readonly PreparedElementPropertyRelation[]
  readonly registrationContracts: readonly {
    readonly elementType: string
    readonly contract: ElementInsertionRegistrationContract
  }[]
}

interface ElementPropertyRelationIndexUpdate {
  readonly componentId: string
  readonly relationsBefore: readonly ElementPropertyRelation[]
  readonly relationsAfter: readonly ElementPropertyRelation[]
}

type PreparedElementMutationArtifact =
  | PreparedElementDataMutationArtifact
  | PreparedElementInsertionArtifact
  | PreparedElementRemovalArtifact

const canonicalBatchHandoffAccepted = Symbol(
  'scene-tree:canonical-batch-handoff-accepted'
)
const canonicalBatchHandoffState = Symbol(
  'scene-tree:canonical-batch-handoff-state'
)

interface CanonicalBatchHandoffState {
  [canonicalBatchHandoffAccepted]: boolean
}

interface CanonicalCombinedCommit {
  readonly elements: readonly ElementInstanceTypes[]
  readonly propsEvents: readonly PreparedPropsTransactionEvent[]
  readonly [canonicalBatchHandoffState]?: CanonicalBatchHandoffState
}

const cloneSceneTreeValue = <T>(data: T): T => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(data)
  }

  return JSON.parse(JSON.stringify(data)) as T
}

const deepFreezeSceneValue = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  ) {
    return value
  }

  const objectValue = value as object
  if (seen.has(objectValue)) {
    return value
  }
  seen.add(objectValue)
  Reflect.ownKeys(objectValue).forEach((key) => {
    deepFreezeSceneValue(
      (objectValue as Record<PropertyKey, unknown>)[key],
      seen
    )
  })
  return Object.freeze(value)
}

const cloneAndFreezeSceneValue = <T>(value: T): T =>
  deepFreezeSceneValue(cloneSceneTreeValue(value))

const isElementBatchChange = (
  change: SceneTreeChange
): change is AddRemoveElementsChange =>
  change.action === SCENE_TREE_ACTIONS.ADD_ELEMENTS ||
  change.action === SCENE_TREE_ACTIONS.REMOVE_ELEMENTS

const createElementBatchSharedRecords = (
  change: AddRemoveElementsChange
): NonNullable<
  NonNullable<UpdateTransactionEvent['canonicalEvidence']>['sharedRecords']
> =>
  deepFreezeSceneValue(
    change.entries.map((entry) => ({
      orderedIds: [entry.data.id],
      payload: {
        ...change,
        entries: [entry]
      }
    }))
  )

const compareCanonicalString = (left: string, right: string): number => {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

const compareElementPropertyRelations = (
  left: ElementPropertyRelation,
  right: ElementPropertyRelation
): number =>
  compareCanonicalString(left.ownerElementId, right.ownerElementId) ||
  compareCanonicalString(left.ownerPropertyName, right.ownerPropertyName) ||
  compareCanonicalString(left.ownerElementType, right.ownerElementType) ||
  compareCanonicalString(left.componentId, right.componentId)

const getElementPropertyRelationTupleKey = (
  relation: Pick<
    ElementPropertyRelation,
    'ownerElementId' | 'ownerPropertyName'
  >
): string =>
  JSON.stringify([relation.ownerElementId, relation.ownerPropertyName])

const freezeElementPropertyRelations = (
  relations: readonly ElementPropertyRelation[]
): readonly ElementPropertyRelation[] =>
  Object.freeze(
    relations
      .map((relation) =>
        Object.freeze({
          ownerElementId: relation.ownerElementId,
          ownerElementType: relation.ownerElementType,
          ownerPropertyName: relation.ownerPropertyName,
          componentId: relation.componentId
        })
      )
      .sort(compareElementPropertyRelations)
  )

const EMPTY_ELEMENT_PROPERTY_RELATIONS = Object.freeze(
  [] as ElementPropertyRelation[]
)

const collectElementPropertyRelations = (
  data: ElementRawData
): readonly ElementPropertyRelation[] => {
  const props = data.props ?? {}
  if (
    typeof data.id !== 'string' ||
    data.id.length === 0 ||
    typeof data.type !== 'string' ||
    data.type.length === 0 ||
    !isRecord(props)
  ) {
    throw new Error(
      '[SceneTree] Cannot derive element-property relations from invalid Scene data'
    )
  }
  return freezeElementPropertyRelations(
    Object.entries(props).map(([ownerPropertyName, componentId]) => {
      if (
        ownerPropertyName.length === 0 ||
        typeof componentId !== 'string' ||
        componentId.length === 0
      ) {
        throw new Error(
          `[SceneTree] Element "${data.id}" has an invalid property relation`
        )
      }
      return {
        ownerElementId: data.id,
        ownerElementType: data.type,
        ownerPropertyName,
        componentId
      }
    })
  )
}

const captureElementInsertionRelationDefinitions = (
  sourceDefinitions: unknown,
  elementType: string,
  owner: 'registration' | 'constructor'
): readonly ElementInsertionRelationDefinition[] | undefined => {
  if (sourceDefinitions === undefined) {
    return
  }
  if (!Array.isArray(sourceDefinitions)) {
    throw new Error(
      `[SceneTree] Element insertion has an invalid ${owner} property owner registry for "${elementType}"`
    )
  }
  const definitionNames = new Set<string>()
  return Object.freeze(
    sourceDefinitions.map((definition) => {
      if (
        !isRecord(definition) ||
        typeof definition.name !== 'string' ||
        definition.name.length === 0 ||
        typeof definition.type !== 'string' ||
        definition.type.length === 0 ||
        definitionNames.has(definition.name)
      ) {
        throw new Error(
          `[SceneTree] Element insertion has an invalid ${owner} property owner registry for "${elementType}"`
        )
      }
      definitionNames.add(definition.name)
      return Object.freeze({
        name: definition.name,
        type: definition.type
      })
    })
  )
}

const captureElementInsertionRegistrationContract = (
  registration: ElementInsertionRegistration,
  elementType: string
): ElementInsertionRegistrationContract => {
  const registrationDefinitions =
    captureElementInsertionRelationDefinitions(
      registration.properties,
      elementType,
      'registration'
    ) ?? Object.freeze([])
  const constructorDefinitions = captureElementInsertionRelationDefinitions(
    (
      registration.constructor as typeof registration.constructor & {
        ordinaryPropertyDefinitions?: unknown
      }
    ).ordinaryPropertyDefinitions,
    elementType,
    'constructor'
  )
  const effectiveDefinitions =
    registrationDefinitions.length > 0
      ? registrationDefinitions
      : (constructorDefinitions ?? Object.freeze([]))
  return Object.freeze({
    registration,
    constructor: registration.constructor,
    registrationDefinitions,
    constructorDefinitions,
    effectiveDefinitions
  })
}

const isElementInsertionRegistrationContractCurrent = (
  contract: ElementInsertionRegistrationContract,
  elementType: string
): boolean => {
  if (
    componentRegistry.get(elementType) !== contract.registration ||
    contract.registration.constructor !== contract.constructor
  ) {
    return false
  }
  try {
    const current = captureElementInsertionRegistrationContract(
      contract.registration,
      elementType
    )
    return (
      current.constructor === contract.constructor &&
      isEqual(
        current.registrationDefinitions,
        contract.registrationDefinitions
      ) &&
      isEqual(current.constructorDefinitions, contract.constructorDefinitions)
    )
  } catch {
    return false
  }
}

const reportsAcceptedCanonicalBatchHandoff = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'batchAccepted' in error &&
  (error as { batchAccepted?: unknown }).batchAccepted === true

const createCanonicalBatchHandoffState = (): CanonicalBatchHandoffState => ({
  [canonicalBatchHandoffAccepted]: false
})

const markCanonicalBatchHandoffAccepted = (
  state: CanonicalBatchHandoffState
): void => {
  state[canonicalBatchHandoffAccepted] = true
}

const wasCanonicalBatchHandoffAccepted = (
  state: CanonicalBatchHandoffState
): boolean => state[canonicalBatchHandoffAccepted]

const runWithDeferredReplayAcknowledgement = <T>(callback: () => T): T => {
  const replayMode = getTransactionReplayMode()
  if (replayMode === null) {
    return callback()
  }

  const result = runInTransactionReplayMode(replayMode, () => {
    try {
      return { ok: true as const, value: callback() }
    } catch (error) {
      return { ok: false as const, error }
    }
  })
  if (!result.ok) {
    throw result.error
  }
  return result.value
}

const disposeElementComputed = (element: ElementInstanceTypes): void => {
  ;(
    element.computed as unknown as
      | {
          dispose?: () => void
        }
      | undefined
  )?.dispose?.()
}

const reactivateElementComputed = (element: ElementInstanceTypes): void => {
  if (!element.computed) {
    return
  }
  try {
    element.getAllComputedData()
  } catch (error) {
    disposeElementComputed(element)
    throw error
  }
}

const cloneLoadData = (data: SceneTreeRawData): SceneTreeRawData =>
  cloneSceneTreeValue(data)

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === 'string')
}

class SceneTree {
  _elements: Map<string, ElementInstanceTypes> = new Map()
  _deletedMap: Map<string, ElementInstanceTypes> = new Map()
  workspace: string = ''
  workspaceList: string[] = []
  changes: SceneTreeChange[] = []
  private validatedLoadArtifacts = new WeakMap<
    SceneTreeLoadValidationResult,
    {
      data: SceneTreeRawData
      valid: boolean
      propertyContract?: PreparedElementPropertyContract
      propertyContractError?: string
    }
  >()
  private validatedRestoreArtifacts = new WeakMap<
    PreparedSceneTreeRestore,
    {
      snapshot: SceneTreeRestoreSnapshot
      propertyContract: PreparedElementPropertyContract
    }
  >()
  private preparedElementMutationArtifacts = new WeakMap<
    PreparedElementMutation,
    PreparedElementMutationArtifact
  >()
  private elementPropertyRelationsByComponentId = new Map<
    string,
    readonly ElementPropertyRelation[]
  >()

  constructor(
    private readonly propsManagerOwner: PropsManager = propsManager
  ) {}

  getElementPropertyRelations(
    componentId: string
  ): readonly ElementPropertyRelation[] {
    return (
      this.elementPropertyRelationsByComponentId.get(componentId) ??
      EMPTY_ELEMENT_PROPERTY_RELATIONS
    )
  }

  private captureElementPropertyRelationSet(): readonly ElementPropertyRelation[] {
    return freezeElementPropertyRelations(
      [...this.elementPropertyRelationsByComponentId.values()].flat()
    )
  }

  private buildElementPropertyRelationIndex(
    elements: Iterable<ElementInstanceTypes>
  ): Map<string, readonly ElementPropertyRelation[]> {
    const relationsByComponentId = new Map<string, ElementPropertyRelation[]>()
    const componentIdByTuple = new Map<string, string>()
    for (const element of elements) {
      collectElementPropertyRelations(element.save()).forEach((relation) => {
        const tupleKey = getElementPropertyRelationTupleKey(relation)
        const existingComponentId = componentIdByTuple.get(tupleKey)
        if (
          existingComponentId !== undefined &&
          existingComponentId !== relation.componentId
        ) {
          throw new Error(
            `[SceneTree] Element property relation "${relation.ownerElementId}.${relation.ownerPropertyName}" targets multiple components`
          )
        }
        componentIdByTuple.set(tupleKey, relation.componentId)
        const relations = relationsByComponentId.get(relation.componentId) ?? []
        if (
          relations.some(
            (existing) =>
              getElementPropertyRelationTupleKey(existing) === tupleKey
          )
        ) {
          throw new Error(
            `[SceneTree] Element property relation "${relation.ownerElementId}.${relation.ownerPropertyName}" is duplicated`
          )
        }
        relations.push(relation)
        relationsByComponentId.set(relation.componentId, relations)
      })
    }
    return new Map(
      [...relationsByComponentId].map(([componentId, relations]) => [
        componentId,
        freezeElementPropertyRelations(relations)
      ])
    )
  }

  private prepareElementPropertyRelationInsertions(
    elements: readonly ElementInstanceTypes[]
  ): readonly ElementPropertyRelationIndexUpdate[] {
    return this.prepareElementPropertyRelationInsertionsFromRelations(
      elements.flatMap((element) =>
        collectElementPropertyRelations(element.save())
      )
    )
  }

  private prepareElementPropertyRelationInsertionsFromRelations(
    relations: readonly ElementPropertyRelation[]
  ): readonly ElementPropertyRelationIndexUpdate[] {
    const additionsByComponentId = new Map<string, ElementPropertyRelation[]>()
    relations.forEach((relation) => {
      const additions = additionsByComponentId.get(relation.componentId) ?? []
      additions.push(relation)
      additionsByComponentId.set(relation.componentId, additions)
    })
    return Object.freeze(
      [...additionsByComponentId].map(([componentId, additions]) => {
        const relationsBefore = this.getElementPropertyRelations(componentId)
        const tupleKeys = new Set(
          relationsBefore.map(getElementPropertyRelationTupleKey)
        )
        additions.forEach((relation) => {
          const tupleKey = getElementPropertyRelationTupleKey(relation)
          if (tupleKeys.has(tupleKey)) {
            throw new Error(
              `[SceneTree] Element property relation "${relation.ownerElementId}.${relation.ownerPropertyName}" is already active`
            )
          }
          tupleKeys.add(tupleKey)
        })
        return Object.freeze({
          componentId,
          relationsBefore,
          relationsAfter: freezeElementPropertyRelations([
            ...relationsBefore,
            ...additions
          ])
        })
      })
    )
  }

  private prepareElementPropertyRelationRemovals(
    elements: readonly ElementInstanceTypes[]
  ): readonly ElementPropertyRelationIndexUpdate[] {
    const removalsByComponentId = new Map<string, ElementPropertyRelation[]>()
    elements.forEach((element) => {
      collectElementPropertyRelations(element.save()).forEach((relation) => {
        const removals = removalsByComponentId.get(relation.componentId) ?? []
        removals.push(relation)
        removalsByComponentId.set(relation.componentId, removals)
      })
    })
    return Object.freeze(
      [...removalsByComponentId].map(([componentId, removals]) => {
        const relationsBefore = this.getElementPropertyRelations(componentId)
        const relationByTupleKey = new Map(
          relationsBefore.map((relation) => [
            getElementPropertyRelationTupleKey(relation),
            relation
          ])
        )
        const removalTupleKeys = new Set(
          removals.map(getElementPropertyRelationTupleKey)
        )
        removals.forEach((relation) => {
          const current = relationByTupleKey.get(
            getElementPropertyRelationTupleKey(relation)
          )
          if (!current || !isEqual(current, relation)) {
            throw new Error(
              `[SceneTree] Element property relation "${relation.ownerElementId}.${relation.ownerPropertyName}" is not active`
            )
          }
        })
        return Object.freeze({
          componentId,
          relationsBefore,
          relationsAfter: freezeElementPropertyRelations(
            relationsBefore.filter(
              (relation) =>
                !removalTupleKeys.has(
                  getElementPropertyRelationTupleKey(relation)
                )
            )
          )
        })
      })
    )
  }

  private collectRootPropertyIdsExcluding(
    excludedElementIds: ReadonlySet<string>
  ): readonly string[] {
    const retainedRootPropertyIds: string[] = []
    const retainedRootPropertyIdSet = new Set<string>()
    this._elements.forEach((element, elementId) => {
      if (excludedElementIds.has(elementId)) {
        return
      }
      collectElementPropertyRelations(element.save()).forEach(
        ({ componentId }) => {
          if (!retainedRootPropertyIdSet.has(componentId)) {
            retainedRootPropertyIdSet.add(componentId)
            retainedRootPropertyIds.push(componentId)
          }
        }
      )
    })
    return Object.freeze(retainedRootPropertyIds)
  }

  private applyElementPropertyRelationIndexUpdates(
    updates: readonly ElementPropertyRelationIndexUpdate[],
    direction: 'forward' | 'reverse'
  ): void {
    updates.forEach(({ componentId, relationsBefore, relationsAfter }) => {
      const relations =
        direction === 'forward' ? relationsAfter : relationsBefore
      if (relations.length === 0) {
        this.elementPropertyRelationsByComponentId.delete(componentId)
      } else {
        this.elementPropertyRelationsByComponentId.set(componentId, relations)
      }
    })
  }

  private addElementsToCanonicalMap(
    elements: readonly ElementInstanceTypes[],
    preparedUpdates?: readonly ElementPropertyRelationIndexUpdate[]
  ): readonly ElementPropertyRelationIndexUpdate[] {
    const elementIds = elements.map((element) => element.get('id'))
    if (
      elementIds.some(
        (elementId) =>
          typeof elementId !== 'string' ||
          elementId.length === 0 ||
          this._elements.has(elementId)
      ) ||
      new Set(elementIds).size !== elementIds.length
    ) {
      throw new Error(
        '[SceneTree] Canonical element map insertion requires unique inactive ids'
      )
    }
    const updates =
      preparedUpdates ?? this.prepareElementPropertyRelationInsertions(elements)
    elements.forEach((element) => {
      this._elements.set(element.get('id'), element)
    })
    this.applyElementPropertyRelationIndexUpdates(updates, 'forward')
    return updates
  }

  private removeElementsFromCanonicalMap(
    elements: readonly ElementInstanceTypes[],
    preparedUpdates?: readonly ElementPropertyRelationIndexUpdate[]
  ): readonly ElementPropertyRelationIndexUpdate[] {
    const elementIds = elements.map((element) => element.get('id'))
    if (
      elementIds.some(
        (elementId, index) =>
          typeof elementId !== 'string' ||
          elementId.length === 0 ||
          this._elements.get(elementId) !== elements[index]
      ) ||
      new Set(elementIds).size !== elementIds.length
    ) {
      throw new Error(
        '[SceneTree] Canonical element map removal requires unique active instances'
      )
    }
    const updates =
      preparedUpdates ?? this.prepareElementPropertyRelationRemovals(elements)
    elements.forEach((element) => {
      this._elements.delete(element.get('id'))
    })
    this.applyElementPropertyRelationIndexUpdates(updates, 'forward')
    return updates
  }

  private restoreElementsToCanonicalMap(
    elements: readonly ElementInstanceTypes[],
    updates: readonly ElementPropertyRelationIndexUpdate[]
  ): void {
    elements.forEach((element) => {
      this._elements.set(element.get('id'), element)
    })
    this.applyElementPropertyRelationIndexUpdates(updates, 'reverse')
  }

  private rollbackElementsAddedToCanonicalMap(
    elements: readonly ElementInstanceTypes[],
    updates: readonly ElementPropertyRelationIndexUpdate[]
  ): void {
    elements.forEach((element) => {
      this._elements.delete(element.get('id'))
    })
    this.applyElementPropertyRelationIndexUpdates(updates, 'reverse')
  }

  private replaceCanonicalElementMap(
    elements: ReadonlyMap<string, ElementInstanceTypes>,
    preparedRelations?: Map<string, readonly ElementPropertyRelation[]>
  ): void {
    const nextRelations =
      preparedRelations ??
      this.buildElementPropertyRelationIndex(elements.values())
    this._elements = new Map(elements)
    this.elementPropertyRelationsByComponentId = nextRelations
  }

  _init(): void {
    if (!this.workspace && !this.workspaceList.length) {
      const initWorkspace = createWorkspace(this) as ElementInstanceTypes
      if (initWorkspace) {
        this.addToMap(initWorkspace)
        this.workspaceList = [initWorkspace.get('id')]
        this.workspace = this.workspaceList[0]
      }
    }
  }

  init() {
    this._init()
  }

  resolveElementPropertyTargets(
    requests: readonly ElementPropertyTargetRequest[]
  ): ResolvedElementPropertyTargets {
    const orderedElementIds: string[] = []
    const relations: ElementPropertyRelation[] = []
    const relationTupleKeys = new Set<string>()
    const requestedElementIds = new Set<string>()
    interface PropertyTargetAccumulator {
      readonly propertyId: string
      readonly values: Record<string, unknown>
      recordKey?: string
      readonly setRecords: Record<string, Readonly<Record<string, unknown>>>
      readonly removeRecordIds: string[]
      readonly removeRecordIdSet: Set<string>
    }
    const targetsByPropertyId = new Map<string, PropertyTargetAccumulator>()
    const getTarget = (propertyId: string): PropertyTargetAccumulator => {
      const existing = targetsByPropertyId.get(propertyId)
      if (existing) {
        return existing
      }
      const target: PropertyTargetAccumulator = {
        propertyId,
        values: {},
        setRecords: {},
        removeRecordIds: [],
        removeRecordIdSet: new Set()
      }
      targetsByPropertyId.set(propertyId, target)
      return target
    }
    const addRelation = (relation: ElementPropertyRelation): void => {
      const tupleKey = getElementPropertyRelationTupleKey(relation)
      if (!relationTupleKeys.has(tupleKey)) {
        relationTupleKeys.add(tupleKey)
        relations.push(relation)
      }
    }
    const throwConflict = (propertyId: string, key: string): never => {
      throw new Error(
        `[SceneTree] Conflicting shared property target "${propertyId}.${key}"`
      )
    }
    const mergeValue = (
      target: PropertyTargetAccumulator,
      key: string,
      value: unknown
    ): void => {
      if (hasOwnRecordValue(target.values, key)) {
        if (!isEqual(target.values[key], value)) {
          throwConflict(target.propertyId, key)
        }
        return
      }
      setOwnEnumerableValue(target.values, key, cloneSceneTreeValue(value))
    }

    requests.forEach((request) => {
      if (
        !isRecord(request) ||
        (request.kind !== 'values' && request.kind !== 'records') ||
        typeof request.elementId !== 'string' ||
        request.elementId.length === 0 ||
        requestedElementIds.has(request.elementId)
      ) {
        throw new Error(
          '[SceneTree] Element-property target requests require unique active element ids'
        )
      }
      requestedElementIds.add(request.elementId)
      orderedElementIds.push(request.elementId)

      const element = this.getElementById(request.elementId)
      if (!element) {
        throw new Error(
          `[SceneTree] Cannot resolve property targets for missing element "${request.elementId}"`
        )
      }
      const elementType = element.get('type')
      const registration =
        typeof elementType === 'string'
          ? componentRegistry.get(elementType)
          : undefined
      if (!registration) {
        throw new Error(
          `[SceneTree] Cannot resolve property targets for unregistered element type "${String(elementType ?? '')}"`
        )
      }

      const constructorPropertyDefinitions = (
        registration.constructor as typeof registration.constructor & {
          ordinaryPropertyDefinitions?: readonly PropertyDefinition[]
        }
      ).ordinaryPropertyDefinitions
      const definitions =
        registration.properties.length > 0
          ? registration.properties
          : (constructorPropertyDefinitions ?? [])
      const definitionsByInputKey = new Map<string, PropertyDefinition>()
      definitions.forEach((definition) => {
        const keys = [definition.name, ...(definition.alias ?? [])]
        keys.forEach((key) => {
          if (
            typeof key !== 'string' ||
            key.length === 0 ||
            definitionsByInputKey.has(key)
          ) {
            throw new Error(
              `[SceneTree] Element type "${elementType}" has an ambiguous property alias "${String(key)}"`
            )
          }
          definitionsByInputKey.set(key, definition)
        })
      })

      const resolveTarget = (
        requestedKey: string
      ): {
        definition: PropertyDefinition
        propertyId: string
        relation: ElementPropertyRelation
      } => {
        const definition = definitionsByInputKey.get(requestedKey)
        if (!definition) {
          throw new Error(
            `[SceneTree] Element "${request.elementId}" has no property target for "${requestedKey}"`
          )
        }
        const propertyId = element.props.getPropId(definition.name)
        const property = propertyId
          ? this.propsManagerOwner.getPropertyById(propertyId)
          : undefined
        if (
          typeof propertyId !== 'string' ||
          propertyId.length === 0 ||
          !property ||
          property.get('id') !== propertyId ||
          property.get('type') !== definition.type
        ) {
          throw new Error(
            `[SceneTree] Element "${request.elementId}" has an invalid property owner relation for "${definition.name}"`
          )
        }
        return {
          definition,
          propertyId,
          relation: {
            ownerElementId: request.elementId,
            ownerElementType: elementType,
            ownerPropertyName: definition.name,
            componentId: propertyId
          }
        }
      }

      const sourceValues = request.values ?? {}
      if (!isRecord(sourceValues)) {
        throw new Error(
          `[SceneTree] Element "${request.elementId}" property values must be a record`
        )
      }
      Object.entries(sourceValues).forEach(([key, value]) => {
        const { propertyId, relation } = resolveTarget(key)
        addRelation(relation)
        mergeValue(getTarget(propertyId), key, value)
      })
      if (request.kind === 'records') {
        if (!Array.isArray(request.records)) {
          throw new Error(
            `[SceneTree] Element "${request.elementId}" record patches must be an array`
          )
        }
        const recordKeys = new Set<string>()
        request.records.forEach((recordPatch) => {
          if (
            !isRecord(recordPatch) ||
            typeof recordPatch.key !== 'string' ||
            recordPatch.key.length === 0 ||
            recordKeys.has(recordPatch.key)
          ) {
            throw new Error(
              `[SceneTree] Element "${request.elementId}" record patches require unique property keys`
            )
          }
          recordKeys.add(recordPatch.key)
          if (recordPatch.set !== undefined && !isRecord(recordPatch.set)) {
            throw new Error(
              `[SceneTree] Element "${request.elementId}" record set must be a record`
            )
          }
          if (
            recordPatch.remove !== undefined &&
            (!Array.isArray(recordPatch.remove) ||
              recordPatch.remove.some((id) => typeof id !== 'string'))
          ) {
            throw new Error(
              `[SceneTree] Element "${request.elementId}" record remove must contain ids`
            )
          }
          const { definition, propertyId, relation } = resolveTarget(
            recordPatch.key
          )
          addRelation(relation)
          const target = getTarget(propertyId)
          if (
            target.recordKey !== undefined &&
            target.recordKey !== definition.name
          ) {
            throwConflict(propertyId, definition.name)
          }
          target.recordKey = definition.name
          Object.entries(recordPatch.set ?? {}).forEach(
            ([recordId, recordValues]) => {
              if (target.removeRecordIdSet.has(recordId)) {
                throwConflict(propertyId, recordId)
              }
              if (hasOwnRecordValue(target.setRecords, recordId)) {
                if (!isEqual(target.setRecords[recordId], recordValues)) {
                  throwConflict(propertyId, recordId)
                }
                return
              }
              setOwnEnumerableValue(
                target.setRecords,
                recordId,
                cloneSceneTreeValue(recordValues)
              )
            }
          )
          ;(recordPatch.remove ?? []).forEach((recordId) => {
            if (hasOwnRecordValue(target.setRecords, recordId)) {
              throwConflict(propertyId, recordId)
            }
            if (!target.removeRecordIdSet.has(recordId)) {
              target.removeRecordIdSet.add(recordId)
              target.removeRecordIds.push(recordId)
            }
          })
        })
      }
    })

    const mutations = [...targetsByPropertyId.values()].map((target) => {
      if (target.recordKey === undefined) {
        return {
          kind: 'values' as const,
          propertyId: target.propertyId,
          values: target.values
        }
      }
      if (hasOwnRecordValue(target.values, target.recordKey)) {
        throwConflict(target.propertyId, target.recordKey)
      }
      return {
        kind: 'records' as const,
        propertyId: target.propertyId,
        key: target.recordKey,
        ...(Object.keys(target.values).length > 0
          ? { values: target.values }
          : {}),
        ...(Object.keys(target.setRecords).length > 0
          ? { set: target.setRecords }
          : {}),
        ...(target.removeRecordIds.length > 0
          ? { remove: target.removeRecordIds }
          : {})
      }
    })

    return cloneAndFreezeSceneValue({
      kind: 'resolved-element-property-targets',
      orderedElementIds,
      relations,
      mutations
    })
  }

  prepareElementDataMutation(
    requests: readonly ElementDataMutationRequest[]
  ): PreparedElementDataMutation {
    const requestedIds = new Set<string>()
    const entries: PreparedElementDataMutationEntry[] = []
    const evidence: UpdateElementDataChange[] = []

    requests.forEach((request) => {
      if (
        !isRecord(request) ||
        typeof request.elementId !== 'string' ||
        request.elementId.length === 0 ||
        requestedIds.has(request.elementId) ||
        !isRecord(request.values)
      ) {
        throw new Error(
          '[SceneTree] Element data mutations require unique active element ids and typed values'
        )
      }
      requestedIds.add(request.elementId)
      const element = this.getElementById(request.elementId)
      if (!element) {
        throw new Error(
          `[SceneTree] Cannot prepare element data for missing element "${request.elementId}"`
        )
      }

      const valueKeys = Object.keys(request.values)
      const invalidKey = valueKeys.find(
        (key) => key !== 'name' && key !== 'visible' && key !== 'lock'
      )
      if (invalidKey) {
        throw new Error(
          `[SceneTree] Element data mutation cannot update "${invalidKey}"`
        )
      }
      if (
        (request.values.name !== undefined &&
          typeof request.values.name !== 'string') ||
        (request.values.visible !== undefined &&
          typeof request.values.visible !== 'boolean') ||
        (request.values.lock !== undefined &&
          typeof request.values.lock !== 'boolean')
      ) {
        throw new Error(
          `[SceneTree] Element "${request.elementId}" has invalid raw element data`
        )
      }

      const before = {
        name: element.get('name'),
        visible: element.get('visible'),
        lock: element.get('lock')
      }
      const after = {
        name: request.values.name ?? before.name,
        visible: request.values.visible ?? before.visible,
        lock: request.values.lock ?? before.lock
      }
      const changes: UpdateElementDataChange['changes'][number][] = []
      if (before.name !== after.name) {
        changes.push({
          key: 'name',
          before: before.name,
          after: after.name
        })
      }
      if (before.visible !== after.visible) {
        changes.push({
          key: 'visible',
          before: before.visible,
          after: after.visible
        })
      }
      if (before.lock !== after.lock) {
        changes.push({
          key: 'lock',
          before: before.lock,
          after: after.lock
        })
      }
      if (changes.length === 0) {
        return
      }

      entries.push({
        element,
        before: cloneAndFreezeSceneValue(before),
        after: cloneAndFreezeSceneValue(after)
      })
      evidence.push({
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
        eventName: EventTypes.UPDATE_ELEMENT_DATA,
        id: request.elementId,
        changes
      })
    })

    const preparedMutation = cloneAndFreezeSceneValue({
      kind: 'prepared-element-data-mutation',
      orderedElementIds: evidence.map(({ id }) => id),
      evidence
    }) as PreparedElementDataMutation
    this.preparedElementMutationArtifacts.set(preparedMutation, {
      kind: 'element-data-mutation',
      entries: Object.freeze(entries)
    })
    return preparedMutation
  }

  prepareCanonicalElementDataMutation(
    changes: readonly UpdateElementDataChange[]
  ): PreparedElementDataMutation {
    if (!Array.isArray(changes)) {
      throw new Error(
        '[SceneTree] Canonical element data mutation requires an evidence batch'
      )
    }
    const requests = changes.map((change) => {
      if (
        !isRecord(change) ||
        change.action !== SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA ||
        change.eventName !== EventTypes.UPDATE_ELEMENT_DATA ||
        typeof change.id !== 'string' ||
        change.id.length === 0 ||
        !Array.isArray(change.changes) ||
        change.changes.length === 0
      ) {
        throw new Error(
          '[SceneTree] Canonical element data mutation has invalid evidence'
        )
      }
      const values: {
        name?: string
        visible?: boolean
        lock?: boolean
      } = {}
      const keys = new Set<string>()
      change.changes.forEach((field) => {
        if (
          !isRecord(field) ||
          (field.key !== 'name' &&
            field.key !== 'visible' &&
            field.key !== 'lock') ||
          keys.has(field.key) ||
          !Object.prototype.hasOwnProperty.call(field, 'before') ||
          !Object.prototype.hasOwnProperty.call(field, 'after') ||
          (field.key === 'name'
            ? typeof field.before !== 'string' ||
              typeof field.after !== 'string'
            : typeof field.before !== 'boolean' ||
              typeof field.after !== 'boolean')
        ) {
          throw new Error(
            '[SceneTree] Canonical element data mutation has invalid field evidence'
          )
        }
        keys.add(field.key)
        if (field.key === 'name') {
          values.name = field.after as string
        } else if (field.key === 'visible') {
          values.visible = field.after as boolean
        } else {
          values.lock = field.after as boolean
        }
      })
      return {
        elementId: change.id,
        values
      }
    })
    const preparedMutation = this.prepareElementDataMutation(requests)
    if (!isEqual(preparedMutation.evidence, changes)) {
      throw new Error(
        '[SceneTree] Cannot prepare stale canonical element data evidence'
      )
    }
    return preparedMutation
  }

  private prepareElementInsertionEntries(
    sourceEntries: readonly AddRemoveElementEntry[],
    kind:
      | PreparedElementInsertion['kind']
      | PreparedCanonicalElementInsertion['kind'],
    sourceOwnerRelations?: readonly ElementPropertyRelation[]
  ): PreparedElementInsertion | PreparedCanonicalElementInsertion {
    const artifactKind =
      kind === 'prepared-element-insertion'
        ? 'element-insertion'
        : 'canonical-element-insertion'
    const ordinaryOwnerRelations =
      kind === 'prepared-element-insertion' &&
      sourceOwnerRelations !== undefined
        ? cloneSceneTreeValue(sourceOwnerRelations)
        : undefined
    if (
      kind === 'prepared-element-insertion' &&
      !Array.isArray(ordinaryOwnerRelations)
    ) {
      throw new Error(
        '[SceneTree] Ordinary element insertion requires explicit owner relations'
      )
    }
    const relationByOwner = new Map<
      string,
      Map<string, ElementPropertyRelation>
    >()
    ;(ordinaryOwnerRelations ?? []).forEach((relation) => {
      if (
        !isRecord(relation) ||
        typeof relation.ownerElementId !== 'string' ||
        relation.ownerElementId.length === 0 ||
        typeof relation.ownerElementType !== 'string' ||
        relation.ownerElementType.length === 0 ||
        typeof relation.ownerPropertyName !== 'string' ||
        relation.ownerPropertyName.length === 0 ||
        typeof relation.componentId !== 'string' ||
        relation.componentId.length === 0
      ) {
        throw new Error(
          '[SceneTree] Ordinary element insertion has an invalid owner relation'
        )
      }
      const relationsForOwner =
        relationByOwner.get(relation.ownerElementId) ?? new Map()
      if (relationsForOwner.has(relation.ownerPropertyName)) {
        throw new Error(
          `[SceneTree] Ordinary element insertion has duplicate owner relation "${relation.ownerElementId}.${relation.ownerPropertyName}"`
        )
      }
      relationsForOwner.set(relation.ownerPropertyName, relation)
      relationByOwner.set(relation.ownerElementId, relationsForOwner)
    })
    const consumedOrdinaryRelations = new Set<ElementPropertyRelation>()
    if (sourceEntries.length === 0) {
      if ((ordinaryOwnerRelations?.length ?? 0) > 0) {
        throw new Error(
          '[SceneTree] Ordinary element insertion has owner relations outside the insertion batch'
        )
      }
      const preparedMutation = cloneAndFreezeSceneValue({
        kind,
        orderedElementIds: [],
        ...(kind === 'prepared-canonical-element-insertion'
          ? { ownerRelations: [] }
          : {}),
        evidence: []
      }) as PreparedElementInsertion | PreparedCanonicalElementInsertion
      this.preparedElementMutationArtifacts.set(preparedMutation, {
        kind: artifactKind,
        entries: Object.freeze([]),
        parents: new Map(),
        parentChildrenBefore: new Map(),
        parentChildrenAfter: new Map(),
        relationIndexUpdates: Object.freeze([])
      })
      return preparedMutation
    }

    const elementIds = new Set<string>()
    const parents = new Map<string, GroupInstanceTypes>()
    const parentChildrenBefore = new Map<string, readonly string[]>()
    const parentChildrenAfter = new Map<string, string[]>()
    const registrationContractByType = new Map<
      string,
      ElementInsertionRegistrationContract
    >()
    const propertyNamesByType = new Map<string, ReadonlySet<string>>()
    const registrationContracts: ElementInsertionRegistrationContract[] = []
    const tombstones: (ElementInstanceTypes | undefined)[] = []
    const propertyTypeByComponentId = new Map<string, string>()
    const propertyRelations: {
      ownerElementId: string
      ownerElementType: string
      ownerPropertyName: string
      componentId: string
      propertyType: string
    }[][] = []

    const getParentChildren = (
      parentId: string
    ): {
      parent: GroupInstanceTypes
      children: string[]
    } => {
      const existingParent = parents.get(parentId)
      const existingChildren = parentChildrenAfter.get(parentId)
      if (existingParent && existingChildren) {
        return {
          parent: existingParent,
          children: existingChildren
        }
      }
      const parent = this.getElementById(parentId)
      if (!parent || !isGroupEntity(parent.get('type'))) {
        throw new Error(
          `[SceneTree] Element insertion requires active parent "${parentId}"`
        )
      }
      const before = Object.freeze([
        ...this.getContainerChildren(
          parent as GroupInstanceTypes,
          `Element insertion parent "${parentId}"`
        )
      ])
      const after = [...before]
      parents.set(parentId, parent as GroupInstanceTypes)
      parentChildrenBefore.set(parentId, before)
      parentChildrenAfter.set(parentId, after)
      return {
        parent: parent as GroupInstanceTypes,
        children: after
      }
    }

    sourceEntries.forEach((entry) => {
      const source = isRecord(entry) ? entry.data : undefined
      const parentId = isRecord(entry) ? entry.parentId : undefined
      const index = isRecord(entry) ? entry.index : undefined
      const tombstone =
        isRecord(source) && typeof source.id === 'string'
          ? this._deletedMap.get(source.id)
          : undefined
      if (
        !isRecord(source) ||
        typeof source.id !== 'string' ||
        source.id.length === 0 ||
        typeof source.type !== 'string' ||
        source.type.length === 0 ||
        typeof source.name !== 'string' ||
        source.name.length === 0 ||
        typeof parentId !== 'string' ||
        parentId.length === 0 ||
        source.parentId !== parentId ||
        typeof source.visible !== 'boolean' ||
        typeof source.lock !== 'boolean' ||
        !isRecord(source.props) ||
        !Number.isInteger(index) ||
        Number(index) < 0 ||
        elementIds.has(source.id) ||
        this._elements.has(source.id) ||
        (tombstone !== undefined &&
          kind !== 'prepared-canonical-element-insertion')
      ) {
        throw new Error(
          '[SceneTree] Element insertion requires unique exact inactive Scene data'
        )
      }
      elementIds.add(source.id)
      tombstones.push(tombstone)

      let registrationContract = registrationContractByType.get(source.type)
      if (!registrationContract) {
        const registration = componentRegistry.get(source.type)
        if (!registration) {
          throw new Error(
            `[SceneTree] Element insertion has unregistered type "${source.type}"`
          )
        }
        registrationContract = captureElementInsertionRegistrationContract(
          registration,
          source.type
        )
        registrationContractByType.set(source.type, registrationContract)
        propertyNamesByType.set(
          source.type,
          new Set(
            registrationContract.effectiveDefinitions.map(({ name }) => name)
          )
        )
      }
      registrationContracts.push(registrationContract)
      const registration = registrationContract.registration
      if (tombstone) {
        const expectedTombstoneData = {
          ...source,
          parentId: ''
        }
        if (
          !(tombstone instanceof registration.constructor) ||
          tombstone.get('type') !== source.type ||
          !isEqual(tombstone.save(), expectedTombstoneData)
        ) {
          throw new Error(
            `[SceneTree] Canonical insertion has incompatible tombstone "${source.id}"`
          )
        }
      }

      const definitions = registrationContract.effectiveDefinitions
      const expectedPropertyNames = propertyNamesByType.get(source.type)
      const sourceProps = source.props as Record<string, unknown>
      const sourcePropertyNames = Object.keys(sourceProps)
      if (
        !expectedPropertyNames ||
        sourcePropertyNames.some(
          (propertyName) => !expectedPropertyNames.has(propertyName)
        ) ||
        sourcePropertyNames.length !== expectedPropertyNames.size
      ) {
        throw new Error(
          `[SceneTree] Element "${source.id}" requires exact property owner relations`
        )
      }
      const elementPropertyRelations = definitions.map((definition) => {
        const propertyId = sourceProps[definition.name]
        if (typeof propertyId !== 'string' || propertyId.length === 0) {
          throw new Error(
            `[SceneTree] Element "${source.id}" has an invalid property owner relation for "${definition.name}"`
          )
        }
        const existingPropertyType = propertyTypeByComponentId.get(propertyId)
        if (
          existingPropertyType !== undefined &&
          existingPropertyType !== definition.type
        ) {
          throw new Error(
            `[SceneTree] Element insertion component "${propertyId}" has incompatible property types`
          )
        }
        propertyTypeByComponentId.set(propertyId, definition.type)
        let ownerRelation: ElementPropertyRelation
        if (kind === 'prepared-element-insertion') {
          const relation = relationByOwner.get(source.id)?.get(definition.name)
          if (!relation) {
            throw new Error(
              `[SceneTree] Element "${source.id}" requires exact owner relation coverage for "${definition.name}"`
            )
          }
          if (
            relation.ownerElementType !== source.type ||
            relation.componentId !== propertyId
          ) {
            throw new Error(
              `[SceneTree] Element "${source.id}" has an invalid owner relation for "${definition.name}"`
            )
          }
          consumedOrdinaryRelations.add(relation)
          ownerRelation = relation
        } else {
          ownerRelation = {
            ownerElementId: source.id,
            ownerElementType: source.type,
            ownerPropertyName: definition.name,
            componentId: propertyId
          }
        }
        return {
          ownerElementId: ownerRelation.ownerElementId,
          ownerElementType: ownerRelation.ownerElementType,
          ownerPropertyName: ownerRelation.ownerPropertyName,
          componentId: ownerRelation.componentId,
          propertyType: definition.type
        }
      })
      propertyRelations.push(elementPropertyRelations)
      if (
        'children' in source &&
        Array.isArray(source.children) &&
        source.children.length > 0
      ) {
        throw new Error(
          `[SceneTree] Element insertion cannot materialize a populated subtree for "${source.id}"`
        )
      }

      getParentChildren(parentId)
    })
    if (
      ordinaryOwnerRelations &&
      consumedOrdinaryRelations.size !== ordinaryOwnerRelations.length
    ) {
      throw new Error(
        '[SceneTree] Ordinary element insertion has owner relations outside the insertion batch'
      )
    }

    const entriesByParent = new Map<string, AddRemoveElementEntry[]>()
    sourceEntries.forEach((entry) => {
      const entries = entriesByParent.get(entry.parentId) ?? []
      entries.push(entry)
      entriesByParent.set(entry.parentId, entries)
    })
    entriesByParent.forEach((entries, parentId) => {
      const children = parentChildrenAfter.get(parentId)
      if (!children) {
        throw new Error(
          `[SceneTree] Element insertion lost parent "${parentId}"`
        )
      }
      const sortedEntries = [...entries].sort(
        (left, right) => left.index - right.index
      )
      const usedIndexes = new Set<number>()
      sortedEntries.forEach(({ data, index }) => {
        if (usedIndexes.has(index) || index < 0 || index > children.length) {
          throw new Error('[SceneTree] Element insertion has an invalid index')
        }
        usedIndexes.add(index)
        children.splice(index, 0, data.id)
      })
    })

    const preparedMutation = cloneAndFreezeSceneValue({
      kind,
      orderedElementIds: sourceEntries.map(({ data }) => data.id),
      ...(kind === 'prepared-canonical-element-insertion'
        ? {
            ownerRelations: propertyRelations
              .flat()
              .map(
                ({
                  ownerElementId,
                  ownerElementType,
                  ownerPropertyName,
                  componentId
                }) => ({
                  ownerElementId,
                  ownerElementType,
                  ownerPropertyName,
                  componentId
                })
              )
          }
        : {}),
      evidence: [
        {
          action: SCENE_TREE_ACTIONS.ADD_ELEMENTS,
          eventName: EventTypes.ADD_ELEMENTS,
          undoType: EventTypes.REMOVE_ELEMENTS,
          undoAction: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
          entries: sourceEntries
        } satisfies AddRemoveElementsChange
      ]
    }) as PreparedElementInsertion | PreparedCanonicalElementInsertion
    const frozenEntries = (
      preparedMutation.evidence[0] as AddRemoveElementsChange
    ).entries
    const relationIndexUpdates =
      this.prepareElementPropertyRelationInsertionsFromRelations(
        propertyRelations.flat()
      )
    this.preparedElementMutationArtifacts.set(preparedMutation, {
      kind: artifactKind,
      entries: Object.freeze(
        frozenEntries.map(({ data }, index) =>
          Object.freeze({
            data,
            ...(tombstones[index]
              ? {
                  tombstone: tombstones[index]
                }
              : {}),
            registrationContract: registrationContracts[index],
            propertyRelations: Object.freeze(
              propertyRelations[index].map((relation) =>
                Object.freeze({ ...relation })
              )
            )
          })
        )
      ),
      parents,
      parentChildrenBefore,
      parentChildrenAfter: new Map(
        [...parentChildrenAfter].map(([parentId, children]) => [
          parentId,
          Object.freeze(children)
        ])
      ),
      relationIndexUpdates
    })
    return preparedMutation
  }

  prepareElementInsertion(
    request: ElementInsertionRequest
  ): PreparedElementInsertion {
    if (!isRecord(request) || !Array.isArray(request.elements)) {
      throw new Error(
        '[SceneTree] Ordinary element insertion requires one typed parent batch'
      )
    }
    if (!Array.isArray(request.ownerRelations)) {
      throw new Error(
        '[SceneTree] Ordinary element insertion requires explicit owner relations'
      )
    }
    if (request.elements.length === 0) {
      return this.prepareElementInsertionEntries(
        [],
        'prepared-element-insertion',
        request.ownerRelations
      ) as PreparedElementInsertion
    }
    if (typeof request.parentId !== 'string' || request.parentId.length === 0) {
      throw new Error('[SceneTree] Element insertion requires a parent id')
    }
    const parent = this.getElementById(request.parentId)
    if (!parent || !isGroupEntity(parent.get('type'))) {
      throw new Error(
        `[SceneTree] Element insertion requires active parent "${request.parentId}"`
      )
    }
    const parentChildren = this.getContainerChildren(
      parent as GroupInstanceTypes,
      `Element insertion parent "${request.parentId}"`
    )
    const insertionIndex =
      request.index === undefined ? parentChildren.length : request.index
    if (
      !Number.isInteger(insertionIndex) ||
      insertionIndex < 0 ||
      insertionIndex > parentChildren.length
    ) {
      throw new Error('[SceneTree] Element insertion has an invalid index')
    }
    return this.prepareElementInsertionEntries(
      request.elements.map((data, offset) => ({
        data,
        parentId: request.parentId,
        index: insertionIndex + offset
      })),
      'prepared-element-insertion',
      request.ownerRelations
    ) as PreparedElementInsertion
  }

  prepareCanonicalElementInsertion(
    request: CanonicalElementInsertionRequest
  ): PreparedCanonicalElementInsertion {
    if (!isRecord(request) || !Array.isArray(request.entries)) {
      throw new Error(
        '[SceneTree] Canonical element insertion requires exact ordered entries'
      )
    }
    return this.prepareElementInsertionEntries(
      request.entries,
      'prepared-canonical-element-insertion'
    ) as PreparedCanonicalElementInsertion
  }

  private prepareElementRemovalMutation(
    removals: readonly (string | CanonicalElementRemoval)[],
    kind:
      | PreparedElementRemoval['kind']
      | PreparedCanonicalElementRemoval['kind']
  ): PreparedElementRemoval | PreparedCanonicalElementRemoval {
    const relationSetBefore = this.captureElementPropertyRelationSet()
    if (removals.length === 0) {
      const preparedMutation = cloneAndFreezeSceneValue({
        kind,
        orderedElementIds: [],
        relationReleases: [],
        orphanRootPropertyIds: [],
        retainedRootPropertyIds: this.collectRootPropertyIdsExcluding(
          new Set()
        ),
        evidence: []
      }) as PreparedElementRemoval | PreparedCanonicalElementRemoval
      this.preparedElementMutationArtifacts.set(preparedMutation, {
        kind:
          kind === 'prepared-element-removal'
            ? 'element-removal'
            : 'canonical-element-removal',
        entries: Object.freeze([]),
        relationSetBefore,
        parentChildrenBefore: new Map(),
        parentChildrenAfter: new Map()
      })
      return preparedMutation
    }

    const removalIds = new Set<string>()
    const candidates = removals.map((source) => {
      const expected = typeof source === 'string' ? undefined : source
      const elementId = typeof source === 'string' ? source : source.data.id
      if (
        typeof elementId !== 'string' ||
        elementId.length === 0 ||
        removalIds.has(elementId)
      ) {
        throw new Error(
          '[SceneTree] Element removal requires unique active element ids'
        )
      }
      removalIds.add(elementId)
      const element = this.getElementById(elementId)
      if (!element) {
        throw new Error(
          `[SceneTree] Cannot prepare removal for missing element "${elementId}"`
        )
      }
      if (element.get('type') === EntityTypes.WORKSPACE) {
        throw new Error('[SceneTree] Element removal cannot remove a workspace')
      }
      if (
        isGroupEntity(element.get('type')) &&
        this.getContainerChildren(
          element as GroupInstanceTypes,
          `Element removal container "${elementId}"`
        ).length > 0
      ) {
        throw new Error(
          `[SceneTree] Element removal requires subtree lifecycle for "${elementId}"`
        )
      }
      const parentId = element.get('parentId')
      const parent = this.getElementById(parentId)
      if (
        typeof parentId !== 'string' ||
        parentId.length === 0 ||
        !parent ||
        !isGroupEntity(parent.get('type'))
      ) {
        throw new Error(
          `[SceneTree] Element "${elementId}" has no active parent`
        )
      }
      return {
        element,
        expected,
        parentId,
        parent: parent as GroupInstanceTypes
      }
    })

    const parentChildrenBefore = new Map<string, readonly string[]>()
    const parentIndexByElementId = new Map<
      string,
      ReadonlyMap<string, number>
    >()
    candidates.forEach(({ parentId, parent }) => {
      if (parentChildrenBefore.has(parentId)) return
      const children = Object.freeze([
        ...this.getContainerChildren(
          parent,
          `Element removal parent "${parentId}"`
        )
      ])
      parentChildrenBefore.set(parentId, children)
      parentIndexByElementId.set(
        parentId,
        new Map(children.map((elementId, index) => [elementId, index]))
      )
    })
    const sourceEntries = candidates.map(
      ({ element, expected, parentId }): AddRemoveElementEntry => {
        const index = parentIndexByElementId
          .get(parentId)
          ?.get(element.get('id'))
        const data = element.save()
        if (
          index === undefined ||
          (expected !== undefined &&
            (expected.parentId !== parentId ||
              expected.index !== index ||
              !isEqual(expected.data, data)))
        ) {
          throw new Error(
            `[SceneTree] Element removal has stale canonical evidence for "${element.get('id')}"`
          )
        }
        return {
          data,
          parentId,
          index
        }
      }
    )
    const parentChildrenAfter = new Map(
      [...parentChildrenBefore].map(([parentId, children]) => [
        parentId,
        Object.freeze(children.filter((id) => !removalIds.has(id)))
      ])
    )
    const relationIndexUpdates = this.prepareElementPropertyRelationRemovals(
      candidates.map(({ element }) => element)
    )
    const relationReleases = relationIndexUpdates.map(
      ({ componentId, relationsBefore, relationsAfter }) => {
        const retainedTupleKeys = new Set(
          relationsAfter.map(getElementPropertyRelationTupleKey)
        )
        return {
          componentId,
          relationsBefore,
          releasedRelations: relationsBefore.filter(
            (relation) =>
              !retainedTupleKeys.has(
                getElementPropertyRelationTupleKey(relation)
              )
          ),
          retainedRelations: relationsAfter
        } satisfies ElementPropertyRelationRelease
      }
    )
    const preparedMutation = cloneAndFreezeSceneValue({
      kind,
      orderedElementIds: sourceEntries.map(({ data }) => data.id),
      relationReleases,
      orphanRootPropertyIds: relationReleases
        .filter(({ retainedRelations }) => retainedRelations.length === 0)
        .map(({ componentId }) => componentId),
      retainedRootPropertyIds: this.collectRootPropertyIdsExcluding(removalIds),
      evidence: [
        {
          action: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
          eventName: EventTypes.REMOVE_ELEMENTS,
          undoType: EventTypes.ADD_ELEMENTS,
          undoAction: SCENE_TREE_ACTIONS.ADD_ELEMENTS,
          entries: sourceEntries
        } satisfies AddRemoveElementsChange
      ]
    }) as PreparedElementRemoval | PreparedCanonicalElementRemoval
    const frozenEntries = (
      preparedMutation.evidence[0] as AddRemoveElementsChange
    ).entries
    this.preparedElementMutationArtifacts.set(preparedMutation, {
      kind:
        kind === 'prepared-element-removal'
          ? 'element-removal'
          : 'canonical-element-removal',
      entries: Object.freeze(
        candidates.map(({ element }, index) =>
          Object.freeze({
            element,
            data: frozenEntries[index].data,
            parentId: frozenEntries[index].parentId,
            index: frozenEntries[index].index
          })
        )
      ),
      relationSetBefore,
      parentChildrenBefore,
      parentChildrenAfter
    })
    return preparedMutation
  }

  prepareElementRemoval(elementIds: readonly string[]): PreparedElementRemoval {
    return this.prepareElementRemovalMutation(
      elementIds,
      'prepared-element-removal'
    ) as PreparedElementRemoval
  }

  prepareCanonicalElementRemoval(
    removals: readonly CanonicalElementRemoval[]
  ): PreparedCanonicalElementRemoval {
    return this.prepareElementRemovalMutation(
      removals,
      'prepared-canonical-element-removal'
    ) as PreparedCanonicalElementRemoval
  }

  prepareSubtreeRemoval(elementId: string): PreparedSubtreeRemoval {
    this.validateCanonicalHierarchy()
    const relationSetBefore = this.captureElementPropertyRelationSet()
    const removed = this.collectSubtreeRemovalEntries(elementId)
    const rootEntry = removed[removed.length - 1]
    const removalIds = new Set(removed.map((entry) => entry.elementId))
    const elements = removed.map((entry) => {
      const element = this.getElementById(entry.elementId)
      if (!element || !isEqual(element.save(), entry.data)) {
        throw new Error(
          `[SceneTree] Cannot prepare stale subtree element "${entry.elementId}"`
        )
      }
      return element
    })
    const parentChildrenBefore = new Map<string, readonly string[]>()
    removed.forEach(({ parentId }) => {
      if (parentChildrenBefore.has(parentId)) {
        return
      }
      const parent = this.getElementById(parentId)
      if (!parent || !isGroupEntity(parent.get('type'))) {
        throw new Error(
          `[SceneTree] Subtree removal requires active parent "${parentId}"`
        )
      }
      parentChildrenBefore.set(
        parentId,
        Object.freeze([
          ...this.getContainerChildren(
            parent as GroupInstanceTypes,
            `Subtree removal parent "${parentId}"`
          )
        ])
      )
    })
    const rootParentChildrenBefore = parentChildrenBefore.get(
      rootEntry.parentId
    )
    if (
      !rootParentChildrenBefore ||
      rootParentChildrenBefore[rootEntry.index] !== rootEntry.elementId
    ) {
      throw new Error(
        `[SceneTree] Cannot prepare stale subtree root "${rootEntry.elementId}"`
      )
    }
    const parentChildrenAfter = new Map(
      [...parentChildrenBefore].map(([parentId, children]) => [
        parentId,
        Object.freeze(children.filter((id) => !removalIds.has(id)))
      ])
    )
    const rootParentChildrenAfter = parentChildrenAfter.get(rootEntry.parentId)
    if (!rootParentChildrenAfter) {
      throw new Error(
        `[SceneTree] Cannot prepare subtree parent order for "${rootEntry.elementId}"`
      )
    }
    const relationIndexUpdates =
      this.prepareElementPropertyRelationRemovals(elements)
    const relationReleases = relationIndexUpdates.map(
      ({ componentId, relationsBefore, relationsAfter }) => {
        const retainedTupleKeys = new Set(
          relationsAfter.map(getElementPropertyRelationTupleKey)
        )
        return {
          componentId,
          relationsBefore,
          releasedRelations: relationsBefore.filter(
            (relation) =>
              !retainedTupleKeys.has(
                getElementPropertyRelationTupleKey(relation)
              )
          ),
          retainedRelations: relationsAfter
        } satisfies ElementPropertyRelationRelease
      }
    )
    const preparedMutation = cloneAndFreezeSceneValue({
      kind: 'prepared-subtree-removal',
      orderedElementIds: removed.map(({ elementId: id }) => id),
      relationReleases,
      orphanRootPropertyIds: relationReleases
        .filter(({ retainedRelations }) => retainedRelations.length === 0)
        .map(({ componentId }) => componentId),
      retainedRootPropertyIds: this.collectRootPropertyIdsExcluding(removalIds),
      evidence: [
        {
          eventName: EventTypes.CHANGE_SUBTREE,
          elementId: rootEntry.elementId,
          removed,
          rootParentChildrenAfter,
          action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
          undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE
        } satisfies SubtreeChange
      ]
    }) as PreparedSubtreeRemoval
    const frozenRemoved = preparedMutation.evidence[0].removed
    this.preparedElementMutationArtifacts.set(preparedMutation, {
      kind: 'subtree-removal',
      entries: Object.freeze(
        elements.map((element, index) =>
          Object.freeze({
            element,
            data: frozenRemoved[index].data,
            parentId: frozenRemoved[index].parentId,
            index: frozenRemoved[index].index
          })
        )
      ),
      relationSetBefore,
      parentChildrenBefore,
      parentChildrenAfter
    })
    return preparedMutation
  }

  prepareCanonicalSubtreeRemoval(
    change: SubtreeChange
  ): PreparedSubtreeRemoval {
    if (
      !isRecord(change) ||
      change.action !== SCENE_TREE_ACTIONS.REMOVE_SUBTREE ||
      change.undoAction !== SCENE_TREE_ACTIONS.RESTORE_SUBTREE ||
      change.eventName !== EventTypes.CHANGE_SUBTREE ||
      typeof change.elementId !== 'string' ||
      change.elementId.length === 0
    ) {
      throw new Error(
        '[SceneTree] Canonical subtree removal has invalid evidence'
      )
    }
    const preparedMutation = this.prepareSubtreeRemoval(change.elementId)
    if (!isEqual(preparedMutation.evidence[0], change)) {
      throw new Error(
        `[SceneTree] Cannot prepare stale canonical subtree removal for "${change.elementId}"`
      )
    }
    return preparedMutation
  }

  applyPreparedElementMutation(
    preparedMutation: PreparedElementMutation,
    options?: EVENT_OPTIONS
  ): ElementMutationBatchResult {
    const artifact = this.preparedElementMutationArtifacts.get(preparedMutation)
    if (!artifact) {
      throw new Error(
        '[SceneTree] Expected an owner-issued one-shot prepared element mutation'
      )
    }
    this.preparedElementMutationArtifacts.delete(preparedMutation)

    if (preparedMutation.evidence.length === 0) {
      return Object.freeze({
        orderedElementIds: preparedMutation.orderedElementIds,
        evidence: preparedMutation.evidence
      })
    }

    const transactionOwner = getTransactionOwner()
    if (!transactionOwner) {
      throw new Error(
        '[SceneTree] Applying a prepared element mutation requires an active transaction owner'
      )
    }

    const resolvedOptions = Object.freeze({
      ...(options ?? {}),
      shared: options?.shared ?? SharedDataChannelNames.SCENE_TREE
    })
    const events = Object.freeze(
      preparedMutation.evidence.map((payload) => {
        const orderedIds =
          preparedMutation.kind === 'prepared-element-data-mutation'
            ? Object.freeze([(payload as UpdateElementDataChange).id])
            : preparedMutation.orderedElementIds
        const canonicalEvidence = Object.freeze({
          orderedIds,
          ...(isElementBatchChange(payload)
            ? { sharedRecords: createElementBatchSharedRecords(payload) }
            : {})
        })
        return Object.freeze({
          type: EventTypes.UPDATE_TRANSACTION,
          eventName: payload.eventName,
          payload,
          options: resolvedOptions,
          canonicalEvidence
        })
      })
    ) satisfies readonly UpdateTransactionEvent[]

    if (artifact.kind === 'element-data-mutation') {
      artifact.entries.forEach(({ element, before }) => {
        if (
          this.getElementById(element.get('id')) !== element ||
          element.get('name') !== before.name ||
          element.get('visible') !== before.visible ||
          element.get('lock') !== before.lock
        ) {
          throw new Error(
            `[SceneTree] Cannot apply stale prepared element data mutation for "${element.get('id')}"`
          )
        }
      })

      artifact.entries.forEach(({ element, after }) => {
        ;(element as Element).assignCanonicalElementData(after)
      })

      try {
        transactionOwner.updateTransactionBatch(events)
        acknowledgeTransactionReplayApplied()
      } catch (error) {
        if (reportsAcceptedCanonicalBatchHandoff(error)) {
          acknowledgeTransactionReplayApplied()
        } else {
          artifact.entries.forEach(({ element, before }) => {
            ;(element as Element).assignCanonicalElementData(before)
          })
        }
        throw error
      }
    }

    if (
      artifact.kind === 'element-insertion' ||
      artifact.kind === 'canonical-element-insertion'
    ) {
      artifact.parents.forEach((parent, parentId) => {
        const before = artifact.parentChildrenBefore.get(parentId)
        if (
          !before ||
          this.getElementById(parentId) !== parent ||
          !isEqual(
            this.getContainerChildren(
              parent,
              `Element insertion parent "${parentId}"`
            ),
            before
          )
        ) {
          throw new Error(
            `[SceneTree] Cannot apply stale element insertion parent "${parentId}"`
          )
        }
      })
      artifact.entries.forEach(({ data, tombstone, registrationContract }) => {
        if (
          this._elements.has(data.id) ||
          !isElementInsertionRegistrationContractCurrent(
            registrationContract,
            data.type
          ) ||
          (tombstone
            ? this._deletedMap.get(data.id) !== tombstone
            : this._deletedMap.has(data.id))
        ) {
          throw new Error(
            `[SceneTree] Cannot apply stale prepared element insertion for "${data.id}"`
          )
        }
      })
      artifact.entries.forEach(
        ({ data, propertyRelations: expectedRelations }) => {
          expectedRelations.forEach(
            ({
              ownerElementId,
              ownerElementType,
              ownerPropertyName,
              componentId,
              propertyType
            }) => {
              const property =
                this.propsManagerOwner.getPropertyById(componentId)
              if (
                !property ||
                property.get('id') !== componentId ||
                property.get('type') !== propertyType ||
                ownerElementId !== data.id ||
                ownerElementType !== data.type ||
                data.props?.[ownerPropertyName] !== componentId
              ) {
                throw new Error(
                  `[SceneTree] Cannot apply stale property relation "${data.id}.${ownerPropertyName}"`
                )
              }
            }
          )
        }
      )
      artifact.relationIndexUpdates.forEach(
        ({ componentId, relationsBefore }) => {
          if (
            !isEqual(
              this.getElementPropertyRelations(componentId),
              relationsBefore
            )
          ) {
            throw new Error(
              `[SceneTree] Cannot apply stale element property relation index for "${componentId}"`
            )
          }
        }
      )

      const elements: ElementInstanceTypes[] = []
      const changedParentIds: string[] = []
      let elementMapChanged = false
      let relationIndexUpdates:
        | readonly ElementPropertyRelationIndexUpdate[]
        | undefined
      try {
        artifact.entries.forEach(({ data, tombstone }) => {
          const element = tombstone ?? this.createElement(data, false)
          if (!element) {
            throw new Error(
              `[SceneTree] Element insertion could not materialize exact Scene data for "${data.id}"`
            )
          }
          elements.push(element)
          if (tombstone) {
            ;(element as Element).assignCanonicalParentId(data.parentId ?? '')
            reactivateElementComputed(element)
          }
          if (
            element.get('id') !== data.id ||
            element.get('type') !== data.type
          ) {
            throw new Error(
              `[SceneTree] Element insertion could not materialize exact Scene data for "${data.id}"`
            )
          }
        })
        elements.forEach((element, index) => {
          const parentId = artifact.entries[index].data.parentId
          if (!parentId || !artifact.parents.has(parentId)) {
            throw new Error(
              `[SceneTree] Element insertion lost parent for "${element.get('id')}"`
            )
          }
          ;(element as Element).assignCanonicalParentId(parentId)
        })
        elements.forEach((element) => {
          this._deletedMap.delete(element.get('id'))
        })
        relationIndexUpdates = this.addElementsToCanonicalMap(
          elements,
          artifact.relationIndexUpdates
        )
        elementMapChanged = true
        artifact.parentChildrenAfter.forEach((children, parentId) => {
          const parent = artifact.parents.get(parentId)
          if (!parent) {
            throw new Error(
              `[SceneTree] Element insertion lost parent "${parentId}"`
            )
          }
          changedParentIds.push(parentId)
          ;(this.currentWorkspace as Workspace).replaceBatchParentChildren(
            parent,
            children
          )
        })
        transactionOwner.updateTransactionBatch(events)
        acknowledgeTransactionReplayApplied()
      } catch (error) {
        if (reportsAcceptedCanonicalBatchHandoff(error)) {
          acknowledgeTransactionReplayApplied()
        } else {
          changedParentIds.reverse().forEach((parentId) => {
            const parent = artifact.parents.get(parentId)
            const before = artifact.parentChildrenBefore.get(parentId)
            if (!parent || !before) return
            try {
              ;(this.currentWorkspace as Workspace).replaceBatchParentChildren(
                parent,
                before
              )
            } catch {
              // Keep attempting cleanup while preserving the primary failure.
            }
          })
          if (elementMapChanged || elements.length > 0) {
            if (elementMapChanged && relationIndexUpdates) {
              this.rollbackElementsAddedToCanonicalMap(
                elements,
                relationIndexUpdates
              )
            }
            elements.forEach((element, index) => {
              const tombstone = artifact.entries[index]?.tombstone
              try {
                ;(element as Element).assignCanonicalParentId('')
              } catch {
                // Keep attempting cleanup while preserving the primary failure.
              }
              try {
                disposeElementComputed(element)
              } catch {
                // Keep attempting cleanup while preserving the primary failure.
              }
              if (tombstone) {
                this._deletedMap.set(element.get('id'), tombstone)
              } else {
                this._deletedMap.delete(element.get('id'))
              }
            })
          }
        }
        throw error
      }
    }

    if (
      artifact.kind === 'element-removal' ||
      artifact.kind === 'canonical-element-removal' ||
      artifact.kind === 'subtree-removal'
    ) {
      if (
        preparedMutation.kind !== 'prepared-element-removal' &&
        preparedMutation.kind !== 'prepared-canonical-element-removal' &&
        preparedMutation.kind !== 'prepared-subtree-removal'
      ) {
        throw new Error(
          '[SceneTree] Element removal artifact does not match its owner-issued preparation'
        )
      }
      const removalElements = artifact.entries.map(({ element }) => element)
      const removalElementIds = new Set(
        artifact.entries.map(({ data }) => data.id)
      )
      if (
        !isEqual(
          this.captureElementPropertyRelationSet(),
          artifact.relationSetBefore
        )
      ) {
        throw new Error(
          '[SceneTree] Cannot apply stale element property relation set'
        )
      }
      const relationIndexUpdates =
        this.prepareElementPropertyRelationRemovals(removalElements)
      const expectedRelationIndexUpdates =
        preparedMutation.relationReleases.map(
          ({ componentId, relationsBefore, retainedRelations }) => ({
            componentId,
            relationsBefore,
            relationsAfter: retainedRelations
          })
        )
      if (
        !isEqual(relationIndexUpdates, expectedRelationIndexUpdates) ||
        !isEqual(
          this.collectRootPropertyIdsExcluding(removalElementIds),
          preparedMutation.retainedRootPropertyIds
        )
      ) {
        throw new Error(
          '[SceneTree] Cannot apply stale element property relation set'
        )
      }
      artifact.parentChildrenBefore.forEach((children, parentId) => {
        const parent = this.getElementById(parentId)
        if (
          !parent ||
          !isGroupEntity(parent.get('type')) ||
          !isEqual(
            this.getContainerChildren(
              parent as GroupInstanceTypes,
              `Element removal parent "${parentId}"`
            ),
            children
          )
        ) {
          throw new Error(
            `[SceneTree] Cannot apply stale element removal parent "${parentId}"`
          )
        }
      })
      artifact.entries.forEach(({ element, data, parentId, index }) => {
        const parentChildren = artifact.parentChildrenBefore.get(parentId)
        if (
          this.getElementById(data.id) !== element ||
          !isEqual(element.save(), data) ||
          parentChildren?.[index] !== data.id
        ) {
          throw new Error(
            `[SceneTree] Cannot apply stale prepared element removal for "${data.id}"`
          )
        }
      })

      const changedParentIds: string[] = []
      let elementMapChanged = false
      const handoffState = createCanonicalBatchHandoffState()
      let disposalAttempted = false
      const disposeRemoved = (): void => {
        artifact.entries.forEach(({ element }) => {
          disposeElementComputed(element)
        })
      }
      try {
        artifact.parentChildrenAfter.forEach((children, parentId) => {
          const parent = this.getElementById(parentId) as GroupInstanceTypes
          changedParentIds.push(parentId)
          ;(this.currentWorkspace as Workspace).replaceBatchParentChildren(
            parent,
            children
          )
        })
        this.removeElementsFromCanonicalMap(
          removalElements,
          relationIndexUpdates
        )
        elementMapChanged = true
        artifact.entries.forEach(({ element }) => {
          ;(element as Element).assignCanonicalParentId('')
          this._deletedMap.set(element.get('id'), element)
        })
        transactionOwner.updateTransactionBatch(events)
        markCanonicalBatchHandoffAccepted(handoffState)
        acknowledgeTransactionReplayApplied()
        disposalAttempted = true
        disposeRemoved()
      } catch (error) {
        if (
          wasCanonicalBatchHandoffAccepted(handoffState) ||
          reportsAcceptedCanonicalBatchHandoff(error)
        ) {
          markCanonicalBatchHandoffAccepted(handoffState)
          acknowledgeTransactionReplayApplied()
          if (!disposalAttempted) {
            disposalAttempted = true
            disposeRemoved()
          }
        } else {
          if (elementMapChanged) {
            this.restoreElementsToCanonicalMap(
              removalElements,
              relationIndexUpdates
            )
            artifact.entries.forEach(({ element, parentId }) => {
              this._deletedMap.delete(element.get('id'))
              ;(element as Element).assignCanonicalParentId(parentId)
            })
          }
          changedParentIds.reverse().forEach((parentId) => {
            const children = artifact.parentChildrenBefore.get(parentId)
            if (!children) return
            const parent = this.getElementById(parentId) as GroupInstanceTypes
            ;(this.currentWorkspace as Workspace).replaceBatchParentChildren(
              parent,
              children
            )
          })
        }
        throw error
      }
    }

    return Object.freeze({
      orderedElementIds: preparedMutation.orderedElementIds,
      evidence: preparedMutation.evidence
    })
  }

  private captureElementPropertyContract(
    elements: Iterable<ElementRawData>
  ): PreparedElementPropertyContract {
    const registrationContractByType = new Map<
      string,
      ElementInsertionRegistrationContract
    >()
    const propertyTypeByComponentId = new Map<string, string>()
    const relations: PreparedElementPropertyRelation[] = []
    for (const elementData of elements) {
      if (elementData.type === EntityTypes.WORKSPACE) {
        continue
      }
      let registrationContract = registrationContractByType.get(
        elementData.type
      )
      if (!registrationContract) {
        const registration = componentRegistry.get(elementData.type)
        if (!registration) {
          throw new Error(
            `[SceneTree] Element "${elementData.id}" has an unregistered type`
          )
        }
        registrationContract = captureElementInsertionRegistrationContract(
          registration,
          elementData.type
        )
        registrationContractByType.set(elementData.type, registrationContract)
      }
      const sourceProps = elementData.props ?? {}
      if (!isRecord(sourceProps)) {
        throw new Error(
          `[SceneTree] Element "${elementData.id}" has invalid property relations`
        )
      }
      const definitionByName = new Map(
        registrationContract.effectiveDefinitions.map((definition) => [
          definition.name,
          definition
        ])
      )
      const propertyNames = Object.keys(sourceProps)
      if (
        propertyNames.length !== definitionByName.size ||
        propertyNames.some(
          (propertyName) => !definitionByName.has(propertyName)
        )
      ) {
        throw new Error(
          `[SceneTree] Element "${elementData.id}" requires exact registered property slots`
        )
      }
      registrationContract.effectiveDefinitions.forEach((definition) => {
        const componentId = sourceProps[definition.name]
        if (typeof componentId !== 'string' || componentId.length === 0) {
          throw new Error(
            `[SceneTree] Element "${elementData.id}" has an invalid property relation for "${definition.name}"`
          )
        }
        const existingPropertyType = propertyTypeByComponentId.get(componentId)
        if (
          existingPropertyType !== undefined &&
          existingPropertyType !== definition.type
        ) {
          throw new Error(
            `[SceneTree] Property "${componentId}" has incompatible registered property slots`
          )
        }
        propertyTypeByComponentId.set(componentId, definition.type)
        relations.push(
          Object.freeze({
            ownerElementId: elementData.id,
            ownerElementType: elementData.type,
            ownerPropertyName: definition.name,
            componentId,
            propertyType: definition.type
          })
        )
      })
    }
    return Object.freeze({
      relations: Object.freeze(relations),
      registrationContracts: Object.freeze(
        [...registrationContractByType.entries()].map(
          ([elementType, contract]) =>
            Object.freeze({
              elementType,
              contract
            })
        )
      )
    })
  }

  private assertElementPropertyContractActive(
    contract: PreparedElementPropertyContract
  ): void {
    this.assertElementPropertyRegistrationContractsCurrent(contract)
    contract.relations.forEach(
      ({ ownerElementId, ownerPropertyName, componentId, propertyType }) => {
        const property = this.propsManagerOwner.getPropertyById(componentId)
        if (
          !property ||
          property.get('id') !== componentId ||
          property.get('type') !== propertyType
        ) {
          throw new Error(
            `[SceneTree] Element "${ownerElementId}" has an invalid active property relation "${ownerPropertyName}" to "${componentId}"`
          )
        }
      }
    )
  }

  private assertElementPropertyRegistrationContractsCurrent(
    contract: PreparedElementPropertyContract
  ): void {
    contract.registrationContracts.forEach(({ elementType, contract }) => {
      if (
        !isElementInsertionRegistrationContractCurrent(contract, elementType)
      ) {
        throw new Error(
          `[SceneTree] Element type "${elementType}" has stale registered property slots`
        )
      }
    })
  }

  preflightLoadPropertyRelations(
    sceneValidation: SceneTreeLoadValidationResult,
    propsData: Readonly<PropsComponentRawData>
  ): void {
    const artifact = this.validatedLoadArtifacts.get(sceneValidation)
    if (!artifact) {
      throw new Error(
        '[SceneTree] Expected an owner-issued validated load artifact for property relation preflight'
      )
    }
    if (!artifact.valid) {
      throw new Error(
        '[SceneTree] Cannot preflight property relations for an invalid hierarchy'
      )
    }
    if (artifact.propertyContractError || !artifact.propertyContract) {
      throw new Error(
        artifact.propertyContractError ??
          '[SceneTree] Validated load is missing exact property relation evidence'
      )
    }
    if (!isRecord(propsData)) {
      throw new Error(
        '[SceneTree] Detached Props validated data must be an exact component map'
      )
    }

    this.assertElementPropertyRegistrationContractsCurrent(
      artifact.propertyContract
    )
    artifact.propertyContract.relations.forEach(
      ({ ownerElementId, ownerPropertyName, componentId, propertyType }) => {
        const propertyData = propsData[componentId]
        if (
          !isRecord(propertyData) ||
          propertyData.id !== componentId ||
          propertyData.type !== propertyType
        ) {
          throw new Error(
            `[SceneTree] Element "${ownerElementId}" has an invalid detached property relation "${ownerPropertyName}" to "${componentId}"`
          )
        }
      }
    )
  }

  private createLoadValidationResult(
    data: SceneTreeRawData,
    diagnostics: SceneTreeLoadDiagnostic[],
    valid = true
  ): SceneTreeLoadValidationResult {
    const validatedSnapshot = cloneLoadData(data)
    let propertyContract: PreparedElementPropertyContract | undefined
    let propertyContractError: string | undefined
    try {
      propertyContract = this.captureElementPropertyContract(
        Object.values(validatedSnapshot.elements)
      )
    } catch (error) {
      propertyContractError =
        error instanceof Error ? error.message : String(error)
    }
    const result = {
      data: cloneLoadData(validatedSnapshot),
      diagnostics,
      valid
    }
    this.validatedLoadArtifacts.set(result, {
      data: validatedSnapshot,
      valid,
      propertyContract,
      propertyContractError
    })
    return result
  }

  private validateNormalizedLoadHierarchy(
    data: SceneTreeRawData,
    diagnostics: SceneTreeLoadDiagnostic[]
  ): boolean {
    let valid = true
    const reject = (path: string, message: string): void => {
      diagnostics.push({ path, message })
      valid = false
    }
    const entries = Object.entries(data.elements)
    const workspaceIds = entries
      .filter(([, element]) => element.type === EntityTypes.WORKSPACE)
      .map(([elementId]) => elementId)
    const nonWorkspaceIds = entries
      .filter(([, element]) => element.type !== EntityTypes.WORKSPACE)
      .map(([elementId]) => elementId)

    if (workspaceIds.length === 0) {
      if (nonWorkspaceIds.length > 0) {
        reject(
          'sceneTree.workspace',
          'Hierarchy with elements requires an existing workspace root'
        )
      }
      if (data.workspace.length > 0 || data.workspaceList.length > 0) {
        reject(
          'sceneTree.workspace',
          'Workspace metadata cannot reference missing workspace roots'
        )
      }
    } else {
      if (!workspaceIds.includes(data.workspace)) {
        reject(
          'sceneTree.workspace',
          'Active workspace must reference an existing workspace element'
        )
      }
      if (new Set(data.workspaceList).size !== data.workspaceList.length) {
        reject(
          'sceneTree.workspaceList',
          'Workspace list cannot contain duplicate roots'
        )
      }
      data.workspaceList.forEach((workspaceId, index) => {
        if (!workspaceIds.includes(workspaceId)) {
          reject(
            `sceneTree.workspaceList.${index}`,
            `Workspace root "${workspaceId}" is missing or has the wrong type`
          )
        }
      })
      workspaceIds.forEach((workspaceId) => {
        if (!data.workspaceList.includes(workspaceId)) {
          reject(
            'sceneTree.workspaceList',
            `Workspace root "${workspaceId}" is missing from workspaceList`
          )
        }
      })
    }

    const membership = new Map<string, string>()
    entries.forEach(([parentId, parent]) => {
      if (!isGroupEntity(parent.type)) {
        return
      }
      const children = (parent as GroupRawData).children
      if (!Array.isArray(children)) {
        reject(
          `sceneTree.elements.${parentId}.children`,
          'Registered containers require a children array'
        )
        return
      }

      const localChildren = new Set<string>()
      children.forEach((childId, index) => {
        const childPath = `sceneTree.elements.${parentId}.children.${index}`
        if (localChildren.has(childId) || membership.has(childId)) {
          reject(
            childPath,
            `Element "${childId}" has duplicate hierarchy membership`
          )
          return
        }
        localChildren.add(childId)
        membership.set(childId, parentId)

        const child = data.elements[childId]
        if (!child) {
          reject(childPath, `Hierarchy child "${childId}" is missing`)
          return
        }
        if (child.type === EntityTypes.WORKSPACE) {
          reject(childPath, 'Workspace roots cannot be hierarchy children')
        }
        if (child.parentId !== parentId) {
          reject(
            childPath,
            `Hierarchy child "${childId}" disagrees with parentId`
          )
        }
      })
    })

    nonWorkspaceIds.forEach((elementId) => {
      const element = data.elements[elementId]
      const parentId = element.parentId ?? ''
      const parent = data.elements[parentId]
      if (!parent || !isGroupEntity(parent.type)) {
        reject(
          `sceneTree.elements.${elementId}.parentId`,
          `Element "${elementId}" requires an existing registered container parent`
        )
      }
      if (membership.get(elementId) !== parentId) {
        reject(
          `sceneTree.elements.${elementId}.parentId`,
          `Element "${elementId}" must appear exactly once in its parent children`
        )
      }

      const visited = new Set<string>([elementId])
      let ancestorId = parentId
      while (ancestorId) {
        if (visited.has(ancestorId)) {
          reject(
            `sceneTree.elements.${elementId}.parentId`,
            `Hierarchy cycle detected at "${elementId}"`
          )
          break
        }
        visited.add(ancestorId)
        const ancestor = data.elements[ancestorId]
        if (!ancestor || ancestor.type === EntityTypes.WORKSPACE) {
          break
        }
        ancestorId = ancestor.parentId ?? ''
      }
    })

    return valid
  }

  validateLoadData(data: unknown): SceneTreeLoadValidationResult {
    const diagnostics: SceneTreeLoadDiagnostic[] = []
    const fallback: SceneTreeDataType = {
      workspace: '',
      workspaceList: [],
      elements: {}
    }

    if (!isRecord(data)) {
      diagnostics.push({
        path: 'sceneTree',
        message: 'Expected object payload for scene tree load'
      })
      return this.createLoadValidationResult(fallback, diagnostics, false)
    }

    const workspace = typeof data.workspace === 'string' ? data.workspace : ''
    if (data.workspace !== undefined && typeof data.workspace !== 'string') {
      diagnostics.push({
        path: 'sceneTree.workspace',
        message: 'Invalid workspace id type, fallback to empty workspace id'
      })
    }

    const workspaceList = toStringArray(data.workspaceList)
    if (
      data.workspaceList !== undefined &&
      !Array.isArray(data.workspaceList)
    ) {
      diagnostics.push({
        path: 'sceneTree.workspaceList',
        message: 'Invalid workspace list type, fallback to empty workspace list'
      })
    }

    const elements: Record<string, ElementRawData | GroupRawData> = {}
    let hasDuplicateElementIds = false
    if (data.elements === undefined) {
      diagnostics.push({
        path: 'sceneTree.elements',
        message: 'Missing elements map, fallback to empty map'
      })
    } else if (!isRecord(data.elements)) {
      diagnostics.push({
        path: 'sceneTree.elements',
        message: 'Invalid elements map type, fallback to empty map'
      })
    } else {
      Object.entries(data.elements).forEach(([entryId, rawElement]) => {
        if (!isRecord(rawElement)) {
          diagnostics.push({
            path: `sceneTree.elements.${entryId}`,
            message: 'Skipped non-object element during load'
          })
          return
        }

        const rawType = rawElement.type
        if (typeof rawType !== 'string' || rawType.length === 0) {
          diagnostics.push({
            path: `sceneTree.elements.${entryId}.type`,
            message: 'Skipped element with invalid type during load'
          })
          return
        }

        if (
          rawType !== EntityTypes.WORKSPACE &&
          !componentRegistry.has(rawType)
        ) {
          diagnostics.push({
            path: `sceneTree.elements.${entryId}.type`,
            message: `Skipped unregistered element type "${rawType}" during load`
          })
          return
        }

        const normalizedId =
          typeof rawElement.id === 'string' && rawElement.id.length > 0
            ? rawElement.id
            : entryId
        const normalizedName =
          typeof rawElement.name === 'string' && rawElement.name.length > 0
            ? rawElement.name
            : normalizedId
        const visible =
          typeof rawElement.visible === 'boolean' ? rawElement.visible : true
        const lock =
          typeof rawElement.lock === 'boolean' ? rawElement.lock : false
        const parentId =
          typeof rawElement.parentId === 'string' ? rawElement.parentId : ''

        const normalized: Record<string, unknown> = {
          ...rawElement,
          id: normalizedId,
          type: rawType,
          name: normalizedName,
          parentId,
          visible,
          lock
        }

        if (
          rawElement.parentId !== undefined &&
          typeof rawElement.parentId !== 'string'
        ) {
          diagnostics.push({
            path: `sceneTree.elements.${entryId}.parentId`,
            message: 'Invalid parent id type, fallback to empty parent id'
          })
        }

        if (isGroupEntity(rawType)) {
          normalized.children = toStringArray(rawElement.children)
        }

        if (rawElement.props !== undefined) {
          if (!isRecord(rawElement.props)) {
            diagnostics.push({
              path: `sceneTree.elements.${entryId}.props`,
              message: 'Invalid props map type, fallback to empty props map'
            })
            normalized.props = {}
          } else {
            const propsMap: Record<string, string> = {}
            Object.entries(rawElement.props).forEach(([key, value]) => {
              if (typeof value === 'string') {
                propsMap[key] = value
              } else {
                diagnostics.push({
                  path: `sceneTree.elements.${entryId}.props.${key}`,
                  message: 'Skipped non-string prop reference during load'
                })
              }
            })
            normalized.props = propsMap
          }
        }

        if (Object.prototype.hasOwnProperty.call(elements, normalizedId)) {
          diagnostics.push({
            path: `sceneTree.elements.${entryId}.id`,
            message: `Duplicate normalized element id "${normalizedId}"`
          })
          hasDuplicateElementIds = true
          return
        }

        elements[normalizedId] = normalized as unknown as
          | ElementRawData
          | GroupRawData
      })
    }

    const normalizedData = {
      workspace,
      workspaceList,
      elements
    }
    const hierarchyValid = this.validateNormalizedLoadHierarchy(
      normalizedData,
      diagnostics
    )
    return this.createLoadValidationResult(
      normalizedData,
      diagnostics,
      hierarchyValid && !hasDuplicateElementIds
    )
  }

  applyValidatedLoad(result: SceneTreeLoadValidationResult): void {
    const artifact = this.validatedLoadArtifacts.get(result)
    if (!artifact) {
      throw new Error(
        '[SceneTree] Expected an owner-issued one-shot validated load artifact'
      )
    }
    this.validatedLoadArtifacts.delete(result)
    if (!artifact.valid) {
      throw new Error(
        '[SceneTree] Cannot apply invalid hierarchy from validated load artifact'
      )
    }
    if (artifact.propertyContractError || !artifact.propertyContract) {
      throw new Error(
        artifact.propertyContractError ??
          '[SceneTree] Validated load is missing exact property relation evidence'
      )
    }
    this.assertElementPropertyContractActive(artifact.propertyContract)
    const validated = artifact.data
    const nextElements = new Map<string, ElementInstanceTypes>()
    let nextRelations: Map<string, readonly ElementPropertyRelation[]>
    try {
      for (const [elementId, elementData] of Object.entries(
        validated.elements
      )) {
        const element =
          elementData.type === EntityTypes.WORKSPACE
            ? createWorkspace(this, elementData)
            : createElement(elementData, this.propsManagerOwner)
        if (!element) {
          throw new Error(
            `[SceneTree] Validated hierarchy element "${elementId}" could not be constructed`
          )
        }
        nextElements.set(elementId, element as ElementInstanceTypes)
        if (!isEqual(element.save(), elementData)) {
          throw new Error(
            `[SceneTree] Validated hierarchy element "${elementId}" changed exact load data`
          )
        }
      }
      nextRelations = this.buildElementPropertyRelationIndex(
        nextElements.values()
      )
    } catch (error) {
      nextElements.forEach((element) => {
        try {
          disposeElementComputed(element)
        } catch {
          // Preserve the first load owner failure while attempting all cleanup.
        }
      })
      throw error
    }

    const previousElements = [
      ...this._elements.values(),
      ...this._deletedMap.values()
    ]
    this.replaceCanonicalElementMap(nextElements, nextRelations)
    this._deletedMap.clear()
    this.changes = []
    this.workspaceList = [...validated.workspaceList]
    this.workspace = validated.workspace
    if (nextElements.size === 0) this._init()
    this.projectLocalComputedDataFromPropertyIds([...nextRelations.keys()])
    previousElements.forEach((element) => {
      try {
        disposeElementComputed(element)
      } catch {
        // Canonical load already succeeded; stale cleanup cannot reverse it.
      }
    })
  }

  load(data: SceneTreeDataType | unknown) {
    const result = this.validateLoadData(data)
    this.applyValidatedLoad(result)
  }

  save() {
    this.validateCanonicalHierarchy()
    const data: SceneTreeRawData = {
      workspace: this.workspace,
      workspaceList: this.workspaceList,
      elements: {}
    }

    this._elements.forEach((element, id) => {
      data.elements[id] = element.save()
    })

    return data
  }

  addChange(change: SceneTreeChange) {
    this.changes.push(change)
  }

  cleanChanges() {
    this.changes = []
  }

  getAllElements() {
    return this._elements
  }

  getElementById(elementId: string): ElementInstanceTypes | undefined {
    return this._elements.get(elementId)
  }

  private getContainerChildren(
    element: ElementInstanceTypes,
    context: string
  ): string[] {
    if (!isGroupEntity(element.get('type'))) {
      throw new Error(`[SceneTree] ${context} must be a registered container`)
    }

    const children = (element as GroupInstanceTypes).get('children')
    if (
      !Array.isArray(children) ||
      children.some((childId) => typeof childId !== 'string')
    ) {
      throw new Error(
        `[SceneTree] ${context} must expose a valid children list`
      )
    }

    return [...children]
  }

  private validateCanonicalHierarchy(): void {
    const membership = new Map<string, string>()

    this._elements.forEach((parent, parentId) => {
      if (!isGroupEntity(parent.get('type'))) {
        return
      }

      const children = this.getContainerChildren(
        parent,
        `Container "${parentId}"`
      )
      const localChildren = new Set<string>()
      children.forEach((childId) => {
        if (localChildren.has(childId) || membership.has(childId)) {
          throw new Error(
            `[SceneTree] Invalid canonical hierarchy: duplicate membership for "${childId}"`
          )
        }
        localChildren.add(childId)
        membership.set(childId, parentId)

        const child = this.getElementById(childId)
        if (!child) {
          throw new Error(
            `[SceneTree] Invalid canonical hierarchy: missing child "${childId}"`
          )
        }
        if (child.get('parentId') !== parentId) {
          throw new Error(
            `[SceneTree] Invalid canonical hierarchy: parent mismatch for "${childId}"`
          )
        }
      })
    })

    this._elements.forEach((element, elementId) => {
      if (element.get('type') === EntityTypes.WORKSPACE) {
        return
      }

      const parentId = element.get('parentId')
      const parent = this.getElementById(parentId)
      if (!parent || !isGroupEntity(parent.get('type'))) {
        throw new Error(
          `[SceneTree] Invalid canonical hierarchy: missing container parent for "${elementId}"`
        )
      }
      if (membership.get(elementId) !== parentId) {
        throw new Error(
          `[SceneTree] Invalid canonical hierarchy: missing membership for "${elementId}"`
        )
      }

      const visited = new Set<string>([elementId])
      let ancestorId = parentId
      while (ancestorId) {
        if (visited.has(ancestorId)) {
          throw new Error(
            `[SceneTree] Invalid canonical hierarchy: cycle at "${elementId}"`
          )
        }
        visited.add(ancestorId)
        const ancestor = this.getElementById(ancestorId)
        if (!ancestor || ancestor.get('type') === EntityTypes.WORKSPACE) {
          break
        }
        ancestorId = ancestor.get('parentId')
      }
    })
  }

  private assertMoveDoesNotCreateCycle(
    elementIds: readonly string[],
    targetParentId: string
  ): void {
    const movedIds = new Set(elementIds)
    let ancestorId = targetParentId

    while (ancestorId) {
      if (movedIds.has(ancestorId)) {
        throw new Error(
          '[SceneTree] Invalid hierarchy request: self-parenting or descendant cycle'
        )
      }
      const ancestor = this.getElementById(ancestorId)
      if (!ancestor || ancestor.get('type') === EntityTypes.WORKSPACE) {
        return
      }
      ancestorId = ancestor.get('parentId')
    }
  }

  private applyValidatedHierarchyMoves(moves: readonly HierarchyMove[]): void {
    const movedIds = new Set(moves.map(({ elementId }) => elementId))
    const affectedParentIds = new Set<string>()
    const originalChildren = new Map<string, string[]>()

    moves.forEach(({ before, after }) => {
      affectedParentIds.add(before.parentId)
      affectedParentIds.add(after.parentId)
    })

    const nextChildren = new Map<string, string[]>()
    affectedParentIds.forEach((parentId) => {
      const parent = this.getElementById(parentId)
      if (!parent) {
        throw new Error(
          `[SceneTree] Cannot apply hierarchy move: missing parent "${parentId}"`
        )
      }
      const children = this.getContainerChildren(
        parent,
        `Hierarchy parent "${parentId}"`
      )
      originalChildren.set(parentId, children)
      nextChildren.set(
        parentId,
        children.filter((childId) => !movedIds.has(childId))
      )
    })

    moves
      .slice()
      .sort(
        (left, right) =>
          left.after.parentId.localeCompare(right.after.parentId) ||
          left.after.index - right.after.index
      )
      .forEach(({ elementId, after }) => {
        const children = nextChildren.get(after.parentId)
        if (!children || after.index < 0 || after.index > children.length) {
          throw new Error(
            `[SceneTree] Cannot apply hierarchy move: invalid exact index for "${elementId}"`
          )
        }
        children.splice(after.index, 0, elementId)
      })

    const operationChangeStart = this.changes.length
    try {
      nextChildren.forEach((children, parentId) => {
        const parent = this.getElementById(parentId) as GroupInstanceTypes
        parent.set('children', children)
      })
      moves.forEach(({ elementId, after }) => {
        const element = this.getElementById(elementId)
        if (!element) {
          throw new Error(
            `[SceneTree] Cannot apply hierarchy move: missing element "${elementId}"`
          )
        }
        element.set('parentId', after.parentId, { undoable: false })
      })
    } catch (error) {
      originalChildren.forEach((children, parentId) => {
        const parent = this.getElementById(parentId) as GroupInstanceTypes
        parent.set('children', children, { undoable: false })
      })
      moves.forEach(({ elementId, before }) => {
        this.getElementById(elementId)?.set('parentId', before.parentId, {
          undoable: false
        })
      })
      this.changes.splice(operationChangeStart)
      throw error
    }
  }

  moveElements(
    request: MoveHierarchyRequest,
    options?: EVENT_OPTIONS
  ): MoveHierarchyResult {
    this.validateCanonicalHierarchy()

    if (
      !request ||
      !Array.isArray(request.elementIds) ||
      request.elementIds.length === 0 ||
      request.elementIds.some(
        (elementId) => typeof elementId !== 'string' || elementId.length === 0
      )
    ) {
      throw new Error(
        '[SceneTree] Invalid hierarchy request: elementIds must be a non-empty string array'
      )
    }

    const requestedIds = [...request.elementIds]
    if (new Set(requestedIds).size !== requestedIds.length) {
      throw new Error(
        '[SceneTree] Invalid hierarchy request: elementIds must be unique'
      )
    }

    const elements = requestedIds.map((elementId) => {
      const element = this.getElementById(elementId)
      if (!element) {
        throw new Error(
          `[SceneTree] Invalid hierarchy request: missing element "${elementId}"`
        )
      }
      if (element.get('type') === EntityTypes.WORKSPACE) {
        throw new Error(
          '[SceneTree] Invalid hierarchy request: workspace movement is forbidden'
        )
      }
      return element
    })

    const sourceParentId = elements[0].get('parentId')
    if (
      elements.some((element) => element.get('parentId') !== sourceParentId)
    ) {
      throw new Error(
        '[SceneTree] Invalid hierarchy request: elementIds must share one parent'
      )
    }

    const sourceParent = this.getElementById(sourceParentId)
    if (!sourceParent) {
      throw new Error(
        `[SceneTree] Invalid hierarchy request: missing source parent "${sourceParentId}"`
      )
    }
    const sourceChildren = this.getContainerChildren(
      sourceParent,
      `Source parent "${sourceParentId}"`
    )
    const requestedIdSet = new Set(requestedIds)
    const canonicalIds = sourceChildren.filter((childId) =>
      requestedIdSet.has(childId)
    )
    if (canonicalIds.length !== requestedIds.length) {
      throw new Error(
        '[SceneTree] Invalid hierarchy request: source membership is incomplete'
      )
    }

    const targetParent = this.getElementById(request.targetParentId)
    if (!targetParent) {
      throw new Error(
        `[SceneTree] Invalid hierarchy request: missing target "${request.targetParentId}"`
      )
    }
    const targetChildren = this.getContainerChildren(
      targetParent,
      `Target "${request.targetParentId}"`
    )
    const targetBase = targetChildren.filter(
      (childId) => !requestedIdSet.has(childId)
    )
    if (
      !Number.isInteger(request.targetIndex) ||
      request.targetIndex < 0 ||
      request.targetIndex > targetBase.length
    ) {
      throw new Error(
        '[SceneTree] Invalid hierarchy request: targetIndex is outside the final target insertion range'
      )
    }

    this.assertMoveDoesNotCreateCycle(canonicalIds, request.targetParentId)

    const nextTargetChildren = [...targetBase]
    nextTargetChildren.splice(request.targetIndex, 0, ...canonicalIds)
    if (
      sourceParentId === request.targetParentId &&
      isEqual(nextTargetChildren, sourceChildren)
    ) {
      return { elementIds: canonicalIds, moves: [] }
    }

    const moves: HierarchyMove[] = canonicalIds.map((elementId, offset) => ({
      elementId,
      before: {
        parentId: sourceParentId,
        index: sourceChildren.indexOf(elementId)
      },
      after: {
        parentId: request.targetParentId,
        index: request.targetIndex + offset
      }
    }))

    const operationChangeStart = this.changes.length
    this.applyValidatedHierarchyMoves(moves)
    this.changes.splice(operationChangeStart)
    this.addChange({
      action: SCENE_TREE_ACTIONS.MOVE_ELEMENTS,
      eventName: EventTypes.MOVE_ELEMENTS,
      moves
    })
    acknowledgeTransactionReplayApplied()
    this.commitSceneTreeTransaction(options)

    return { elementIds: canonicalIds, moves }
  }

  applyHierarchyMoves(
    moves: readonly HierarchyMove[],
    options?: EVENT_OPTIONS
  ): boolean {
    this.validateCanonicalHierarchy()
    if (!Array.isArray(moves) || moves.length === 0) {
      return false
    }

    const elementIds = moves.map(({ elementId }) => elementId)
    if (new Set(elementIds).size !== elementIds.length) {
      throw new Error(
        '[SceneTree] Cannot apply hierarchy move: duplicate element evidence'
      )
    }
    const sourceParentId = moves[0].before.parentId
    const targetParentId = moves[0].after.parentId
    const targetStartIndex = moves[0].after.index
    const sourceIndices = new Set<number>()
    const targetIndices = new Set<number>()
    for (const [index, { before, after }] of moves.entries()) {
      if (
        before.parentId !== sourceParentId ||
        after.parentId !== targetParentId ||
        !Number.isInteger(before.index) ||
        before.index < 0 ||
        sourceIndices.has(before.index) ||
        !Number.isInteger(after.index) ||
        after.index < 0 ||
        targetIndices.has(after.index) ||
        after.index !== targetStartIndex + index
      ) {
        throw new Error(
          '[SceneTree] Cannot apply hierarchy move: invalid canonical target batch'
        )
      }
      sourceIndices.add(before.index)
      targetIndices.add(after.index)
    }

    moves.forEach(({ elementId, before, after }) => {
      const element = this.getElementById(elementId)
      if (
        !element ||
        element.get('parentId') !== before.parentId ||
        this.getContainerChildren(
          this.getElementById(before.parentId) as ElementInstanceTypes,
          `Replay source "${before.parentId}"`
        )[before.index] !== elementId
      ) {
        throw new Error(
          `[SceneTree] Cannot apply hierarchy move: stale before image for "${elementId}"`
        )
      }
      if (!this.getElementById(after.parentId)) {
        throw new Error(
          `[SceneTree] Cannot apply hierarchy move: missing target "${after.parentId}"`
        )
      }
    })
    this.getContainerChildren(
      this.getElementById(targetParentId) as ElementInstanceTypes,
      `Replay target "${targetParentId}"`
    )
    this.assertMoveDoesNotCreateCycle(elementIds, targetParentId)

    const operationChangeStart = this.changes.length
    this.applyValidatedHierarchyMoves(moves)
    this.changes.splice(operationChangeStart)
    this.addChange({
      action: SCENE_TREE_ACTIONS.MOVE_ELEMENTS,
      eventName: EventTypes.MOVE_ELEMENTS,
      moves: moves.map((move) => ({
        elementId: move.elementId,
        before: { ...move.before },
        after: { ...move.after }
      }))
    })
    acknowledgeTransactionReplayApplied()
    this.commitSceneTreeTransaction(options)
    return true
  }

  private collectSubtreeRemovalEntries(
    elementId: string
  ): SubtreeRemovalEntry[] {
    const root = this.getElementById(elementId)
    if (!root) {
      throw new Error(
        `[SceneTree] Invalid subtree request: missing element "${elementId}"`
      )
    }
    if (root.get('type') === EntityTypes.WORKSPACE) {
      throw new Error(
        '[SceneTree] Invalid subtree request: workspace removal is forbidden'
      )
    }

    const removed: SubtreeRemovalEntry[] = []
    const visit = (current: ElementInstanceTypes): void => {
      if (isGroupEntity(current.get('type'))) {
        this.getContainerChildren(
          current,
          `Subtree container "${current.get('id')}"`
        ).forEach((childId) => {
          const child = this.getElementById(childId)
          if (!child) {
            throw new Error(
              `[SceneTree] Invalid subtree request: missing child "${childId}"`
            )
          }
          visit(child)
        })
      }

      const currentId = current.get('id')
      const parentId = current.get('parentId')
      const parent = this.getElementById(parentId)
      const index = parent
        ? this.getContainerChildren(
            parent,
            `Subtree parent "${parentId}"`
          ).indexOf(currentId)
        : -1
      if (index < 0) {
        throw new Error(
          `[SceneTree] Invalid subtree request: missing membership for "${currentId}"`
        )
      }
      removed.push({
        elementId: currentId,
        parentId,
        index,
        data: current.save()
      })
    }
    visit(root)
    return removed
  }

  removeSubtree(
    elementId: string,
    options?: EVENT_OPTIONS
  ): RemoveSubtreeResult {
    const preparedMutation = this.prepareSubtreeRemoval(elementId)
    const change = preparedMutation.evidence[0]
    this.applyPreparedElementMutation(preparedMutation, options)
    return Object.freeze({
      elementId: change.elementId,
      removed: change.removed,
      rootParentChildrenAfter: change.rootParentChildrenAfter
    })
  }

  preflightRestoreSubtree(snapshot: unknown): PreparedSceneTreeRestore {
    this.validateCanonicalHierarchy()
    if (!isRecord(snapshot)) {
      throw new Error(
        '[SceneTree] Invalid subtree restore: snapshot must be a record'
      )
    }
    if (
      typeof snapshot.elementId !== 'string' ||
      snapshot.elementId.length === 0 ||
      !Array.isArray(snapshot.removed) ||
      snapshot.removed.length === 0 ||
      !Array.isArray(snapshot.rootParentChildrenAfter) ||
      snapshot.rootParentChildrenAfter.some(
        (childId) => typeof childId !== 'string'
      )
    ) {
      throw new Error(
        '[SceneTree] Invalid subtree restore: exact hierarchy evidence is required'
      )
    }

    const validated = cloneSceneTreeValue(
      snapshot as unknown as SceneTreeRestoreSnapshot
    )
    const rootParentChildrenAfter = [...validated.rootParentChildrenAfter]
    if (
      new Set(rootParentChildrenAfter).size !== rootParentChildrenAfter.length
    ) {
      throw new Error(
        '[SceneTree] Invalid subtree restore: duplicate root-parent order evidence'
      )
    }

    const entries = validated.removed
    const entryIds = entries.map(({ elementId }) => elementId)
    if (
      entryIds.some((elementId) => typeof elementId !== 'string') ||
      new Set(entryIds).size !== entryIds.length
    ) {
      throw new Error(
        '[SceneTree] Invalid subtree restore: duplicate or invalid element evidence'
      )
    }
    entries.forEach((entry) => {
      if (this.getElementById(entry.elementId)) {
        throw new Error(
          `[SceneTree] Invalid subtree restore: active element "${entry.elementId}" already exists`
        )
      }
      if (
        typeof entry.parentId !== 'string' ||
        !Number.isInteger(entry.index) ||
        entry.index < 0 ||
        !isRecord(entry.data) ||
        entry.data.id !== entry.elementId ||
        entry.data.parentId !== entry.parentId ||
        typeof entry.data.type !== 'string'
      ) {
        throw new Error(
          `[SceneTree] Invalid subtree restore: malformed element evidence for "${entry.elementId}"`
        )
      }
      if (!componentRegistry.has(entry.data.type)) {
        throw new Error(
          `[SceneTree] Invalid subtree restore: unregistered element type "${entry.data.type}"`
        )
      }
      if (
        typeof entry.data.name !== 'string' ||
        typeof entry.data.visible !== 'boolean' ||
        typeof entry.data.lock !== 'boolean' ||
        (entry.data.props !== undefined &&
          (!isRecord(entry.data.props) ||
            Object.values(entry.data.props).some(
              (propertyId) => typeof propertyId !== 'string'
            )))
      ) {
        throw new Error(
          `[SceneTree] Invalid subtree restore: malformed raw data for "${entry.elementId}"`
        )
      }
    })

    const entryById = new Map(
      entries.map((entry) => [entry.elementId, entry] as const)
    )
    const rootEntry = entries[entries.length - 1]
    if (rootEntry.elementId !== validated.elementId) {
      throw new Error(
        '[SceneTree] Invalid subtree restore: root evidence must be the final post-order entry'
      )
    }
    const rootParent = this.getElementById(rootEntry.parentId)
    if (!rootParent || !isGroupEntity(rootParent.get('type'))) {
      throw new Error(
        `[SceneTree] Invalid subtree restore: missing container parent "${rootEntry.parentId}"`
      )
    }
    const currentRootParentChildren = this.getContainerChildren(
      rootParent,
      `Restore root parent "${rootEntry.parentId}"`
    )
    if (!isEqual(currentRootParentChildren, rootParentChildrenAfter)) {
      throw new Error(
        '[SceneTree] Invalid subtree restore: stale post-delete root-parent order evidence'
      )
    }
    if (
      rootEntry.index > rootParentChildrenAfter.length ||
      rootParentChildrenAfter.includes(rootEntry.elementId)
    ) {
      throw new Error(
        `[SceneTree] Invalid subtree restore: root index for "${rootEntry.elementId}" is outside the exact parent range`
      )
    }

    const childrenByParent = new Map<string, SubtreeRemovalEntry[]>()
    entries.forEach((entry) => {
      if (entry.elementId === rootEntry.elementId) return
      if (!entryById.has(entry.parentId)) {
        throw new Error(
          `[SceneTree] Invalid subtree restore: missing snapshot parent "${entry.parentId}"`
        )
      }
      const children = childrenByParent.get(entry.parentId) ?? []
      children.push(entry)
      childrenByParent.set(entry.parentId, children)
    })

    entries.forEach((entry) => {
      const declaredChildren = isGroupEntity(entry.data.type)
        ? (entry.data as GroupRawData).children
        : undefined
      const childEntries = (childrenByParent.get(entry.elementId) ?? []).sort(
        (left, right) => left.index - right.index
      )
      if (!isGroupEntity(entry.data.type)) {
        if (childEntries.length > 0 || declaredChildren !== undefined) {
          throw new Error(
            `[SceneTree] Invalid subtree restore: inconsistent child order for "${entry.elementId}"`
          )
        }
        return
      }
      if (
        !Array.isArray(declaredChildren) ||
        declaredChildren.some((childId) => typeof childId !== 'string') ||
        new Set(declaredChildren).size !== declaredChildren.length ||
        childEntries.some((child, index) => child.index !== index) ||
        !isEqual(
          declaredChildren,
          childEntries.map(({ elementId }) => elementId)
        )
      ) {
        throw new Error(
          `[SceneTree] Invalid subtree restore: inconsistent child order for "${entry.elementId}"`
        )
      }
    })

    const postOrder: string[] = []
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const visit = (elementId: string): void => {
      if (visiting.has(elementId)) {
        throw new Error(
          `[SceneTree] Invalid subtree restore: cycle at "${elementId}"`
        )
      }
      if (visited.has(elementId)) return
      const entry = entryById.get(elementId)
      if (!entry) {
        throw new Error(
          `[SceneTree] Invalid subtree restore: inconsistent child order at "${elementId}"`
        )
      }
      visiting.add(elementId)
      if (isGroupEntity(entry.data.type)) {
        ;(entry.data as GroupRawData).children.forEach(visit)
      }
      visiting.delete(elementId)
      visited.add(elementId)
      postOrder.push(elementId)
    }
    visit(rootEntry.elementId)
    if (visited.size !== entries.length || !isEqual(postOrder, entryIds)) {
      throw new Error(
        '[SceneTree] Invalid subtree restore: inconsistent child order or disconnected hierarchy'
      )
    }

    const propertyContract = this.captureElementPropertyContract(
      entries.map(({ data }) => data)
    )
    this.assertElementPropertyContractActive(propertyContract)
    const preparedEntries = entries.map((entry) => {
      const tombstone = this._deletedMap.get(entry.elementId)
      let strategy: SceneTreeRestoreStrategy = 'materialize'
      if (tombstone) {
        const tombstoneData = cloneSceneTreeValue(tombstone.save())
        const expectedTombstoneData = cloneSceneTreeValue(entry.data)
        expectedTombstoneData.parentId = ''
        if (isGroupEntity(entry.data.type)) {
          ;(expectedTombstoneData as GroupRawData).children = []
        }
        if (
          tombstone.get('type') !== entry.data.type ||
          !isEqual(tombstoneData, expectedTombstoneData)
        ) {
          throw new Error(
            `[SceneTree] Invalid subtree restore: incompatible tombstone for "${entry.elementId}"`
          )
        }
        strategy = 'reuse'
      }
      return Object.freeze({ elementId: entry.elementId, strategy })
    })
    const propertyOwnerRelations = propertyContract.relations.map(
      ({ ownerElementId, ownerElementType, ownerPropertyName, componentId }) =>
        Object.freeze({
          ownerElementId,
          ownerElementType,
          ownerPropertyName,
          componentId
        })
    )
    const preparedRestore: PreparedSceneTreeRestore = Object.freeze({
      kind: 'prepared-scene-tree-restore',
      elementId: rootEntry.elementId,
      entries: Object.freeze(preparedEntries),
      propertyOwnerRelations: Object.freeze(propertyOwnerRelations)
    })
    this.validatedRestoreArtifacts.set(preparedRestore, {
      snapshot: validated,
      propertyContract
    })
    return preparedRestore
  }

  applyRestoreSubtree(
    preparedRestore: PreparedSceneTreeRestore,
    options?: EVENT_OPTIONS
  ): RemoveSubtreeResult {
    const artifact = this.validatedRestoreArtifacts.get(preparedRestore)
    if (!artifact) {
      throw new Error(
        '[SceneTree] Expected an owner-issued one-shot prepared subtree restore'
      )
    }
    this.validatedRestoreArtifacts.delete(preparedRestore)
    this.assertElementPropertyContractActive(artifact.propertyContract)

    const revalidatedRestore = this.preflightRestoreSubtree(artifact.snapshot)
    const verificationArtifact =
      this.validatedRestoreArtifacts.get(revalidatedRestore)
    this.validatedRestoreArtifacts.delete(revalidatedRestore)
    if (
      !verificationArtifact ||
      !isEqual(revalidatedRestore.entries, preparedRestore.entries) ||
      !isEqual(
        revalidatedRestore.propertyOwnerRelations,
        preparedRestore.propertyOwnerRelations
      )
    ) {
      throw new Error(
        '[SceneTree] Cannot apply subtree restore: prepared restore is stale'
      )
    }
    const snapshot = verificationArtifact.snapshot
    const strategyByElementId = new Map(
      preparedRestore.entries.map(({ elementId, strategy }) => [
        elementId,
        strategy
      ])
    )
    const entryById = new Map(
      snapshot.removed.map((entry) => [entry.elementId, entry] as const)
    )
    const prepared = new Map<string, ElementInstanceTypes>()
    try {
      preparedRestore.entries.forEach(({ elementId, strategy }) => {
        const entry = entryById.get(elementId)
        if (!entry) {
          throw new Error(
            `[SceneTree] Cannot apply subtree restore: missing prepared evidence for "${elementId}"`
          )
        }
        if (strategy === 'reuse') {
          const tombstone = this._deletedMap.get(elementId)
          if (!tombstone) {
            throw new Error(
              `[SceneTree] Cannot apply subtree restore: stale tombstone "${elementId}"`
            )
          }
          prepared.set(elementId, tombstone)
          return
        }
        if (strategy !== 'materialize') {
          throw new Error(
            `[SceneTree] Cannot apply subtree restore: invalid strategy for "${elementId}"`
          )
        }
        const constructorData = cloneSceneTreeValue(entry.data)
        if (isGroupEntity(constructorData.type)) {
          ;(constructorData as GroupRawData).children = []
        }
        const element = createElement(constructorData, this.propsManagerOwner)
        if (!element || element.get('id') !== elementId) {
          if (element) {
            try {
              disposeElementComputed(element)
            } catch {
              // Preserve the exact materialization failure.
            }
          }
          throw new Error(
            `[SceneTree] Cannot apply subtree restore: exact materialization failed for "${elementId}"`
          )
        }
        const expectedPreparedData = cloneSceneTreeValue(entry.data)
        if (isGroupEntity(expectedPreparedData.type)) {
          ;(expectedPreparedData as GroupRawData).children = []
        }
        if (!isEqual(element.save(), expectedPreparedData)) {
          try {
            disposeElementComputed(element)
          } catch {
            // Preserve the exact raw-data failure.
          }
          throw new Error(
            `[SceneTree] Cannot apply subtree restore: exact data changed for "${elementId}"`
          )
        }
        prepared.set(elementId, element)
      })
    } catch (error) {
      prepared.forEach((element, elementId) => {
        if (!this._deletedMap.has(elementId)) {
          try {
            disposeElementComputed(element)
          } catch {
            // Preserve the first restore preparation failure while cleaning all attempts.
          }
        }
      })
      throw error
    }

    const restoreOrder = [...snapshot.removed].reverse()
    const restoredElements = restoreOrder.map(({ elementId }) => {
      const element = prepared.get(elementId)
      if (!element) {
        throw new Error(
          `[SceneTree] Cannot apply subtree restore: missing prepared hierarchy for "${elementId}"`
        )
      }
      return element
    })
    const relationIndexUpdates =
      this.prepareElementPropertyRelationInsertions(restoredElements)
    const rootEntry = snapshot.removed[snapshot.removed.length - 1]
    const rootParent = this.getElementById(
      rootEntry.parentId
    ) as GroupInstanceTypes
    const rootParentChildrenBefore = this.getContainerChildren(
      rootParent,
      `Restore root parent "${rootEntry.parentId}"`
    )
    const restoredRootParentChildren = [...rootParentChildrenBefore]
    restoredRootParentChildren.splice(rootEntry.index, 0, rootEntry.elementId)
    const operationChangeStart = this.changes.length
    let canonicalMapApplied = false
    try {
      restoredElements.forEach((element) => {
        reactivateElementComputed(element)
      })
      snapshot.removed.forEach(({ elementId, parentId }) => {
        const element = prepared.get(elementId) as ElementInstanceTypes
        ;(element as Element).assignCanonicalParentId(parentId)
        this._deletedMap.delete(elementId)
      })
      this.addElementsToCanonicalMap(restoredElements, relationIndexUpdates)
      canonicalMapApplied = true
      ;(this.currentWorkspace as Workspace).replaceBatchParentChildren(
        rootParent,
        restoredRootParentChildren
      )
      snapshot.removed.forEach(({ elementId, data }) => {
        if (!isGroupEntity(data.type)) return
        const group = prepared.get(elementId) as GroupInstanceTypes
        ;(this.currentWorkspace as Workspace).replaceBatchParentChildren(
          group,
          (data as GroupRawData).children
        )
      })
      this.validateCanonicalHierarchy()
      snapshot.removed.forEach(({ elementId, data }) => {
        if (!isEqual(this.getElementById(elementId)?.save(), data)) {
          throw new Error(
            `[SceneTree] Cannot apply subtree restore: final raw data changed for "${elementId}"`
          )
        }
      })
    } catch (error) {
      this.changes.splice(operationChangeStart)
      try {
        ;(this.currentWorkspace as Workspace).replaceBatchParentChildren(
          rootParent,
          rootParentChildrenBefore
        )
      } catch {
        // Preserve the primary apply failure and continue every rollback stage.
      }
      snapshot.removed.forEach(({ elementId, data }) => {
        if (!isGroupEntity(data.type)) return
        const group = prepared.get(elementId) as GroupInstanceTypes
        try {
          ;(this.currentWorkspace as Workspace).replaceBatchParentChildren(
            group,
            []
          )
        } catch {
          // Preserve the primary apply failure and continue every rollback stage.
        }
      })
      if (canonicalMapApplied) {
        try {
          this.rollbackElementsAddedToCanonicalMap(
            restoredElements,
            relationIndexUpdates
          )
        } catch {
          // Preserve the primary apply failure and continue every rollback stage.
        }
      }
      restoredElements.forEach((element) => {
        const elementId = element.get('id')
        const strategy = strategyByElementId.get(elementId)
        try {
          ;(element as Element).assignCanonicalParentId('')
        } catch {
          // Preserve the primary apply failure and continue every rollback stage.
        }
        if (strategy === 'reuse') {
          try {
            this._deletedMap.set(elementId, element)
          } catch {
            // Preserve the primary apply failure and continue every rollback stage.
          }
        } else {
          try {
            this._deletedMap.delete(elementId)
          } catch {
            // Preserve the primary apply failure and continue every rollback stage.
          }
        }
        try {
          disposeElementComputed(element)
        } catch {
          // Preserve the primary apply failure and continue every rollback stage.
        }
      })
      throw error
    }

    this.changes.splice(operationChangeStart)
    this.addChange({
      eventName: EventTypes.CHANGE_SUBTREE,
      elementId: snapshot.elementId,
      removed: cloneSceneTreeValue([...snapshot.removed]),
      rootParentChildrenAfter: cloneSceneTreeValue([
        ...snapshot.rootParentChildrenAfter
      ]),
      action: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
      undoAction: SCENE_TREE_ACTIONS.REMOVE_SUBTREE
    })
    acknowledgeTransactionReplayApplied()
    this.commitSceneTreeTransaction(options)
    return cloneSceneTreeValue(snapshot)
  }

  restoreSubtree(
    entries: readonly SubtreeRemovalEntry[],
    options?: EVENT_OPTIONS
  ): RemoveSubtreeResult {
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error(
        '[SceneTree] Invalid subtree restore: exact removal evidence is required'
      )
    }

    const removed = cloneSceneTreeValue(entries)
    const rootEntry = removed[removed.length - 1]
    const rootParentChildrenAfter = this.getContainerChildren(
      this.getElementById(rootEntry.parentId) as GroupInstanceTypes,
      `Restore root parent "${rootEntry.parentId}"`
    )
    const snapshot: SceneTreeRestoreSnapshot = {
      elementId: rootEntry.elementId,
      removed,
      rootParentChildrenAfter: cloneSceneTreeValue(rootParentChildrenAfter)
    }
    return this.applyRestoreSubtree(
      this.preflightRestoreSubtree(snapshot),
      options
    )
  }

  applySubtreeChange(change: SubtreeChange, options?: EVENT_OPTIONS): boolean {
    if (change.action === SCENE_TREE_ACTIONS.RESTORE_SUBTREE) {
      this.restoreSubtree(change.removed, options)
      return true
    }
    if (change.action !== SCENE_TREE_ACTIONS.REMOVE_SUBTREE) {
      throw new Error(
        `[SceneTree] Invalid subtree replay action "${change.action}"`
      )
    }

    const preparedMutation = this.prepareCanonicalSubtreeRemoval(change)
    this.applyPreparedElementMutation(preparedMutation, options)
    return true
  }

  addToMap(element: ElementInstanceTypes) {
    const elId = element.get('id')
    if (!element || !elId) {
      return
    }

    this.addElementsToCanonicalMap([element])
    this.removeFromDeleteMap(elId)
  }

  addManyToMap(
    elements: readonly ElementInstanceTypes[],
    parentId: string
  ): void {
    const parent = this._elements.get(parentId)
    if (!parent || !isGroupEntity(parent.get('type'))) {
      throw new Error(
        '[SceneTree] Canonical element registration requires an active container parent'
      )
    }

    const elementIds = elements.map((element) => element.get('id'))
    if (
      elementIds.some(
        (elementId) =>
          typeof elementId !== 'string' ||
          elementId.length === 0 ||
          this._elements.has(elementId) ||
          this._deletedMap.has(elementId)
      ) ||
      new Set(elementIds).size !== elementIds.length
    ) {
      throw new Error(
        '[SceneTree] Canonical element registration requires unique inactive ids'
      )
    }

    const relationIndexUpdates =
      this.prepareElementPropertyRelationInsertions(elements)
    elements.forEach((element) => {
      ;(element as Element).assignCanonicalParentId(parentId)
    })
    elements.forEach((element, index) => {
      const elementId = elementIds[index]
      this._deletedMap.delete(elementId)
    })
    this.addElementsToCanonicalMap(elements, relationIndexUpdates)
  }

  removeFromMap(element: ElementInstanceTypes) {
    const elId = element.get('id')
    if (!element || !elId) {
      return
    }

    this.removeElementsFromCanonicalMap([element])
    this.addToDeleteMap(element)
  }

  getRestoreElementById(
    elementId: string,
    recordChange = true
  ): ElementInstanceTypes {
    const restoredElement = this._deletedMap.get(
      elementId
    ) as ElementInstanceTypes
    if (recordChange) {
      this.addChangeForAddElement(restoredElement)
    }
    return restoredElement
  }

  addToDeleteMap(element: ElementInstanceTypes) {
    this._deletedMap.set(element.get('id'), element)
  }

  removeFromDeleteMap(elementId: string) {
    this._deletedMap.delete(elementId)
  }

  addChangeForAddElement(
    element: ElementInstanceTypes,
    parentId = element.get('parentId') as string,
    index?: number
  ) {
    this.addChange({
      eventName: EventTypes.ADD_ELEMENT,
      data: element.save(),
      ...(parentId ? { parentId } : {}),
      ...(index !== undefined ? { index } : {}),
      action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
      undoType: EventTypes.REMOVE_ELEMENT,
      undoAction: EventTypes.REMOVE_ELEMENT
    })
  }

  get currentWorkspace() {
    return this.getElementById(this.workspace)
  }

  createElement(
    elementData: Partial<ElementRawData>,
    recordChange = true
  ): ElementInstanceTypes | null {
    if (elementData.type === EntityTypes.WORKSPACE) {
      return null
    }

    const newElement = createElement(
      elementData,
      this.propsManagerOwner
    ) as ElementInstanceTypes
    if (recordChange) {
      this.addChangeForAddElement(newElement)
    }
    return newElement
  }

  addNewElement(
    elementData: CreateElementData,
    parent?: GroupInstanceTypes,
    index = -1,
    options?: EVENT_OPTIONS
  ): string {
    return (
      this.addNewElementBatch([elementData], parent, index, options)[0] ?? ''
    )
  }

  addNewElements(
    elementData: readonly CreateElementData[],
    parent?: GroupInstanceTypes,
    index = -1,
    options?: EVENT_OPTIONS
  ): readonly string[] {
    return this.addNewElementBatch(elementData, parent, index, options)
  }

  private resolveElementBatchTarget(
    parent?: GroupInstanceTypes
  ): GroupInstanceTypes | undefined {
    const workspace = this.currentWorkspace as Workspace
    if (!workspace) {
      return undefined
    }
    return (parent ?? workspace.firstFrame ?? workspace) as GroupInstanceTypes
  }

  private preflightElementBatch(
    elementData: readonly CreateElementData[],
    parent: GroupInstanceTypes | undefined,
    index: number
  ): ElementBatchPreflight {
    const target = this.resolveElementBatchTarget(parent)
    if (
      !target ||
      this.getElementById(target.get('id')) !== target ||
      !isGroupEntity(target.get('type'))
    ) {
      throw new Error(
        '[SceneTree] Element batch requires an active container parent'
      )
    }

    const targetChildren = target.get('children')
    if (!Array.isArray(targetChildren)) {
      throw new Error(
        '[SceneTree] Element batch requires an ordered parent child list'
      )
    }
    const insertionIndex = index > -1 ? index : targetChildren.length
    if (
      !Number.isInteger(index) ||
      index < -1 ||
      insertionIndex < 0 ||
      insertionIndex > targetChildren.length
    ) {
      throw new Error('[SceneTree] Element batch index is outside parent order')
    }

    const sourceIds: string[] = []
    const ordinaryPropertyOwners: {
      definitions: readonly PropertyDefinition[]
      data: Readonly<Record<string, unknown>>
      propertyIds?: Readonly<Record<string, string>>
    }[] = []
    elementData.forEach((source) => {
      if (!isRecord(source)) {
        throw new Error('[SceneTree] Element batch has invalid data')
      }
      const sourceId = source.id
      if (typeof sourceId !== 'string' || sourceId.length === 0) {
        throw new Error(
          '[SceneTree] Element batch requires unique inactive ids'
        )
      }
      sourceIds.push(sourceId)

      const sourceType = source.type
      const registration =
        typeof sourceType === 'string'
          ? componentRegistry.get(sourceType)
          : undefined
      if (!registration) {
        throw new Error(
          `No component registered for type: ${String(sourceType ?? '')}`
        )
      }
      const propertyIds = source.props
      if (propertyIds !== undefined && !isRecord(propertyIds)) {
        throw new Error(
          `[SceneTree] Element "${sourceId}" has invalid property owners`
        )
      }
      const constructorPropertyDefinitions = (
        registration.constructor as typeof registration.constructor & {
          ordinaryPropertyDefinitions?: readonly PropertyDefinition[]
        }
      ).ordinaryPropertyDefinitions
      const definitions =
        registration.properties.length > 0
          ? registration.properties
          : (constructorPropertyDefinitions ?? [])
      ordinaryPropertyOwners.push({
        definitions,
        data: source,
        ...(propertyIds
          ? {
              propertyIds: propertyIds as Readonly<Record<string, string>>
            }
          : {})
      })
    })

    if (
      new Set(sourceIds).size !== sourceIds.length ||
      sourceIds.some(
        (sourceId) =>
          this._elements.has(sourceId) || this._deletedMap.has(sourceId)
      )
    ) {
      throw new Error('[SceneTree] Element batch requires unique inactive ids')
    }

    return Object.freeze({
      target,
      sourceIds: Object.freeze(sourceIds),
      insertionIndex,
      tombstones: new Map(
        sourceIds.map((sourceId) => [sourceId, this._deletedMap.get(sourceId)])
      ),
      preparedOrdinaryProperties:
        this.propsManagerOwner.preflightOrdinaryPropertyCreationBatch(
          ordinaryPropertyOwners
        )
    })
  }

  private addNewElementBatch(
    elementData: readonly CreateElementData[],
    parent?: GroupInstanceTypes,
    index = -1,
    options?: EVENT_OPTIONS
  ): readonly string[] {
    const workspace = this.currentWorkspace as Workspace
    if (!workspace || elementData.length === 0) {
      return []
    }
    const preflight = this.preflightElementBatch(elementData, parent, index)
    const {
      target,
      sourceIds,
      insertionIndex,
      tombstones,
      preparedOrdinaryProperties
    } = preflight
    const originalChildren = [...target.get('children')]
    const elements: ElementInstanceTypes[] = []
    const operationChangeStart = this.changes.length
    const canonicalHandoffState = createCanonicalBatchHandoffState()
    let rollbackPreparedProperties: (() => void) | undefined
    let completePreparedProperties: (() => void) | undefined
    let parentMembershipMayHaveChanged = false
    const materializeElementBatch = () => {
      measureCanonicalSceneBatchPhase(
        'scene-tree:element-batch:materialize',
        () => {
          elementData.forEach((source) => {
            const constructorData = { ...source }
            const element = this.createElement(constructorData, false)
            if (!element) {
              throw new Error(
                '[SceneTree] Canonical batch element creation failed'
              )
            }
            elements.push(element)
          })
        }
      )
    }

    const projectElementBatch = () => {
      measureCanonicalSceneBatchPhase(
        'scene-tree:element-batch:parent-membership',
        () => {
          parentMembershipMayHaveChanged = true
          workspace.addNewElements(elements, target, insertionIndex)
        }
      )
      measureCanonicalSceneBatchPhase(
        'scene-tree:element-batch:record-evidence',
        () => {
          this.changes.splice(operationChangeStart)
          elements.forEach((element, offset) => {
            this.addChangeForAddElement(
              element,
              target.get('id'),
              insertionIndex + offset
            )
          })
        }
      )
    }
    try {
      let propsEvents: readonly PreparedPropsTransactionEvent[] = []
      runWithDeferredReplayAcknowledgement(() => {
        const propertyBatch = this.propsManagerOwner.runInPropertyCreationBatch(
          materializeElementBatch,
          preparedOrdinaryProperties
        )
        rollbackPreparedProperties = propertyBatch.rollback
        completePreparedProperties = propertyBatch.complete

        projectElementBatch()
        measureCanonicalSceneBatchPhase(
          'scene-tree:element-batch:commit-props',
          () => {
            propsEvents =
              this.propsManagerOwner.prepareTransactionEvents(options)
          }
        )
      })
      measureCanonicalSceneBatchPhase(
        'scene-tree:element-batch:commit-scene',
        () => {
          this.commitSceneTreeTransaction(options, {
            elements,
            propsEvents,
            [canonicalBatchHandoffState]: canonicalHandoffState
          })
        }
      )
      completePreparedProperties?.()
      return Object.freeze(elements.map((element) => element.get('id')))
    } catch (error) {
      if (wasCanonicalBatchHandoffAccepted(canonicalHandoffState)) {
        completePreparedProperties?.()
        this.propsManagerOwner.cleanChanges()
        this.cleanChanges()
        throw error
      }
      rollbackPreparedProperties?.()
      if (parentMembershipMayHaveChanged) {
        workspace.replaceBatchParentChildren(target, originalChildren)
      }
      const activeElements = elements.filter(
        (element) => this._elements.get(element.get('id')) === element
      )
      if (activeElements.length > 0) {
        this.removeElementsFromCanonicalMap(activeElements)
      }
      elements.forEach((element) => {
        disposeElementComputed(element)
      })
      sourceIds.forEach((sourceId) => {
        const tombstone = tombstones.get(sourceId)
        if (tombstone) {
          this._deletedMap.set(sourceId, tombstone)
        } else {
          this._deletedMap.delete(sourceId)
        }
      })
      this.changes.splice(operationChangeStart)
      throw error
    }
  }

  removeElement(
    data: Partial<ElementRawData>,
    parent?: GroupInstanceTypes,
    options?: EVENT_OPTIONS
  ): boolean {
    const workspace = this.currentWorkspace as Workspace
    if (!workspace) {
      return false
    }

    const elementId = data.id as string
    const element = this.getElementById(elementId)
    if (!element) {
      return false
    }

    const resolvedParentId =
      parent?.get('id') ??
      (data.parentId as string | undefined) ??
      (element.get('parentId') as string)
    const resolvedParent = resolvedParentId
      ? (this.getElementById(resolvedParentId) as GroupInstanceTypes)
      : undefined
    const container = resolvedParent ?? workspace
    if (!isGroupEntity(container.get('type'))) {
      return false
    }

    const children = this.getContainerChildren(
      container,
      `Remove parent "${resolvedParentId}"`
    )
    if (
      resolvedParentId !== element.get('parentId') ||
      !children.includes(elementId)
    ) {
      return false
    }

    const index = children.indexOf(elementId)
    const preparedMutation = this.prepareCanonicalElementRemoval([
      {
        data: element.save(),
        parentId: resolvedParentId,
        index
      }
    ])
    return (
      this.applyPreparedElementMutation(preparedMutation, options)
        .orderedElementIds.length === 1
    )
  }

  updateLocalComputedData(updates: readonly LocalComputedDataUpdate[]): void {
    const seenElementIds = new Set<string>()
    const prepared = updates.map((update) => {
      if (
        !isRecord(update) ||
        typeof update.elementId !== 'string' ||
        update.elementId.length === 0 ||
        seenElementIds.has(update.elementId) ||
        !isRecord(update.values)
      ) {
        throw new Error(
          '[SceneTree] Local computed values require unique active element batches'
        )
      }
      seenElementIds.add(update.elementId)
      const element = this.getElementById(update.elementId)
      if (!element || element.get('type') === EntityTypes.WORKSPACE) {
        throw new Error(
          `[SceneTree] Local computed values require active element "${update.elementId}"`
        )
      }
      const computedSnapshot = getComputedSnapshot(element)
      const invalidKey = Object.keys(update.values).find((key) =>
        LOCAL_COMPUTED_RESERVED_KEYS.has(key)
      )
      if (invalidKey) {
        throw new Error(
          `[SceneTree] Local computed values cannot update canonical key "${invalidKey}"`
        )
      }
      const changes: UpdateElementBatchChange['changes'][number][] = []
      Object.entries(update.values).forEach(([key, sourceAfter]) => {
        if (sourceAfter === undefined) {
          return
        }
        const before = computedSnapshot[key]
        const after = cloneSceneTreeValue(sourceAfter)
        if (!isEqual(before, after)) {
          changes.push({
            owner: 'computed',
            key,
            before,
            after
          })
        }
      })
      return {
        element,
        elementId: update.elementId,
        changes
      }
    })

    prepared.forEach(({ element, changes }) => {
      changes.forEach(({ key, after }) => {
        element.updateComputedData(
          key as keyof ComputedAttrs,
          after as ComputedAttrs[keyof ComputedAttrs]
        )
      })
    })

    const events = cloneAndFreezeSceneValue(
      prepared.flatMap(
        ({ elementId, changes }): UpdateComputedDataBatchEvent[] =>
          changes.length === 0
            ? []
            : [
                {
                  type: EventTypes.UPDATE_COMPUTED_DATA,
                  payload: {
                    action:
                      SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
                    eventName: EventTypes.UPDATE_COMPUTED_DATA,
                    id: elementId,
                    changes
                  }
                }
              ]
      )
    )
    if (events.length > 0) {
      publishLocalComputedDataEvents(events)
    }
  }

  patchLocalComputedData(
    updates: readonly LocalComputedDataPatchUpdate[]
  ): void {
    const seenElementIds = new Set<string>()
    const prepared = updates.map((update) => {
      if (
        !isRecord(update) ||
        typeof update.elementId !== 'string' ||
        update.elementId.length === 0 ||
        seenElementIds.has(update.elementId) ||
        !isRecord(update.patch)
      ) {
        throw new Error(
          '[SceneTree] Local computed patches require unique active element batches'
        )
      }
      seenElementIds.add(update.elementId)
      const element = this.getElementById(update.elementId)
      if (!element || element.get('type') === EntityTypes.WORKSPACE) {
        throw new Error(
          `[SceneTree] Local computed patches require active element "${update.elementId}"`
        )
      }
      const patch = update.patch
      const invalidKey = [
        ...Object.keys(patch.values ?? {}),
        ...Object.keys(patch.records ?? {})
      ].find((key) => LOCAL_COMPUTED_RESERVED_KEYS.has(key))
      if (invalidKey) {
        throw new Error(
          `[SceneTree] Local computed patches cannot update canonical key "${invalidKey}"`
        )
      }
      const computedSnapshot = getComputedSnapshot(element)
      validateComputedDataPatch(patch, computedSnapshot)
      const patchChange: ComputedDataPatchChange = {}
      const assignments: {
        key: string
        after: DataTypes
      }[] = []

      Object.entries(patch.values ?? {}).forEach(([key, sourceAfter]) => {
        const before = computedSnapshot[key]
        const after = cloneSceneTreeValue(sourceAfter)
        if (isEqual(before, after)) {
          return
        }
        assignments.push({ key, after })
        patchChange.values ??= {}
        setOwnEnumerableValue(patchChange.values, key, { before, after })
      })

      Object.entries(patch.records ?? {}).forEach(([key, recordPatch]) => {
        const currentRecord = cloneRecord(
          computedSnapshot[key] as Record<string, unknown>
        )
        let nextRecord = { ...currentRecord }
        const nextRecordPatch: NonNullable<
          ComputedDataPatchChange['records']
        >[string] = {}

        Object.entries(recordPatch.set ?? {}).forEach(
          ([recordId, sourceAfter]) => {
            const recordExists = hasOwnRecordValue(currentRecord, recordId)
            const before = currentRecord[recordId]
            const after = cloneSceneTreeValue(sourceAfter)
            if (recordExists && isEqual(before, after)) {
              return
            }
            setOwnEnumerableValue(nextRecord, recordId, after)
            nextRecordPatch.set ??= {}
            setOwnEnumerableValue(
              nextRecordPatch.set,
              recordId,
              recordExists ? { before, after } : { after }
            )
          }
        )
        ;(recordPatch.remove ?? []).forEach((recordId: string) => {
          if (!hasOwnRecordValue(currentRecord, recordId)) {
            return
          }
          nextRecordPatch.remove ??= {}
          setOwnEnumerableValue(nextRecordPatch.remove, recordId, {
            before: currentRecord[recordId]
          })
          const { [recordId]: _removed, ...withoutRecord } = nextRecord
          nextRecord = withoutRecord
        })

        if (
          Object.keys(nextRecordPatch.set ?? {}).length === 0 &&
          Object.keys(nextRecordPatch.remove ?? {}).length === 0
        ) {
          return
        }
        assignments.push({
          key,
          after: nextRecord as unknown as DataTypes
        })
        patchChange.records ??= {}
        setOwnEnumerableValue(patchChange.records, key, nextRecordPatch)
      })

      return {
        element,
        elementId: update.elementId,
        assignments,
        patch: patchChange
      }
    })

    prepared.forEach(({ element, assignments }) => {
      assignments.forEach(({ key, after }) => {
        element.updateComputedData(
          key as keyof ComputedAttrs,
          after as ComputedAttrs[keyof ComputedAttrs]
        )
      })
    })

    const events = cloneAndFreezeSceneValue(
      prepared.flatMap(
        ({ elementId, patch }): UpdateComputedDataPatchEvent[] =>
          hasPatchChanges(patch)
            ? [
                {
                  type: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
                  payload: {
                    id: elementId,
                    patch
                  }
                }
              ]
            : []
      )
    )
    if (events.length > 0) {
      publishLocalComputedDataEvents(events)
    }
  }

  projectLocalComputedDataFromPropertyIds(
    sourcePropertyIds: readonly string[]
  ): void {
    const valuesByElementId = new Map<string, Record<string, DataTypes>>()
    this.propsManagerOwner
      .resolvePropertyAncestorIds(sourcePropertyIds)
      .forEach((sourcePropertyId) => {
        this.getElementPropertyRelations(sourcePropertyId).forEach(
          (relation) => {
            const property = this.propsManagerOwner.getPropertyById(
              relation.componentId
            )
            if (!property) {
              return
            }
            const values =
              valuesByElementId.get(relation.ownerElementId) ??
              ({} as Record<string, DataTypes>)
            Object.entries(property.getValue()).forEach(([key, value]) => {
              if (value !== undefined) {
                setOwnEnumerableValue(values, key, cloneSceneTreeValue(value))
              }
            })
            valuesByElementId.set(relation.ownerElementId, values)
          }
        )
      })
    if (valuesByElementId.size > 0) {
      this.updateLocalComputedData(
        [...valuesByElementId].map(([elementId, values]) => ({
          elementId,
          values
        }))
      )
    }
  }

  private prepareSceneTreeTransactionEvents(
    options?: EVENT_OPTIONS
  ): readonly UpdateTransactionEvent[] {
    return this.changes.map((change) => {
      const changeOptions = change.options ?? options
      const routedOptions: EVENT_OPTIONS = Object.freeze({
        ...(changeOptions ?? {}),
        shared: changeOptions?.shared ?? SharedDataChannelNames.SCENE_TREE
      })
      return Object.freeze({
        type: EventTypes.UPDATE_TRANSACTION,
        eventName: change.eventName,
        payload: deepFreezeSceneValue(change),
        options: routedOptions
      } satisfies UpdateTransactionEvent)
    })
  }

  private createCanonicalPropertyDeliveryOwners(
    elements: readonly ElementInstanceTypes[]
  ): readonly CanonicalPropertyDeliveryOwner[] {
    return elements.map((element) => {
      const elementType = element.get('type')
      if (!componentRegistry.get(elementType)) {
        throw new Error(
          `[SceneTree] Canonical delivery has unregistered type "${elementType}"`
        )
      }
      const props = element.props as typeof element.props & {
        getCanonicalRootPropertyIds?: () => readonly string[]
      }
      const rootPropertyIds = props.getCanonicalRootPropertyIds?.()
      if (!rootPropertyIds) {
        throw new Error(
          `[SceneTree] Canonical delivery is missing property owner evidence for "${element.get('id')}"`
        )
      }
      return Object.freeze({
        orderedId: element.get('id'),
        rootPropertyIds: Object.freeze([...rootPropertyIds])
      })
    })
  }

  private commitCanonicalElementBatch(
    options: EVENT_OPTIONS | undefined,
    canonical: CanonicalCombinedCommit
  ): void {
    const handoffState =
      canonical[canonicalBatchHandoffState] ??
      createCanonicalBatchHandoffState()
    const transactionOwner = getTransactionOwner()
    const preparedPropsEvents = canonical.propsEvents
    const propertyOwners = this.createCanonicalPropertyDeliveryOwners(
      canonical.elements
    )
    const propertyOrderedIds = Object.freeze(
      propertyOwners.map(({ orderedId }) => orderedId)
    )
    const propsEvents = preparedPropsEvents.map(
      ({ eventName, payload, options: eventOptions }) => {
        if (payload.action !== PROPS_ACTIONS.ADD_PROPERTY) {
          throw new Error(
            '[SceneTree] Canonical element batch requires additive Props evidence'
          )
        }
        const addPayload = payload as AddRemovePropertyChange
        Object.freeze(addPayload.data)
        const ownerPayload = Object.freeze({
          ...addPayload,
          data: addPayload.data
        })
        const ownerOptions = Object.freeze({ ...eventOptions })
        const sharedRecords =
          this.propsManagerOwner.createCanonicalPropertyDeliveryRecords(
            ownerPayload,
            propertyOwners
          )
        sharedRecords.forEach((record) => {
          Object.freeze(record.orderedIds)
          Object.freeze(record.payload.data)
          Object.freeze(record.payload)
          Object.freeze(record)
        })
        Object.freeze(sharedRecords)
        return Object.freeze({
          type: EventTypes.UPDATE_TRANSACTION,
          eventName,
          payload: ownerPayload,
          options: ownerOptions,
          canonicalEvidence: Object.freeze({
            orderedIds: propertyOrderedIds,
            sharedRecords
          })
        })
      }
    ) satisfies readonly UpdateTransactionEvent[]
    const preparedSceneEvents = this.prepareSceneTreeTransactionEvents(options)
    if (preparedSceneEvents.length !== canonical.elements.length) {
      throw new Error(
        '[SceneTree] Canonical element batch requires one ordered Scene evidence event per element'
      )
    }
    const sceneEvents = preparedSceneEvents.map((event) => {
      const change = event.payload as SceneTreeChange
      const elementId = 'data' in change ? change.data.id : undefined
      if (!elementId) {
        throw new Error(
          '[SceneTree] Canonical element batch requires exact Scene delivery evidence'
        )
      }
      return Object.freeze({
        ...event,
        canonicalEvidence: Object.freeze({
          orderedIds: Object.freeze([elementId])
        })
      })
    }) satisfies readonly UpdateTransactionEvent[]

    const events = issueDetachedTransactionOwnerBatch(
      Object.freeze([...propsEvents, ...sceneEvents])
    )

    if (transactionOwner) {
      try {
        transactionOwner.updateTransactionBatch(events)
        markCanonicalBatchHandoffAccepted(handoffState)
        acknowledgeTransactionReplayApplied()
      } catch (error) {
        if (reportsAcceptedCanonicalBatchHandoff(error)) {
          markCanonicalBatchHandoffAccepted(handoffState)
          acknowledgeTransactionReplayApplied()
        }
        throw error
      }
    } else {
      events.forEach((event) => {
        updateTransaction(event)
      })
      acknowledgeTransactionReplayApplied()
    }

    this.propsManagerOwner.cleanChanges()
    this.cleanChanges()
  }

  commitSceneTreeTransaction(
    options?: EVENT_OPTIONS,
    canonical?: CanonicalCombinedCommit
  ) {
    if (canonical) {
      this.commitCanonicalElementBatch(options, canonical)
      return
    }

    this.prepareSceneTreeTransactionEvents(options).forEach((event) => {
      updateTransaction(event)
    })
    this.cleanChanges()
  }

  dispose() {
    this._elements.clear()
    this.elementPropertyRelationsByComponentId.clear()
    this._deletedMap.clear()
    this.changes = []
    this.workspace = ''
    this.workspaceList = []
  }

  reset() {
    this.dispose()
  }
}

export { SceneTree }

const sceneTree = new SceneTree()
export default sceneTree
