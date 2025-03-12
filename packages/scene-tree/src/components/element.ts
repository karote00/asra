import type { ElementRawData, ElementAttrs, IElement } from '@asra/utils'
import {
  Setter,
  IDTypes,
  NameTypes,
  EntityTypes,
  id,
  loadId,
  name,
  loadName
} from '@asra/utils'
import Props from './props'
import Computed from './computed'
import ElementChangeHandler from './element-change-handler'

const elementChangeHandler = new ElementChangeHandler()

type ElementDataType = Partial<ElementRawData>

const ElementProps: (keyof ElementAttrs)[] = ['id', 'name', 'visible', 'lock']

class Element<T extends ElementAttrs = ElementAttrs>
  extends Setter<T>
  implements IElement<T>
{
  _idType!: IDTypes
  _nameType!: NameTypes

  props!: Props
  computed: Computed = new Computed()

  constructor(data?: Partial<ElementRawData>) {
    super(elementChangeHandler.addChange)
    this._init()

    const elementId = this.get('id')
    if (this.data.type !== EntityTypes.WORKSPACE) {
      if (data && data.props) {
        this.props = new Props(elementId, data.props)
      } else {
        this.props = new Props(elementId)
      }
    }
  }

  _init(): void {
    this._idType ??= IDTypes.ELEMENT
    this._nameType ??= NameTypes.ELEMENT

    this.data = {
      id: id(this._idType),
      type: EntityTypes.ELEMENT,
      name: name(this._nameType),
      visible: true,
      lock: false
    } as T
  }

  load(data: ElementDataType): void {
    if (!data) {
      return
    }

    if (this.data.type !== EntityTypes.WORKSPACE) {
      ElementProps.forEach((propName) => {
        switch (propName) {
          case 'id': {
            const id = data.id
            if (id) {
              this.data.id = id
              loadId(id, this._idType)
            }
            break
          }
          case 'name': {
            const name = data.name
            if (name) {
              this.data.name = name
              loadName(name, this._nameType)
            }
            break
          }
          default: {
            const key = propName as keyof ElementAttrs
            const newValue = data[key] as T[keyof T]
            if (newValue !== undefined) {
              this.data[propName as keyof T] = newValue
            }
          }
        }
      })
      this.props.load(data.props)
    }
  }

  save(): ElementRawData {
    const data = {} as ElementRawData
    data.id = this.get('id')
    data.type = this.get('type')
    data.name = this.get('name')
    data.visible = this.get('visible')
    data.lock = this.get('lock')

    if (this.data.type !== EntityTypes.WORKSPACE) {
      data.props = this.props.save()
    }

    return data
  }

  cleanup() {
    this.props.cleanup()
  }
}

export default Element
