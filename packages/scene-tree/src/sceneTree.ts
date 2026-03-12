import type {
  ComputedAttrs,
  SceneTreeRawData,
  ElementRawData,
  GroupRawData,
  ElementInstanceTypes,
  GroupInstanceTypes,
  SceneTreeChange,
  EVENT_OPTIONS,
  EvnetOptions,
  CreateElementData
} from '@asyra/utils'
import {
  EntityTypes,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  isRecord
} from '@asyra/utils'
import { EventTypes, updateTransaction } from '@asyra/reactive-events'
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

  getRestoreElementById(elementId: string): ElementInstanceTypes {
    const restoredElement = this._deletedMap.get(
      elementId
    ) as ElementInstanceTypes
    this.addChangeForAddElement(restoredElement)
    return restoredElement
  }

  addToDeleteMap(element: ElementInstanceTypes) {
    this._deletedMap.set(element.get('id'), element)
  }

  removeFromDeleteMap(elementId: string) {
    this._deletedMap.delete(elementId)
  }

  addChangeForAddElement(element: ElementInstanceTypes) {
    this.addChange({
      eventName: EventTypes.ADD_ELEMENT,
      data: element.save(),
      action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
      undoType: EventTypes.REMOVE_ELEMENT,
      undoAction: EventTypes.REMOVE_ELEMENT
    })
  }

  addChangeForRemoveElement(element: ElementInstanceTypes) {
    this.addChange({
      eventName: EventTypes.REMOVE_ELEMENT,
      data: element.save(),
      parentId: element.get('parentId') as string,
      action: SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
      undoType: EventTypes.ADD_ELEMENT,
      undoAction: EventTypes.ADD_ELEMENT
    })
  }

  get currentWorkspace() {
    return this.getElementById(this.workspace)
  }

  createElement(
    elementData: Partial<ElementRawData>
  ): ElementInstanceTypes | null {
    if (elementData.type === EntityTypes.WORKSPACE) {
      return null
    }

    const newElement = createElement(elementData) as ElementInstanceTypes
    this.addChangeForAddElement(newElement)
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
      newElement = this.getRestoreElementById(elementData.id as string)
    } else {
      newElement = this.createElement(elementData)
    }

    if (newElement) {
      Object.keys(propOverrides).forEach((propKey) => {
        newElement.updateComputedData(
          propKey as keyof ComputedAttrs,
          propOverrides[propKey]
        )
      })
      workspace.addNewElement(newElement, parent, index)

      this.addToMap(newElement)

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

    this.addChangeForRemoveElement(element)
    workspace.removeElement(element, resolvedParent, options)
    this.commitSceneTreeTransaction(options)
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
    this.changes.forEach((change) => {
      const changeOptions = change.options ?? options
      const routedOptions: EVENT_OPTIONS = {
        ...(changeOptions ?? {}),
        shared: changeOptions?.shared ?? SharedDataChannelNames.SCENE_TREE
      }
      updateTransaction(change.eventName, change, routedOptions)
    })
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
