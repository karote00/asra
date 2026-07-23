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
  SceneTreeChange,
  SubtreeChange,
  SubtreeRemovalEntry,
  UpdateElementBatchChange,
  UpdateElementChange,
  UpdateElementPatchChange,
  EVENT_OPTIONS,
  EvnetOptions,
  CreateElementData
} from '@asyra/utils'
import {
  DataTypes,
  EntityTypes,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  isRecord,
  setOwnEnumerableValue
} from '@asyra/utils'
import {
  acknowledgeTransactionReplayApplied,
  EventTypes,
  updateTransaction
} from '@asyra/reactive-events'
import propsManager from '@asyra/props-manager'
import { isEqual } from 'lodash'
import componentRegistry from './component-registry'
import {
  createElement,
  createWorkspace,
  isGroupEntity,
  stripNonRawFields
} from './entity-data'
import type Workspace from './components/workspace'

type SceneTreeDataType = SceneTreeRawData

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

const cloneSceneTreeValue = <T>(data: T): T => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(data)
  }

  return JSON.parse(JSON.stringify(data)) as T
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
    }
  >()

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
          : createElement(elementData)
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
      action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
      undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE
    })
    acknowledgeTransactionReplayApplied()
    this.commitSceneTreeTransaction(options)
    propsManager.commitChanges(options)

    return { elementId, removed }
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
    const operationChangeStart = this.changes.length
    restoreOrder.forEach(({ elementId, parentId, index }) => {
      const restored = this.getRestoreElementById(elementId, false)
      const parent = this.getElementById(parentId) as GroupInstanceTypes
      workspace.addNewElement(restored, parent, index)
    })
    this.changes.splice(operationChangeStart)
    const rootEntry = removed[removed.length - 1]
    this.addChange({
      eventName: EventTypes.CHANGE_SUBTREE,
      elementId: rootEntry.elementId,
      removed,
      action: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
      undoAction: SCENE_TREE_ACTIONS.REMOVE_SUBTREE
    })
    acknowledgeTransactionReplayApplied()
    this.commitSceneTreeTransaction(options)

    return { elementId: rootEntry.elementId, removed }
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

    const newElement = createElement(elementData) as ElementInstanceTypes
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
    const workspace = this.currentWorkspace as Workspace
    if (!workspace) {
      return ''
    }

    let newElement: ElementInstanceTypes | null = null

    const propOverrides = stripNonRawFields(elementData)
    if (inUndoRedo) {
      newElement = this.getRestoreElementById(elementData.id as string, false)
    } else {
      newElement = this.createElement(elementData, false)
    }

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
      propsManager.commitChanges(options)
      this.commitSceneTreeTransaction(options)

      return newElement.get('id')
    }

    return ''
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
    propsManager.commitChanges(options)
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

    const propComponent = propsManager.getPropertyById(propId)
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

  commitSceneTreeTransaction(options?: EVENT_OPTIONS) {
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
      updateTransaction(
        batchChange.eventName,
        batchChange,
        pendingTransientComputedUpdate.options
      )
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
      updateTransaction(change.eventName, change, routedOptions)
    })

    flushPendingTransientComputedUpdate()

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
