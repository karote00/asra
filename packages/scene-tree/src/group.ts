import {
  GroupRawData,
  EntityTypes,
  GroupAttrs,
  ElementInstanceTypes
} from '@asra/utils'
import Props from './props'
import Element from './element'

type GroupDataType = Partial<GroupRawData>

class Group extends Element<GroupAttrs> {
  data: GroupAttrs = {
    ...this.data,
    children: []
  }
  props!: Props

  constructor() {
    super()
  }

  _init(): void {
    this._entityType = EntityTypes.GROUP
    super._init()
  }

  load(data: GroupDataType): void {
    super.load(data)
  }

  save(): GroupRawData {
    const data = super.save() as GroupRawData
    data.children = this.data.children.map((child) => child.save())
    return data
  }

  addElement(element: ElementInstanceTypes, index = -1): boolean {
    if (!element) {
      return false
    }

    const children = this.get('children') as ElementInstanceTypes[]

    const idx = index ?? children.length
    children.splice(idx, 0, element)

    return true
  }
}

export default Group
