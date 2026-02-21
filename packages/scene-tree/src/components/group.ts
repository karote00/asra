import type {
  GroupRawData,
  GroupAttrs,
  ElementInstanceTypes,
  IGroupElement,
  ElementRawData
} from '@asyra/utils'
import { IDTypes, NameTypes } from '@asyra/utils'
import Element from './element'

type GroupDataType = Partial<GroupRawData>

class Group<T extends GroupAttrs = GroupAttrs>
  extends Element<T>
  implements IGroupElement<T>
{
  constructor(
    data?: Partial<ElementRawData>,
    idPrefix?: string,
    namePrefix?: string
  ) {
    super(data, idPrefix || IDTypes.GROUP, namePrefix || NameTypes.GROUP)
  }

  _init(): void {
    super._init()
    this.data.children = []
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
