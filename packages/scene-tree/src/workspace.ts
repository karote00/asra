import type {
  WorkspaceRawData,
  ElementInstanceTypes,
  GroupInstanceTypes
} from '@asra/utils'
import { isGroupEntity, IDTypes, NameTypes, EntityTypes } from '@asra/utils'
import Group from './group'
import { createElement } from './utils'

type WorkspaceDataType = Partial<WorkspaceRawData>

class Workspace extends Group {
  _idType: IDTypes = IDTypes.WORKSPACE
  _nameType: NameTypes = NameTypes.WORKSPACE
  _entityType: EntityTypes = EntityTypes.WORKSPACE

  constructor() {
    super()
  }

  _init(): void {
    this._idType = IDTypes.WORKSPACE
    this._nameType = NameTypes.WORKSPACE
    super._init()
  }

  load(data: WorkspaceDataType): void {
    if (!data) {
      return
    }

    if (data.children) {
      data.children.forEach((childData) => {
        createElement(childData)
      })
    }
  }

  get firstFrame(): ElementInstanceTypes | undefined {
    return this.get('children').find(
      (child: ElementInstanceTypes) =>
        isGroupEntity(child.get('type')) &&
        (child as GroupInstanceTypes).get('children')
    )
  }

  addNewElement(
    element: ElementInstanceTypes,
    parent?: GroupInstanceTypes,
    index = -1
  ): boolean {
    if (!element) {
      return false
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
      return avaliableParent.addElement(element, index)
    }

    // Add new element to Workspace
    const idx = index > -1 ? index : this.get('children').length
    this.get('children').splice(idx, 0, element)

    return true
  }
}

export default Workspace
