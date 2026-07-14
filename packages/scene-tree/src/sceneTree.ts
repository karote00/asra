import type {
  ComputedAttrs,
  ComputedDataPatch,
  ComputedDataPatchChange,
  SceneTreeRawData,
  ElementRawData,
  GroupRawData,
  ElementInstanceTypes,
  GroupInstanceTypes,
  SceneTreeChange,
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
  isRecord
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
} from './utils'
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

const cloneRecord = (value: unknown): Record<string, DataTypes> =>
  isRecord(value) ? ({ ...value } as Record<string, DataTypes>) : {}

const getComputedSnapshot = (
  element: ElementInstanceTypes
): Record<string, DataTypes> => {
  const snapshot = element.getAllComputedData()
  return isRecord(snapshot) ? (snapshot as Record<string, DataTypes>) : {}
}

export interface SceneTreeLoadDiagnostic {
  path: string
  message: string
}

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

  validateLoadData(data: unknown): {
    data: SceneTreeDataType
    diagnostics: SceneTreeLoadDiagnostic[]
  } {
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
      return { data: fallback, diagnostics }
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

        elements[normalizedId] = normalized as unknown as
          | ElementRawData
          | GroupRawData
      })
    }

    return {
      data: {
        workspace,
        workspaceList,
        elements
      },
      diagnostics
    }
  }

  load(data: SceneTreeDataType | unknown) {
    const validated = this.validateLoadData(data).data
    this.dispose()

    for (const elementId in validated.elements) {
      const elementData = validated.elements[elementId]
      try {
        let element
        if (elementData.type === EntityTypes.WORKSPACE) {
          element = createWorkspace(this, elementData)
        } else {
          element = createElement(elementData)
        }

        if (element) {
          this.addToMap(element as ElementInstanceTypes)
        }
      } catch {
        // Validation should prevent this path. Keep safe fallback behavior if it happens.
      }
    }

    const workspaceIds = Array.from(this._elements.entries())
      .filter(([, element]) => element.get('type') === EntityTypes.WORKSPACE)
      .map(([id]) => id)

    const validWorkspaceList = validated.workspaceList.filter((workspaceId) =>
      workspaceIds.includes(workspaceId)
    )

    const preferredWorkspace =
      workspaceIds.includes(validated.workspace) &&
      validated.workspace.length > 0
        ? validated.workspace
        : ''

    if (
      preferredWorkspace &&
      !validWorkspaceList.includes(preferredWorkspace)
    ) {
      validWorkspaceList.unshift(preferredWorkspace)
    }

    if (validWorkspaceList.length > 0) {
      this.workspaceList = validWorkspaceList
      this.workspace = validWorkspaceList[0]
      return
    }

    if (workspaceIds.length > 0) {
      this.workspaceList = workspaceIds
      this.workspace = workspaceIds[0]
      return
    }

    this._init()
  }

  save() {
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
      this.commitSceneTreeTransaction(options)
      propsManager.commitChanges(options)

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

    const children = (container.get('children') as string[]) ?? []
    if (!children.includes(elementId)) {
      return false
    }

    const operationChangeStart = this.changes.length
    this.addChangeForRemoveElement(
      element,
      resolvedParentId,
      children.indexOf(elementId)
    )
    const removeChange = this.changes[operationChangeStart]
    workspace.removeElement(element, resolvedParent, options)
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

    const patchChange: ComputedDataPatchChange = {}
    const previousChangeCount = this.changes.length
    const computedSnapshot = getComputedSnapshot(element)

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
      patchChange.values[key] = { before, after }
    })

    Object.entries(patch.records ?? {}).forEach(([key, recordPatch]) => {
      const computedKey = key as keyof ComputedAttrs
      const currentRecord = cloneRecord(computedSnapshot[key])
      let nextRecord = { ...currentRecord }
      const nextRecordPatch: NonNullable<
        ComputedDataPatchChange['records']
      >[string] = {}

      Object.entries(recordPatch.set ?? {}).forEach(([recordId, after]) => {
        const before = currentRecord[recordId]
        if (isEqual(before, after)) {
          return
        }

        nextRecord[recordId] = after
        nextRecordPatch.set ??= {}
        nextRecordPatch.set[recordId] =
          before === undefined ? { after } : { before, after }
      })
      ;(recordPatch.remove ?? []).forEach((recordId) => {
        if (!(recordId in currentRecord)) {
          return
        }

        nextRecordPatch.remove ??= {}
        nextRecordPatch.remove[recordId] = {
          before: currentRecord[recordId]
        }
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
      patchChange.records[key] = nextRecordPatch
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
