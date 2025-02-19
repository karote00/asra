import type {
  WorkspaceRawData,
  ElementInstanceTypes,
  GroupInstanceTypes,
  IElement
} from '@asra/utils'
import { isGroupEntity, IDTypes, NameTypes, EntityTypes } from '@asra/utils'
import Group from './group'
import sceneTree from '../sceneTree'
import type { GroupChildreChangeType } from '../types'

type WorkspaceDataType = Partial<WorkspaceRawData>

class Workspace extends Group {
  constructor() {
    super()
  }

  _init(): void {
    this._idType = IDTypes.WORKSPACE
    this._nameType = NameTypes.WORKSPACE
    super._init()
    this.data.type = EntityTypes.WORKSPACE
  }

  load(data: WorkspaceDataType): void {
    super.load(data)
  }

  get firstFrame(): ElementInstanceTypes | null {
    let result = null

    const children = this.get('children')
    for (let i = 0, childId = children[i]; i < children.length; i++) {
      const child = sceneTree.getElementById(childId)
      if (
        isGroupEntity(child.get('type')) &&
        (child as GroupInstanceTypes).get('children')
      ) {
        result = child
        break
      }
    }

    return result
  }

  addNewElement(
    element: ElementInstanceTypes,
    parent?: GroupInstanceTypes,
    index = -1
  ): GroupChildreChangeType | null {
    if (!element) {
      return null
    }

    let avaliableParent = parent
    if (!avaliableParent) {
      const firstFrame = this.firstFrame
      if (firstFrame) {
        avaliableParent = this.firstFrame as GroupInstanceTypes
      }
    }

    // Add new element to Group type instance
    if (avaliableParent && avaliableParent.get('children')) {
      const originalChildrenList = [...avaliableParent.get('children')]
      avaliableParent.addElement(element, index)
      const newChildrenList = [...avaliableParent.get('children')]
      return {
        parentId: avaliableParent.get('id'),
        before: originalChildrenList,
        after: newChildrenList
      }
    }

    // Add new element to Workspace
    const originalChildrenList = [...this.get('children')]
    const idx = index > -1 ? index : this.get('children').length
    this.get('children').splice(idx, 0, element.get('id'))
    const newChildrenList = [...this.get('children')]

    return {
      parentId: this.get('id'),
      before: originalChildrenList,
      after: newChildrenList
    }
  }

  removeElement(element: IElement, index: number, parent?: GroupInstanceTypes) {
    if (!element) {
      return
    }

    let avaliableParent = parent
    if (!avaliableParent) {
      const firstFrame = this.firstFrame
      if (firstFrame) {
        avaliableParent = this.firstFrame as GroupInstanceTypes
      }
    }

    const elementId = element.get('id')
    let idx = index ?? avaliableParent?.get('children').indexOf(elementId)

    // Remove element from Group type instance
    if (avaliableParent && avaliableParent.get('children')) {
      avaliableParent.removeElement(element, idx)
    }

    idx = index ?? this.get('children').indexOf(elementId)

    // Remove element from Workspace
    this.get('children').splice(idx, 1)
  }
}

export default Workspace
