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
  SceneTreeRestorePlan,
  SceneTreeRestoreSnapshot,
  SceneTreeRestoreStrategy,
  SceneTreeChange,
  SubtreeChange,
  SubtreeRemovalEntry,
  AddRemovePropertyChange,
  UpdateElementBatchChange,
  UpdateElementChange,
  UpdateElementPatchChange,
  PropertyComponentRawData,
  EVENT_OPTIONS,
  EvnetOptions,
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
  getTransactionOwner,
  type UpdateTransactionEvent,
  updateTransaction
} from '@asyra/reactive-events'
import propsManager, {
  type CanonicalPropertyDeliveryOwner,
  type OrdinaryPropertyCreationPlan,
  type PreparedPropsTransactionEvent,
  type PropertyDefinition,
  type PropsManager
} from '@asyra/props-manager'
import { isEqual } from 'lodash'
import componentRegistry from './component-registry'
import {
  createElement,
  createWorkspace,
  isGroupEntity,
  stripNonRawFields
} from './entity-data'
import type Element from './components/element'
import type Workspace from './components/workspace'

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

export type SceneTreeLoadDiagnostic = LoadDiagnostic

export interface SceneTreeLoadValidationResult {
  data: SceneTreeRawData
  diagnostics: SceneTreeLoadDiagnostic[]
  valid: boolean
}

interface CanonicalElementPropertyBatch {
  readonly elements: readonly ElementRawData[]
  readonly properties: readonly PropertyComponentRawData[]
  readonly rootPropertyIds: readonly string[]
  readonly propertyMode: 'create' | 'reuse-active'
}

interface CanonicalSharedRecordInput {
  readonly orderedIds: readonly string[]
  readonly payload: object
}

interface CanonicalEventDeliveryEvidence {
  readonly orderedIds: readonly string[]
  readonly sharedRecords?: readonly CanonicalSharedRecordInput[]
}

interface CanonicalBatchTransactionOwner {
  updateTransactionBatch(
    events: readonly UpdateTransactionEvent[],
    evidence: readonly (CanonicalEventDeliveryEvidence | undefined)[]
  ): unknown
}

