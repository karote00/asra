import type {
  GroupRawData,
  GroupAttrs,
  ElementInstanceTypes,
  IGroupElement
} from '@asra/utils'
import { EntityTypes, NameTypes } from '@asra/utils'
import Props from './props'
import Element from './element'

type GroupDataType = Partial<GroupRawData>

class Group<T extends GroupAttrs = GroupAttrs>
  extends Element<T>
  implements IGroupElement<T>
{
  override data: T = { ...this.data, children: [] } as T
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

  addElement(element: ElementInstanceTypes, index = -1) {
    if (!element) {
      return
    }

    const children = [...this.get('children')]
    const idx = index ?? children.length
    children.splice(idx, 0, element.get('id'))
    this.set('children', children)
  }

  removeElement(element: ElementInstanceTypes, index: number) {
    if (!element) {
      return
    }

    const children = [...this.get('children')]
    if (children.indexOf(element.get('id')) !== index) {
      return
    }

    children.splice(index, 1)
    this.set('children', children)
  }
}

export default Group
