import { BehaviorSubject } from 'rxjs'
import { EntityTypes } from '@asra/utils'
import type {
  ElementRawData,
  GroupRawData,
  WorkspaceRawData
} from '@asra/utils'
import type { SceneTree, Workspace } from '@asra/scene-tree'

interface UIChildren {
  children: string[]
}

type UIWorkspaceData = Omit<
  Pick<WorkspaceRawData, 'id' | 'name' | 'type'>,
  'children'
> &
  UIChildren

type UINormalElementData = ElementRawData
type UIGroupElementData = Omit<GroupRawData, 'children'> & UIChildren
type UIAllElementData = UINormalElementData | UIGroupElementData

type UIElementData = Partial<UIAllElementData>

export default class SceneTreeStore {
  private sceneTree: SceneTree
  private workspaceId: string
  private workspace: BehaviorSubject<UIWorkspaceData>
  private elements: Map<string, BehaviorSubject<UIElementData>>
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

  getElement(elementId: string): BehaviorSubject<UIElementData> | undefined {
    return this.elements.get(elementId)
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
      ;(element as UIGroupElementData).children.forEach((childId: string) => {
        const child = this.getElement(childId)?.getValue()
        if (!child) return

        this.collectChildrenIds(childId, ids)
      })
    }
  }

  addElement(
    parentId: string,
    data: Partial<ElementRawData | GroupRawData>,
    index = -1
  ) {
    const parent = this.getElement(parentId)
    const avaliableParent =
      parent ?? (this.workspace as BehaviorSubject<UIElementData>)

    if (avaliableParent && data.id) {
      const parentData = avaliableParent.getValue() as UIGroupElementData
      const idx = index > -1 ? index : parentData.children.length
      const newChildren = [...parentData.children]
      newChildren.splice(idx, 0, data.id)

      avaliableParent.next({
        ...parentData,
        children: newChildren
      })

      this.elements.set(data.id, new BehaviorSubject(data))
    }
  }

  removeElement(
    parentId: string,
    data: Partial<ElementRawData | GroupRawData>,
    index = -1
  ): void {
    const parent = this.getElement(parentId)
    const avaliableParent =
      parent ?? (this.workspace as BehaviorSubject<UIElementData>)
    if (avaliableParent && data.id) {
      const parentData = avaliableParent.getValue() as UIGroupElementData
      const idx = index > -1 ? index : parentData.children.indexOf(data.id)
      const newChildren = [...parentData.children]

      newChildren.splice(idx, 1)

      avaliableParent.next({
        ...parentData,
        children: newChildren
      })

      this.elements.delete(data.id)
    }
  }

  updateFlattenedElementIds() {
    this.flattenedElementIds = this.getFlattenedElementIds()
  }
}
