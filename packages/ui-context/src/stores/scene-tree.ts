import { BehaviorSubject } from 'rxjs'
import { EntityTypes } from '@asra/utils'
import type {
  DataTypes,
  ElementRawData,
  GroupRawData,
  WorkspaceRawData
} from '@asra/utils'
import type { SceneTree, Workspace } from '@asra/scene-tree'

type UIWorkspaceData = Pick<
  WorkspaceRawData,
  'id' | 'name' | 'type' | 'children'
>

type UIAllElementData = ElementRawData | GroupRawData

type UIElementData = Partial<UIAllElementData>

export default class SceneTreeStore {
  private sceneTree: SceneTree
  private workspaceId: string
  private workspace: BehaviorSubject<UIWorkspaceData>
  private elements: Map<
    string,
    BehaviorSubject<UIElementData> | BehaviorSubject<UIWorkspaceData>
  >
  flattenedElementIds: string[]

  constructor(sceneTree: SceneTree) {
    this.sceneTree = sceneTree
    this.workspaceId = ''
    this.workspace = new BehaviorSubject<UIWorkspaceData>({
      id: this.workspaceId,
      name: '',
      children: [],
      type: EntityTypes.WORKSPACE
    })
    this.elements = new Map()
    this.flattenedElementIds = []
  }

  reload() {
    this.workspaceId = this.sceneTree.workspace
    if (
      this.workspaceId &&
      this.sceneTree.currentWorkspace.get('id') === this.workspaceId
    ) {
      const ws = this.sceneTree.currentWorkspace
      this.workspace = new BehaviorSubject<UIWorkspaceData>({
        id: ws.get('id'),
        name: ws.get('name'),
        type: ws.get('type'),
        children: [...((ws as Workspace).get('children') || [])]
      })
      this.elements.set(ws.get('id'), this.workspace)
    }

    this.sceneTree.getAllElements().forEach((element, id) => {
      if (element.get('type') !== EntityTypes.WORKSPACE) {
        this.elements.set(
          id,
          new BehaviorSubject(element.save() as UIElementData)
        )
      }
    })

    this.updateFlattenedElementIds()
  }

  getElement(
    elementId: string
  ):
    | BehaviorSubject<UIElementData>
    | BehaviorSubject<UIWorkspaceData>
    | undefined {
    return this.elements.get(elementId)
  }

  addToMap(
    elementId: string,
    elementSubject:
      | BehaviorSubject<UIElementData>
      | BehaviorSubject<UIWorkspaceData>
  ) {
    this.elements.set(elementId, elementSubject)
  }

  isGroup(element: UIElementData) {
    return 'children' in element
  }

  getFlattenedElementIds() {
    const ids: string[] = []

    this.workspace.getValue().children.forEach((childId: string) => {
      this.collectChildrenIds(childId, ids)
    })

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
    this.flattenedElementIds = this.getFlattenedElementIds()
  }

  addElement(data: Partial<ElementRawData | GroupRawData>) {
    this.elements.set(data.id as string, new BehaviorSubject(data))
  }

  removeElement(
    data: Partial<ElementRawData | GroupRawData>,
    parentId: string
  ): void {
    const parent = this.getElement(parentId)
    const avaliableParent =
      parent ?? (this.workspace as BehaviorSubject<UIElementData>)
    if (avaliableParent && data.id) {
      const parentData = avaliableParent.getValue() as GroupRawData
      const idx = parentData.children.indexOf(data.id)
      const newChildren = [...parentData.children]

      newChildren.splice(idx, 1)

      avaliableParent.next({
        ...parentData,
        children: newChildren
      })

      this.elements.delete(data.id)
    }
  }

  updateElement(elementId: string, key: string, after: DataTypes) {
    const element = this.getElement(elementId)
    if (!element) return

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
}
