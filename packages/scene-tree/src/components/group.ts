import type {
  GroupRawData,
  GroupAttrs,
  ElementInstanceTypes
} from '@asra/utils'
import { EntityTypes, NameTypes } from '@asra/utils'
import Props from './props'
import Element from './element'

type GroupDataType = Partial<GroupRawData>

class Group extends Element<GroupAttrs> {
  data: GroupAttrs = { ...this.data, children: [] }
  props!: Props

  constructor() {
    super()
  }

  _init(): void {
    this._nameType ??= NameTypes.GROUP
    super._init()
    this.data.type = EntityTypes.GROUP
  }

  load(data: GroupDataType): void {
    super.load(data)
    this.data.children = (data.children as string[]) || []
  }

  save(): GroupRawData {
    const data = super.save() as GroupRawData
    data.children = this.data.children
    return data
  }

  addElement(element: ElementInstanceTypes, index = -1): boolean {
    if (!element) {
      return false
    }

    const children = this.get('children')

    const idx = index ?? children.length
    children.splice(idx, 0, element.get('id'))

    return true
  }

  removeElement(element: ElementInstanceTypes, index: number): boolean {
    if (!element) {
      return false
    }

    const children = this.get('children')
    if (children.indexOf(element.get('id')) !== index) {
      return false
    }

    children.splice(index, 1)

    return true
  }
}

export default Group
