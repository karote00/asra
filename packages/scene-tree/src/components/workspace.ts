import type {
  WorkspaceRawData,
  ElementInstanceTypes,
  GroupInstanceTypes,
  IElement
} from '@asra/utils'
import { isGroupEntity, IDTypes, NameTypes, EntityTypes } from '@asra/utils'
import Group from './group'
import sceneTree from '../sceneTree'

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

  create(): void {
    super.create()
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
  ) {
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

    if (avaliableParent && avaliableParent.get('children')) {
      // Add new element to Group type instance
      avaliableParent.addElement(element, index)
    } else {
      // console.log('add to workspace')
      // console.log(element)
      // console.log(element.get('id'))
      // Add new element to Workspace
      const originalChildrenList = [...this.get('children')]
      const idx = index > -1 ? index : this.get('children').length
      originalChildrenList.splice(idx, 0, element.get('id'))
      this.set('children', originalChildrenList)
    }
    sceneTree.addToMap(element)
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
    if (avaliableParent && avaliableParent.get('children')) {
      // Remove element from Group type instance
      const idx = index ?? avaliableParent?.get('children').indexOf(elementId)
      avaliableParent.removeElement(element, idx)
    } else {
      // Add new element to Workspace
      const originalChildrenList = [...this.get('children')]
      const idx = index ?? this.get('children').indexOf(elementId)
      originalChildrenList.splice(idx, 1)
      this.set('children', originalChildrenList)
    }

    element.cleanup()

    // Remove element from Workspace
    sceneTree.removeFromMap(element)
  }
}

export default Workspace
