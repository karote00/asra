import Factory from '@asra/factory'
import { WorkspaceRawData, GroupEntityTypes } from '@asra/utils'
import Group from './group'
import { createElement } from './utils'
import { ElementInstanceTypes, GroupInstanceTypes } from './constants'

type WorkspaceDataType = Partial<WorkspaceRawData>

class Workspace extends Group {
  children: ElementInstanceTypes[] = []

  constructor() {
    super()

    this._init()
  }

  _init(): void {}

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
    return this.children.find(
      (child: ElementInstanceTypes) =>
        child.type in GroupEntityTypes && (child as GroupInstanceTypes).children
    )
  }

  addNewElement(
    element: ElementInstanceTypes,
    parent?: GroupInstanceTypes,
    index?: number
  ): void {
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

    if (avaliableParent) {
      avaliableParent.addElement(element, index)
    } else {
      const idx = index ?? this.children.length
      this.children.splice(idx, 0, element)
    }
  }
}

export default Workspace
