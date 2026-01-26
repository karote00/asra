import { BehaviorSubject } from 'rxjs'
import { EntityTypes } from '@asyra/utils'
import type {
  ComputedAttrs,
  DataTypes,
  ElementRawData,
  GroupRawData,
  WorkspaceRawData
} from '@asyra/utils'
import type { SceneTree, Workspace } from '@asyra/scene-tree'
import uiContext from '../ui-context'

type UIWorkspaceData = Partial<
  Pick<WorkspaceRawData, 'id' | 'name' | 'type' | 'children'> & ComputedAttrs
>

type UIAllElementData = (ElementRawData | GroupRawData) & ComputedAttrs

type UIElementData = Partial<UIAllElementData>

export default class SceneTreeStore {
  private sceneTree: SceneTree
  private dirty: boolean
  private workspaceId: string
  private workspace: BehaviorSubject<UIWorkspaceData>
  private _elements: Map<
    string,
    BehaviorSubject<UIElementData> | BehaviorSubject<UIWorkspaceData>
  >
  private _deletedMap: Map<
    string,
    BehaviorSubject<UIElementData> | BehaviorSubject<UIWorkspaceData>
  >

  constructor(sceneTree: SceneTree) {
    this.sceneTree = sceneTree
    this.dirty = false
    this.workspaceId = ''
    this.workspace = new BehaviorSubject<UIWorkspaceData>({
      id: this.workspaceId,
      name: '',
      children: [],
      type: EntityTypes.WORKSPACE
    })
    this._elements = new Map()
    this._deletedMap = new Map()
  }

  reload() {
    this.workspaceId = this.sceneTree.workspace
    const currentWs = this.sceneTree.currentWorkspace

    if (
      this.workspaceId &&
      currentWs &&
      currentWs.get('id') === this.workspaceId
    ) {
      const ws = currentWs
      this.workspace = new BehaviorSubject<UIWorkspaceData>({
        id: ws.get('id'),
        name: ws.get('name'),
        type: ws.get('type'),
        children: [...((ws as Workspace).get('children') || [])]
      })
      this.addToMap(ws.get('id'), this.workspace)
    }

    this.sceneTree.getAllElements().forEach((element, id) => {
      if (element.get('type') !== EntityTypes.WORKSPACE) {
        this.addToMap(id, new BehaviorSubject(element.save() as UIElementData))
      }
    })

    this.updateFlattenedElementIds()
  }

  markDirty() {
    this.dirty = true
  }

  clearDirty() {
    this.dirty = false
  }

  fireChange() {
    if (this.dirty) {
      this.clearDirty()
      this.updateFlattenedElementIds()
    }
  }

  getElement(
    elementId: string
  ):
    | BehaviorSubject<UIElementData>
    | BehaviorSubject<UIWorkspaceData>
    | undefined {
    return this._elements.get(elementId)
  }

  addToMap(
    elementId: string,
    elementSubject:
      | BehaviorSubject<UIElementData>
      | BehaviorSubject<UIWorkspaceData>
  ) {
    this.removeFromDeleteMap(elementId)
    this._elements.set(elementId, elementSubject)
  }

  removeFromMap(elementId: string) {
    const elementSubject = this.getElement(elementId)
    if (elementSubject) {
      this.addToDeleteMap(elementId, elementSubject)
    }
    this._elements.delete(elementId)
  }

  addToDeleteMap(
    elementId: string,
    elementSubject:
      | BehaviorSubject<UIElementData>
      | BehaviorSubject<UIWorkspaceData>
  ) {
    this._deletedMap.set(elementId, elementSubject)
  }

  getRestoreElementById(
    elementId: string
  ):
    | BehaviorSubject<UIElementData>
    | BehaviorSubject<UIWorkspaceData>
    | undefined {
    return this._deletedMap.get(elementId)
  }

  removeFromDeleteMap(elementId: string) {
    this._deletedMap.delete(elementId)
  }

  isGroup(element: UIElementData) {
    return 'children' in element
  }

  getFlattenedElementIds() {
    const ids: string[] = []
    const workspace = this.workspace.getValue()
    if (workspace?.children) {
      workspace.children.forEach((childId: string) => {
        this.collectChildrenIds(childId, ids)
      })
    }

    return ids
  }

  collectChildrenIds(elementId: string, ids: string[]): void {
    const elementS = this.getElement(elementId)
    if (!elementS) return

    const element = elementS.getValue()
    if (element.id) {
      ids.push(element.id)
    }
    if (this.isGroup(element)) {
      ;(element as GroupRawData).children.forEach((childId: string) => {
        const child = this.getElement(childId)?.getValue()
        if (!child) return

        this.collectChildrenIds(childId, ids)
      })
    }
  }

  updateFlattenedElementIds() {
    uiContext.flattenedElementIds.next(this.getFlattenedElementIds())
  }

  addElement(data: Partial<ElementRawData | GroupRawData>) {
    this.markDirty()
    const elementSubject =
      this.getRestoreElementById(data.id as string) || new BehaviorSubject(data)
    this.addToMap(data.id as string, elementSubject)
  }

  removeElement(
    data: Partial<ElementRawData | GroupRawData>,
    parentId: string
  ): void {
    this.markDirty()
    const parent = this.getElement(parentId)
    const avaliableParent =
      parent ?? (this.workspace as BehaviorSubject<UIWorkspaceData>)
    if (avaliableParent && data.id) {
      const parentData = avaliableParent.getValue() as GroupRawData
      const idx = parentData.children.indexOf(data.id)
      const newChildren = [...parentData.children]

      newChildren.splice(idx, 1)

      avaliableParent.next({
        ...parentData,
        children: newChildren
      })

      this.removeFromMap(data.id)
    }
  }

  updateElement(elementId: string, key: string, after: DataTypes) {
    const element = this.getElement(elementId)
    if (!element) return

    this.markDirty()
    const current = element.getValue()
    if ('children' in current) {
      ;(element as BehaviorSubject<UIWorkspaceData | GroupRawData>).next({
        ...current,
        [key]: after
      })
    } else {
      ;(element as BehaviorSubject<UIElementData>).next({
        ...current,
        [key]: after
      })
    }
  }

  getElementGeneralData(elementId: string) {
    const element = this.getElement(elementId)
    if (!element) return

    return element.getValue()
  }
}
