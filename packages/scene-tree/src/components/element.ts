import type { ElementRawData, ElementAttrs, IElement } from '@asra/utils'
import { IDTypes, NameTypes, EntityTypes, id, name } from '@asra/utils'
import Setter from './setter'
import Props from './props'
import Computed from './computed'

type ElementDataType = Partial<ElementRawData>

const ElementProps: (keyof ElementAttrs)[] = ['id', 'name', 'visible', 'lock']

class Element<T extends ElementAttrs = ElementAttrs>
  extends Setter<T>
  implements IElement<T>
{
  _idType!: IDTypes
  _nameType!: NameTypes

  props: Props = new Props()
  computed: Computed = new Computed()

  constructor() {
    super()
    this._init()
  }

  _init(): void {
    this._idType ??= IDTypes.ELEMENT
    this._nameType ??= NameTypes.ELEMENT

    this.data.id = id(this._idType)
    this.data.type = EntityTypes.ELEMENT
    this.data.name = name(this._nameType)
    this.data.visible = true
    this.data.lock = false
  }

  load(data: ElementDataType): void {
    if (!data) {
      return
    }

    ElementProps.forEach((propName) => {
      const key = propName as keyof ElementAttrs
      const newValue = data[key] as T[keyof T]
      if (newValue !== undefined) {
        this.data[propName as keyof T] = newValue
      }
    })
    this.props.load(data.props)
  }

  save(): ElementRawData {
    const data = {} as ElementRawData
    data.id = this.get('id')
    data.type = this.get('type')
    data.name = this.get('name')
    data.visible = this.get('visible')
    data.lock = this.get('lock')
    return data
  }
}

export default Element
