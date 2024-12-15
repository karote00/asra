import { GroupRawData, EntityTypes } from '@asra/utils'
import Props from './props'
import Element from './element'
import { ElementInstanceTypes } from './constants'

type GroupDataType = Partial<GroupRawData>

class Group extends Element {
  children: ElementInstanceTypes[] = []
  props!: Props

  constructor() {
    super()
  }

  _init(): void {
    this.type = EntityTypes.GROUP
    super._init()
  }

  load(data: GroupDataType): void {
    super.load(data)
  }

  addElement(element: ElementInstanceTypes, index?: number): boolean {
    if (!element) {
      return false
    }

    const idx = index ?? this.children.length
    this.children.splice(idx, 0, element)

    return true
  }
}

export default Group