interface ElementBatchPreflight {
  readonly target: GroupInstanceTypes
  readonly sourceIds: readonly string[]
  readonly insertionIndex: number
  readonly tombstones: ReadonlyMap<string, ElementInstanceTypes | undefined>
  readonly ordinaryPropertyPlan: OrdinaryPropertyCreationPlan | undefined
}

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
    }
  >()
  private validatedRestoreArtifacts = new WeakMap<
    SceneTreeRestorePlan,
    {
      snapshot: SceneTreeRestoreSnapshot
    }
  >()

  constructor(
    private readonly propsManagerOwner: PropsManager = propsManager
  ) {}

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

  private createLoadValidationResult(
    data: SceneTreeRawData,
    diagnostics: SceneTreeLoadDiagnostic[],
    valid = true
  ): SceneTreeLoadValidationResult {
    const validatedSnapshot = cloneLoadData(data)
    const result = {
      data: cloneLoadData(validatedSnapshot),
      diagnostics,
      valid
    }
    this.validatedLoadArtifacts.set(result, {
      data: validatedSnapshot,
      valid
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
    const validated = artifact.data
    const nextElements = new Map<string, ElementInstanceTypes>()
    for (const [elementId, elementData] of Object.entries(validated.elements)) {
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
    }

    this.dispose()
    nextElements.forEach((element) => this.addToMap(element))
    this.workspaceList = [...validated.workspaceList]
    this.workspace = validated.workspace
    if (nextElements.size === 0) this._init()
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
    this.assertMoveDoesNotCreateCycle(elementIds, moves[0].after.parentId)

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
    this.validateCanonicalHierarchy()
    const removed = this.collectSubtreeRemovalEntries(elementId)
    const rootEntry = removed[removed.length - 1]
    const rootParent = this.getElementById(
      rootEntry.parentId
    ) as GroupInstanceTypes
    const rootParentChildrenBefore = this.getContainerChildren(
      rootParent,
      `Subtree root parent "${rootEntry.parentId}"`
    )
    if (rootParentChildrenBefore[rootEntry.index] !== elementId) {
      throw new Error(
        `[SceneTree] Invalid subtree request: stale root membership for "${elementId}"`
      )
    }
    const rootParentChildrenAfter = rootParentChildrenBefore.filter(
      (_, index) => index !== rootEntry.index
    )

    const workspace = this.currentWorkspace as Workspace
    const operationChangeStart = this.changes.length
    removed.forEach(({ elementId: removedId, parentId }) => {
      const element = this.getElementById(removedId) as ElementInstanceTypes
      const parent = this.getElementById(parentId) as GroupInstanceTypes
      workspace.removeElement(
        element,
        parent.get('type') === EntityTypes.WORKSPACE ? undefined : parent,
        options
      )
    })
    this.changes.splice(operationChangeStart)
    this.addChange({
      eventName: EventTypes.CHANGE_SUBTREE,
      elementId,
      removed: cloneSceneTreeValue(removed),
      rootParentChildrenAfter: cloneSceneTreeValue(rootParentChildrenAfter),
      action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
      undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE
    })
    acknowledgeTransactionReplayApplied()
    this.commitSceneTreeTransaction(options)
    this.propsManagerOwner.commitChanges(options)

    return {
      elementId,
      removed,
      rootParentChildrenAfter: cloneSceneTreeValue(rootParentChildrenAfter)
    }
  }

  preflightRestoreSubtree(snapshot: unknown): SceneTreeRestorePlan {
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

    const planEntries = entries.map((entry) => {
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
    const propertyOwnerRelations = entries.flatMap((entry) =>
      Object.entries(entry.data.props ?? {}).map(
        ([ownerPropertyName, componentId]) =>
          Object.freeze({
            ownerElementId: entry.elementId,
            ownerElementType: entry.data.type,
            ownerPropertyName,
            componentId
          })
      )
    )
    const plan: SceneTreeRestorePlan = Object.freeze({
      kind: 'scene-tree-restore-plan',
      elementId: rootEntry.elementId,
      entries: Object.freeze(planEntries),
      propertyOwnerRelations: Object.freeze(propertyOwnerRelations)
    })
    this.validatedRestoreArtifacts.set(plan, {
      snapshot: validated
    })
    return plan
  }

  applyRestoreSubtree(
    plan: SceneTreeRestorePlan,
    options?: EVENT_OPTIONS
  ): RemoveSubtreeResult {
    const artifact = this.validatedRestoreArtifacts.get(plan)
    if (!artifact) {
      throw new Error(
        '[SceneTree] Expected an owner-issued one-shot subtree restore plan'
      )
    }
    this.validatedRestoreArtifacts.delete(plan)

    const verificationPlan = this.preflightRestoreSubtree(artifact.snapshot)
    const verificationArtifact =
      this.validatedRestoreArtifacts.get(verificationPlan)
    this.validatedRestoreArtifacts.delete(verificationPlan)
    if (
      !verificationArtifact ||
      !isEqual(verificationPlan.entries, plan.entries)
    ) {
      throw new Error(
        '[SceneTree] Cannot apply subtree restore: restore plan is stale'
      )
    }
    const snapshot = verificationArtifact.snapshot
    const entryById = new Map(
      snapshot.removed.map((entry) => [entry.elementId, entry] as const)
    )
    const prepared = new Map<string, ElementInstanceTypes>()
    try {
      plan.entries.forEach(({ elementId, strategy }) => {
        const entry = entryById.get(elementId)
        if (!entry) {
          throw new Error(
            `[SceneTree] Cannot apply subtree restore: missing prepared evidence for "${elementId}"`
          )
        }
        Object.values(entry.data.props ?? {}).forEach((componentId) => {
          if (!this.propsManagerOwner.getPropertyById(componentId)) {
            throw new Error(
              `[SceneTree] Cannot apply subtree restore: property "${componentId}" is not active`
            )
          }
        })
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
          throw new Error(
            `[SceneTree] Cannot apply subtree restore: exact materialization failed for "${elementId}"`
          )
        }
        const expectedPreparedData = cloneSceneTreeValue(entry.data)
        if (isGroupEntity(expectedPreparedData.type)) {
          ;(expectedPreparedData as GroupRawData).children = []
        }
        if (!isEqual(element.save(), expectedPreparedData)) {
          ;(element.computed as unknown as { dispose?: () => void }).dispose?.()
          throw new Error(
            `[SceneTree] Cannot apply subtree restore: exact data changed for "${elementId}"`
          )
        }
        prepared.set(elementId, element)
      })
    } catch (error) {
      prepared.forEach((element, elementId) => {
        if (!this._deletedMap.has(elementId)) {
          ;(element.computed as unknown as { dispose?: () => void }).dispose?.()
        }
      })
      throw error
    }

    const workspace = this.currentWorkspace as Workspace
    const restoreOrder = [...snapshot.removed].reverse()
    const addedIds: string[] = []
    const operationChangeStart = this.changes.length
    try {
      restoreOrder.forEach(({ elementId, parentId, index }) => {
        const element = prepared.get(elementId)
        const parent = this.getElementById(parentId)
        if (!element || !parent || !isGroupEntity(parent.get('type'))) {
          throw new Error(
            `[SceneTree] Cannot apply subtree restore: missing prepared hierarchy for "${elementId}"`
          )
        }
        workspace.addNewElement(element, parent as GroupInstanceTypes, index)
        addedIds.push(elementId)
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
      addedIds.reverse().forEach((elementId) => {
        const element = this._elements.get(elementId)
        if (!element) return
        const parent = this.getElementById(element.get('parentId'))
        if (parent && isGroupEntity(parent.get('type'))) {
          ;(parent as GroupInstanceTypes).removeElement(element)
        }
        this._elements.delete(elementId)
        const strategy = plan.entries.find(
          (entry) => entry.elementId === elementId
        )?.strategy
        if (strategy === 'reuse') {
          this._deletedMap.set(elementId, element)
        } else {
          ;(element.computed as unknown as { dispose?: () => void }).dispose?.()
        }
      })
      prepared.forEach((element, elementId) => {
        if (!addedIds.includes(elementId) && !this._deletedMap.has(elementId)) {
          ;(element.computed as unknown as { dispose?: () => void }).dispose?.()
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
    this.validateCanonicalHierarchy()
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error(
        '[SceneTree] Invalid subtree restore: exact removal evidence is required'
      )
    }

    const removed = cloneSceneTreeValue(entries)
    const elementIds = removed.map(({ elementId }) => elementId)
    if (new Set(elementIds).size !== elementIds.length) {
      throw new Error(
        '[SceneTree] Invalid subtree restore: duplicate element evidence'
      )
    }

    const pending = new Map(
      removed.map((entry) => [entry.elementId, entry] as const)
    )
    const availableIds = new Set(this._elements.keys())
    const virtualChildren = new Map<string, string[]>()
    this._elements.forEach((element, id) => {
      if (isGroupEntity(element.get('type'))) {
        virtualChildren.set(
          id,
          this.getContainerChildren(element, `Restore parent "${id}"`)
        )
      }
    })

    removed.forEach(({ elementId, data }) => {
      if (this.getElementById(elementId)) {
        throw new Error(
          `[SceneTree] Invalid subtree restore: active element "${elementId}" already exists`
        )
      }
      const restored = this._deletedMap.get(elementId)
      if (!restored || data.id !== elementId) {
        throw new Error(
          `[SceneTree] Invalid subtree restore: deleted instance "${elementId}" is unavailable`
        )
      }
      if (
        isGroupEntity(restored.get('type')) &&
        this.getContainerChildren(restored, `Deleted container "${elementId}"`)
          .length > 0
      ) {
        throw new Error(
          `[SceneTree] Invalid subtree restore: deleted container "${elementId}" is not empty`
        )
      }
    })

    const restoreOrder: SubtreeRemovalEntry[] = []
    while (pending.size > 0) {
      const eligible = [...pending.values()]
        .filter(({ parentId }) => availableIds.has(parentId))
        .sort(
          (left, right) =>
            left.parentId.localeCompare(right.parentId) ||
            left.index - right.index
        )
      if (eligible.length === 0) {
        throw new Error(
          '[SceneTree] Invalid subtree restore: parent dependency cannot be resolved'
        )
      }

      eligible.forEach((entry) => {
        const siblings = virtualChildren.get(entry.parentId)
        if (
          !siblings ||
          !Number.isInteger(entry.index) ||
          entry.index < 0 ||
          entry.index > siblings.length
        ) {
          throw new Error(
            `[SceneTree] Invalid subtree restore: index for "${entry.elementId}" is outside the exact parent range`
          )
        }
        siblings.splice(entry.index, 0, entry.elementId)
        availableIds.add(entry.elementId)
        const restored = this._deletedMap.get(
          entry.elementId
        ) as ElementInstanceTypes
        if (isGroupEntity(restored.get('type'))) {
          virtualChildren.set(entry.elementId, [])
        }
        pending.delete(entry.elementId)
        restoreOrder.push(entry)
      })
    }

    const workspace = this.currentWorkspace as Workspace
    const rootEntry = removed[removed.length - 1]
    const rootParentChildrenAfter = this.getContainerChildren(
      this.getElementById(rootEntry.parentId) as GroupInstanceTypes,
      `Restore root parent "${rootEntry.parentId}"`
    )
    const operationChangeStart = this.changes.length
    restoreOrder.forEach(({ elementId, parentId, index }) => {
      const restored = this.getRestoreElementById(elementId, false)
      const parent = this.getElementById(parentId) as GroupInstanceTypes
      workspace.addNewElement(restored, parent, index)
    })
    this.changes.splice(operationChangeStart)
    this.addChange({
      eventName: EventTypes.CHANGE_SUBTREE,
      elementId: rootEntry.elementId,
      removed,
      rootParentChildrenAfter: cloneSceneTreeValue(rootParentChildrenAfter),
      action: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
      undoAction: SCENE_TREE_ACTIONS.REMOVE_SUBTREE
    })
    acknowledgeTransactionReplayApplied()
    this.commitSceneTreeTransaction(options)

    return {
      elementId: rootEntry.elementId,
      removed,
      rootParentChildrenAfter: cloneSceneTreeValue(rootParentChildrenAfter)
    }
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

    this.validateCanonicalHierarchy()
    const currentEvidence = this.collectSubtreeRemovalEntries(change.elementId)
    if (!isEqual(currentEvidence, change.removed)) {
      throw new Error(
        `[SceneTree] Cannot replay subtree removal: stale evidence for "${change.elementId}"`
      )
    }
    this.removeSubtree(change.elementId, options)
    return true
  }

  addToMap(element: ElementInstanceTypes) {
    const elId = element.get('id')
    if (!element || !elId) {
      return
    }

    this.removeFromDeleteMap(elId)
    this._elements.set(elId, element)
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

    elements.forEach((element) => {
      ;(element as Element).assignCanonicalParentId(parentId)
    })
    elements.forEach((element, index) => {
      const elementId = elementIds[index]
      this._deletedMap.delete(elementId)
      this._elements.set(elementId, element)
    })
  }

  removeFromMap(element: ElementInstanceTypes) {
    const elId = element.get('id')
    if (!element || !elId) {
      return
    }

    this.addToDeleteMap(element)
    this._elements.delete(elId)
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

  addChangeForRemoveElement(
    element: ElementInstanceTypes,
    parentId = element.get('parentId') as string,
    index?: number
  ) {
    this.addChange({
      eventName: EventTypes.REMOVE_ELEMENT,
      data: element.save(),
      parentId,
      index,
      action: SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
      undoType: EventTypes.ADD_ELEMENT,
      undoAction: EventTypes.ADD_ELEMENT
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
    inUndoRedo = false,
    options?: EVENT_OPTIONS
  ): string {
    if (!inUndoRedo) {
      return (
        this.addNewElementBatch([elementData], parent, index, options)[0] ?? ''
      )
    }

    const workspace = this.currentWorkspace as Workspace
    if (!workspace) {
      return ''
    }

    const propOverrides = stripNonRawFields(elementData)
    const newElement = this.getRestoreElementById(
      elementData.id as string,
      false
    )

    if (newElement) {
      const operationChangeStart = this.changes.length
      Object.keys(propOverrides).forEach((propKey) => {
        newElement.updateComputedData(
          propKey as keyof ComputedAttrs,
          propOverrides[propKey]
        )
      })
      workspace.addNewElement(newElement, parent, index)

      this.addToMap(newElement)

      const actualParentId = newElement.get('parentId') as string
      const actualParent = this.getElementById(actualParentId)
      const actualChildren =
        actualParent && isGroupEntity(actualParent.get('type'))
          ? ((actualParent as GroupInstanceTypes).get('children') as string[])
          : []
      const actualIndex = actualChildren.indexOf(newElement.get('id'))
      this.changes.splice(operationChangeStart)
      this.addChangeForAddElement(
        newElement,
        actualParentId,
        actualIndex >= 0 ? actualIndex : undefined
      )

      acknowledgeTransactionReplayApplied()
      this.propsManagerOwner.commitChanges(options)
      this.commitSceneTreeTransaction(options)

      return newElement.get('id')
    }

    return ''
  }

  addNewElements(
    elementData: readonly CreateElementData[],
    parent?: GroupInstanceTypes,
    index = -1,
    options?: EVENT_OPTIONS
  ): readonly string[] {
    return this.addNewElementBatch(elementData, parent, index, options)
  }

  addNewElementsFromCanonicalData(
    elementData: readonly ElementRawData[],
    propertyData: readonly PropertyComponentRawData[],
    parent?: GroupInstanceTypes,
    index = -1,
    options?: EVENT_OPTIONS
  ): readonly string[] {
    if (elementData.length === 0) {
      if (propertyData.length > 0) {
        throw new Error(
          '[SceneTree] Canonical element batch cannot contain orphan properties'
        )
      }
      return []
    }
    const target = this.resolveElementBatchTarget(parent)
    if (!target) {
      return []
    }
    const canonicalBatch = this.preflightCanonicalElementPropertyBatch(
      elementData,
      propertyData,
      target,
      'create'
    )
    return this.addNewElementBatch(
      elementData,
      target,
      index,
      options,
      canonicalBatch
    )
  }

  addNewElementsFromCanonicalDataUsingActiveProperties(
    elementData: readonly ElementRawData[],
    propertyData: readonly PropertyComponentRawData[],
    parent?: GroupInstanceTypes,
    index = -1,
    options?: EVENT_OPTIONS
  ): readonly string[] {
    if (elementData.length === 0) {
      if (propertyData.length > 0) {
        throw new Error(
          '[SceneTree] Canonical element batch cannot contain orphan properties'
        )
      }
      return []
    }
    const target = this.resolveElementBatchTarget(parent)
    if (!target) {
      return []
    }
    const canonicalBatch = this.preflightCanonicalElementPropertyBatch(
      elementData,
      propertyData,
      target,
      'reuse-active'
    )
    return this.addNewElementBatch(
      elementData,
      target,
      index,
      options,
      canonicalBatch
    )
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

  private preflightCanonicalElementPropertyBatch(
    elementData: readonly ElementRawData[],
    propertyData: readonly PropertyComponentRawData[],
    target: GroupInstanceTypes,
    propertyMode: CanonicalElementPropertyBatch['propertyMode']
  ): CanonicalElementPropertyBatch {
    const targetId = target.get('id')
    if (
      this.getElementById(targetId) !== target ||
      !isGroupEntity(target.get('type'))
    ) {
      throw new Error(
        '[SceneTree] Canonical element batch requires an active container parent'
      )
    }
    const propertyById = new Map<string, PropertyComponentRawData>()
    propertyData.forEach((property) => {
      if (
        !isRecord(property) ||
        typeof property.id !== 'string' ||
        property.id.length === 0 ||
        propertyById.has(property.id)
      ) {
        throw new Error(
          '[SceneTree] Canonical element batch has duplicate or invalid property data'
        )
      }
      propertyById.set(property.id, property as PropertyComponentRawData)
    })

    const rootPropertyIds: string[] = []
    elementData.forEach((element) => {
      if (!isRecord(element) || typeof element.type !== 'string') {
        throw new Error(
          '[SceneTree] Canonical element batch has invalid element data'
        )
      }
      const registration = componentRegistry.get(element.type)
      if (!registration) {
        throw new Error(
          `[SceneTree] Canonical element batch has unregistered type "${element.type}"`
        )
      }
      if (element.parentId !== targetId || !isRecord(element.props)) {
        throw new Error(
          `[SceneTree] Canonical element "${element.id}" requires exact parent and property owners`
        )
      }

      const propertyDefinitions = registration.properties
      const propertyNames = Object.keys(element.props)
      if (
        propertyNames.length !== propertyDefinitions.length ||
        propertyDefinitions.some(
          ({ name }) =>
            !Object.prototype.hasOwnProperty.call(element.props, name)
        )
      ) {
        throw new Error(
          `[SceneTree] Canonical element "${element.id}" has an inexact property owner map`
        )
      }

      propertyDefinitions.forEach(({ name, type }) => {
        const propertyId = element.props?.[name]
        const property = propertyById.get(propertyId as string)
        if (
          typeof propertyId !== 'string' ||
          propertyId.length === 0 ||
          property?.type !== type
        ) {
          throw new Error(
            `[SceneTree] Canonical element "${element.id}" has an invalid "${name}" property owner`
          )
        }
        rootPropertyIds.push(propertyId)
      })
    })

    return Object.freeze({
      elements: Object.freeze(cloneSceneTreeValue(elementData)),
      // PropsManager is the canonical detached-snapshot owner for property
      // batches. This synchronous handoff only preserves source order until
      // that owner preflights the batch.
      properties: Object.freeze([...propertyData]),
      rootPropertyIds: Object.freeze(rootPropertyIds),
      propertyMode
    })
  }

  private preflightElementBatch(
    elementData: readonly (CreateElementData | ElementRawData)[],
    parent: GroupInstanceTypes | undefined,
    index: number,
    canonicalBatch?: CanonicalElementPropertyBatch
  ): ElementBatchPreflight {
    const target = this.resolveElementBatchTarget(parent)
    if (
      !target ||
      this.getElementById(target.get('id')) !== target ||
      !isGroupEntity(target.get('type'))
    ) {
      throw new Error(
        '[SceneTree] Canonical element batch requires an active container parent'
      )
    }

    const targetChildren = target.get('children')
    if (!Array.isArray(targetChildren)) {
      throw new Error(
        '[SceneTree] Canonical element batch requires an ordered parent child list'
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
        throw new Error('[SceneTree] Canonical element batch has invalid data')
      }
      const sourceId = source.id
      if (typeof sourceId !== 'string' || sourceId.length === 0) {
        throw new Error(
          '[SceneTree] Canonical element batch requires unique inactive ids'
        )
      }
      sourceIds.push(sourceId)

      const sourceType = source.type
      const registration =
        typeof sourceType === 'string'
          ? componentRegistry.get(sourceType)
          : undefined
      if (!registration) {
        if (canonicalBatch) {
          throw new Error(
            `[SceneTree] Canonical element batch has unregistered type "${String(sourceType ?? '')}"`
          )
        }
        throw new Error(
          `No component registered for type: ${String(sourceType ?? '')}`
        )
      }
      if (!canonicalBatch) {
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
      }
    })

    if (
      new Set(sourceIds).size !== sourceIds.length ||
      sourceIds.some(
        (sourceId) =>
          this._elements.has(sourceId) || this._deletedMap.has(sourceId)
      )
    ) {
      throw new Error(
        '[SceneTree] Canonical element batch requires unique inactive ids'
      )
    }

    return Object.freeze({
      target,
      sourceIds: Object.freeze(sourceIds),
      insertionIndex,
      tombstones: new Map(
        sourceIds.map((sourceId) => [sourceId, this._deletedMap.get(sourceId)])
      ),
      ordinaryPropertyPlan: canonicalBatch
        ? undefined
        : this.propsManagerOwner.preflightOrdinaryPropertyCreationBatch(
            ordinaryPropertyOwners
          )
    })
  }

  private addNewElementBatch(
    elementData: readonly (CreateElementData | ElementRawData)[],
    parent?: GroupInstanceTypes,
    index = -1,
    options?: EVENT_OPTIONS,
    canonicalBatch?: CanonicalElementPropertyBatch
  ): readonly string[] {
    const workspace = this.currentWorkspace as Workspace
    if (!workspace || elementData.length === 0) {
      return []
    }
    const transactionOwner = getTransactionOwner()
    if (
      transactionOwner &&
      typeof (
        transactionOwner as typeof transactionOwner &
          Partial<CanonicalBatchTransactionOwner>
      ).updateTransactionBatch !== 'function'
    ) {
      throw new Error(
        '[SceneTree] Canonical element batch requires a batch-capable transaction owner'
      )
    }
    const preflight = this.preflightElementBatch(
      elementData,
      parent,
      index,
      canonicalBatch
    )
    const {
      target,
      sourceIds,
      insertionIndex,
      tombstones,
      ordinaryPropertyPlan
    } = preflight
    const originalChildren = [...target.get('children')]
    const hasCanonicalPropertyData =
      canonicalBatch &&
      (canonicalBatch.properties.length > 0 ||
        canonicalBatch.rootPropertyIds.length > 0)
    const propertyPlan =
      hasCanonicalPropertyData && canonicalBatch.propertyMode === 'create'
        ? this.propsManagerOwner.preflightPropertyCreationBatch(
            canonicalBatch.properties,
            canonicalBatch.rootPropertyIds
          )
        : undefined
    const elements: ElementInstanceTypes[] = []
    const operationChangeStart = this.changes.length
    const canonicalHandoffState = createCanonicalBatchHandoffState()
    let rollbackPreparedProperties: (() => void) | undefined
    let completePreparedProperties: (() => void) | undefined
    let parentMembershipMayHaveChanged = false
    const materializeElementBatch = () => {
      if (propertyPlan) {
        this.propsManagerOwner.applyPropertyCreationBatch(propertyPlan)
      }
      measureCanonicalSceneBatchPhase(
        'scene-tree:element-batch:materialize',
        () => {
          elementData.forEach((source) => {
            const constructorData = { ...source }
            const propOverrides = stripNonRawFields(constructorData)
            const element = this.createElement(constructorData, false)
            if (!element) {
              throw new Error(
                '[SceneTree] Canonical batch element creation failed'
              )
            }
            Object.keys(propOverrides).forEach((propKey) => {
              element.updateComputedData(
                propKey as keyof ComputedAttrs,
                propOverrides[propKey]
              )
            })
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
      if (
        canonicalBatch &&
        elements.some(
          (element, elementIndex) =>
            !isEqual(element.save(), canonicalBatch.elements[elementIndex])
        )
      ) {
        throw new Error(
          '[SceneTree] Canonical element batch changed exact element data'
        )
      }
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
      if (canonicalBatch?.propertyMode === 'reuse-active') {
        if (hasCanonicalPropertyData) {
          this.propsManagerOwner.runWithActivePropertyBatch(
            canonicalBatch.properties,
            canonicalBatch.rootPropertyIds,
            materializeElementBatch
          )
        } else {
          materializeElementBatch()
        }
      } else {
        const propertyBatch = this.propsManagerOwner.runInPropertyCreationBatch(
          materializeElementBatch,
          ordinaryPropertyPlan
        )
        rollbackPreparedProperties = propertyBatch.rollback
        completePreparedProperties = propertyBatch.complete
      }

      projectElementBatch()
      acknowledgeTransactionReplayApplied()
      let propsEvents: readonly PreparedPropsTransactionEvent[] = []
      measureCanonicalSceneBatchPhase(
        'scene-tree:element-batch:commit-props',
        () => {
          propsEvents = this.propsManagerOwner.prepareTransactionEvents(options)
        }
      )
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
      elements.forEach((element) => {
        this._elements.delete(element.get('id'))
        ;(
          element.computed as unknown as {
            dispose?: () => void
          }
        ).dispose?.()
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

    const operationChangeStart = this.changes.length
    this.addChangeForRemoveElement(
      element,
      resolvedParentId,
      children.indexOf(elementId)
    )
    const removeChange = this.changes[operationChangeStart]
    workspace.removeElement(
      element,
      container.get('type') === EntityTypes.WORKSPACE
        ? undefined
        : resolvedParent,
      options
    )
    this.changes.splice(operationChangeStart)
    if (removeChange) {
      this.changes.push(removeChange)
    }
    acknowledgeTransactionReplayApplied()
    this.commitSceneTreeTransaction(options)
    this.propsManagerOwner.commitChanges(options)
    return true
  }

  updateComputedData<K extends keyof ComputedAttrs>(
    elementId: string,
    key: K,
    data: ComputedAttrs[K],
    options?: EvnetOptions
  ) {
    const element = this.getElementById(elementId)
    if (!element) {
      return
    }

    if (options) {
      element.updateComputedData(key, data, options)
      return
    }

    element.updateComputedData(key, data)
  }

  patchComputedData(
    elementId: string,
    patch: ComputedDataPatch,
    options?: EvnetOptions
  ) {
    const element = this.getElementById(elementId)
    if (!element) {
      return
    }

    const computedSnapshot = getComputedSnapshot(element)
    validateComputedDataPatch(patch, computedSnapshot)
    this.applyComputedDataPatch(
      elementId,
      element,
      patch,
      computedSnapshot,
      options
    )
  }

  private applyComputedDataPatch(
    elementId: string,
    element: ElementInstanceTypes,
    patch: ComputedDataPatch,
    computedSnapshot: Record<string, DataTypes>,
    options?: EvnetOptions
  ): void {
    const patchChange: ComputedDataPatchChange = {}
    const previousChangeCount = this.changes.length

    Object.entries(patch.values ?? {}).forEach(([key, after]) => {
      const computedKey = key as keyof ComputedAttrs
      const before = computedSnapshot[key]
      if (isEqual(before, after)) {
        return
      }

      element.updateComputedData(
        computedKey,
        after as ComputedAttrs[keyof ComputedAttrs],
        options
      )
      patchChange.values ??= {}
      setOwnEnumerableValue(patchChange.values, key, { before, after })
    })

    Object.entries(patch.records ?? {}).forEach(([key, recordPatch]) => {
      const computedKey = key as keyof ComputedAttrs
      const currentRecord = cloneRecord(
        computedSnapshot[key] as Record<string, unknown>
      )
      let nextRecord = { ...currentRecord }
      const nextRecordPatch: NonNullable<
        ComputedDataPatchChange['records']
      >[string] = {}

      Object.entries(recordPatch.set ?? {}).forEach(([recordId, after]) => {
        const recordExists = hasOwnRecordValue(currentRecord, recordId)
        const before = currentRecord[recordId]
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
      })
      ;(recordPatch.remove ?? []).forEach((recordId) => {
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

      element.updateComputedData(
        computedKey,
        nextRecord as unknown as ComputedAttrs[keyof ComputedAttrs],
        options
      )
      patchChange.records ??= {}
      setOwnEnumerableValue(patchChange.records, key, nextRecordPatch)
    })

    if (!hasPatchChanges(patchChange)) {
      return
    }

    this.changes.splice(previousChangeCount)
    this.addChange({
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH,
      eventName: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
      id: elementId,
      patch: patchChange
    } as UpdateElementPatchChange)
  }

  patchComputedDataForElements(
    elementIds: string[],
    patch: ComputedDataPatch,
    options?: EvnetOptions
  ) {
    const targets = [...new Set(elementIds)].flatMap((elementId) => {
      const element = this.getElementById(elementId)
      return element
        ? [
            {
              elementId,
              element,
              computedSnapshot: getComputedSnapshot(element)
            }
          ]
        : []
    })

    targets.forEach(({ computedSnapshot }) => {
      validateComputedDataPatch(patch, computedSnapshot)
    })

    targets.forEach(({ elementId, element, computedSnapshot }) => {
      this.applyComputedDataPatch(
        elementId,
        element,
        patch,
        computedSnapshot,
        options
      )
    })
  }

  refreshComputedDataFromProperty(
    elementId: string,
    propertyName: string,
    options?: EvnetOptions
  ) {
    const element = this.getElementById(elementId)
    if (!element || element.get('type') === EntityTypes.WORKSPACE) {
      return
    }

    const propId = element.props.getPropId(propertyName)
    if (!propId) {
      return
    }

    const propComponent = this.propsManagerOwner.getPropertyById(propId)
    if (!propComponent) {
      return
    }

    const nextValues = propComponent.getValue() as Partial<ComputedAttrs>
    Object.entries(nextValues).forEach(([key, value]) => {
      const computedKey = key as keyof ComputedAttrs
      const currentValue = element.computed.get(computedKey)
      if (isEqual(currentValue, value)) {
        return
      }

      if (options) {
        element.computed.set(
          computedKey,
          value as ComputedAttrs[keyof ComputedAttrs],
          options
        )
        return
      }

      element.computed.set(
        computedKey,
        value as ComputedAttrs[keyof ComputedAttrs]
      )
    })
  }

  private prepareSceneTreeTransactionEvents(
    options?: EVENT_OPTIONS
  ): readonly UpdateTransactionEvent[] {
    const preparedEvents: UpdateTransactionEvent[] = []
    let pendingTransientComputedUpdate:
      | {
          batchKey: string
          id: string
          changes: UpdateElementBatchChange['changes']
          options: EVENT_OPTIONS
        }
      | undefined

    const flushPendingTransientComputedUpdate = () => {
      if (!pendingTransientComputedUpdate) {
        return
      }
      const batchChange: UpdateElementBatchChange = {
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
        eventName: EventTypes.UPDATE_COMPUTED_DATA,
        id: pendingTransientComputedUpdate.id,
        changes: pendingTransientComputedUpdate.changes
      }
      preparedEvents.push({
        type: EventTypes.UPDATE_TRANSACTION,
        eventName: batchChange.eventName,
        payload: batchChange,
        options: pendingTransientComputedUpdate.options
      })
      pendingTransientComputedUpdate = undefined
    }

    this.changes.forEach((change) => {
      const changeOptions = change.options ?? options
      const routedOptions: EVENT_OPTIONS = {
        ...(changeOptions ?? {}),
        shared: changeOptions?.shared ?? SharedDataChannelNames.SCENE_TREE
      }

      if (
        routedOptions.undoable === false &&
        change.action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA
      ) {
        const computedChange = change as UpdateElementChange
        const batchKey = JSON.stringify({
          id: computedChange.id,
          rollbackable: routedOptions.rollbackable !== false,
          shared: routedOptions.shared ?? null,
          sharedDelivery: routedOptions.sharedDelivery ?? 'transaction-end'
        })
        if (
          pendingTransientComputedUpdate &&
          pendingTransientComputedUpdate.batchKey !== batchKey
        ) {
          flushPendingTransientComputedUpdate()
        }
        pendingTransientComputedUpdate ??= {
          batchKey,
          id: computedChange.id,
          changes: [],
          options: routedOptions
        }
        pendingTransientComputedUpdate.changes.push({
          owner: computedChange.owner,
          key: computedChange.key,
          before: computedChange.before,
          after: computedChange.after
        })
        return
      }

      flushPendingTransientComputedUpdate()
      preparedEvents.push({
        type: EventTypes.UPDATE_TRANSACTION,
        eventName: change.eventName,
        payload: change,
        options: routedOptions
      })
    })

    flushPendingTransientComputedUpdate()
    return preparedEvents
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
    const batchOwner = transactionOwner as
      | (typeof transactionOwner & Partial<CanonicalBatchTransactionOwner>)
      | null
    const preparedPropsEvents =
      canonical.propsEvents.length === 0 &&
      typeof batchOwner?.updateTransactionBatch === 'function'
        ? this.propsManagerOwner.prepareCanonicalElementTransactionEvents(
            options
          )
        : canonical.propsEvents
    const propertyOwners = this.createCanonicalPropertyDeliveryOwners(
      canonical.elements
    )
    const propsEvents = preparedPropsEvents.map(
      ({ eventName, payload, options: eventOptions }) => ({
        type: EventTypes.UPDATE_TRANSACTION,
        eventName,
        payload,
        options: eventOptions
      })
    ) satisfies readonly UpdateTransactionEvent[]
    const sceneEvents = this.prepareSceneTreeTransactionEvents(options)
    if (sceneEvents.length !== canonical.elements.length) {
      throw new Error(
        '[SceneTree] Canonical element batch requires one ordered Scene evidence event per element'
      )
    }

    const events = [...propsEvents, ...sceneEvents]
    const deliveryEvidence: CanonicalEventDeliveryEvidence[] = [
      ...propsEvents.map(({ payload }) => ({
        orderedIds: propertyOwners.map(({ orderedId }) => orderedId),
        sharedRecords:
          payload.action === PROPS_ACTIONS.ADD_PROPERTY
            ? this.propsManagerOwner.createCanonicalPropertyDeliveryRecords(
                payload as AddRemovePropertyChange,
                propertyOwners
              )
            : (() => {
                throw new Error(
                  '[SceneTree] Canonical element batch requires additive Props evidence'
                )
              })()
      })),
      ...sceneEvents.map((_event, index) => ({
        orderedIds: [propertyOwners[index].orderedId]
      }))
    ]

    if (typeof batchOwner?.updateTransactionBatch === 'function') {
      try {
        batchOwner.updateTransactionBatch(events, deliveryEvidence)
        markCanonicalBatchHandoffAccepted(handoffState)
      } catch (error) {
        if (reportsAcceptedCanonicalBatchHandoff(error)) {
          markCanonicalBatchHandoffAccepted(handoffState)
        }
        throw error
      }
    } else if (transactionOwner) {
      throw new Error(
        '[SceneTree] Canonical element batch requires a batch-capable transaction owner'
      )
    } else {
      events.forEach(({ eventName, payload, options: eventOptions }) => {
        updateTransaction(eventName, payload, eventOptions)
      })
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

    this.prepareSceneTreeTransactionEvents(options).forEach(
      ({ eventName, payload, options: eventOptions }) => {
        updateTransaction(eventName, payload, eventOptions)
      }
    )
    this.cleanChanges()
  }

  dispose() {
    this._elements.clear()
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
