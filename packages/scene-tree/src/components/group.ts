import type {
  GroupRawData,
  GroupAttrs,
  ElementInstanceTypes,
  IGroupElement,
  ElementRawData
} from '@asyra/utils'
import { IDTypes, NameTypes } from '@asyra/utils'
import type { PropsManager } from '@asyra/props-manager'
import Element from './element.js'

type GroupDataType = Partial<GroupRawData>

class Group<T extends GroupAttrs = GroupAttrs>
  extends Element<T>
  implements IGroupElement<T>
{
  constructor(
    data?: Partial<ElementRawData>,
    idPrefix?: string,
    namePrefix?: string,
    propsManager?: PropsManager
  ) {
    super(
      data,
      idPrefix || IDTypes.GROUP,
      namePrefix || NameTypes.GROUP,
      propsManager
    )
  }

  _init(): void {
    super._init()
    this.data.children = []
  }

  load(data: GroupDataType): void {
    super.load(data)
    this.data.children = (data.children as string[]) || []
  }

  /**
   * Scene Tree batch-owner write. Ordered ADD_ELEMENT changes provide the
   * external transaction and replay evidence for this membership replacement.
   */
  replaceChildrenFromCanonicalBatch(children: readonly string[]): void {
    this.data.children = [...children]
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
    const idx = index > -1 ? index : children.length
    children.splice(idx, 0, element.get('id'))
    this.set('children', children)
    element.set('parentId', this.get('id'), { undoable: false })
  }

  removeElement(element: ElementInstanceTypes) {
    if (!element) {
      return
    }

    const children = [...this.get('children')]
    const index = children.indexOf(element.get('id'))
    if (index < 0) {
      return
    }

    children.splice(index, 1)
    this.set('children', children)
    element.set('parentId', '', { undoable: false })
  }
}

export default Group
