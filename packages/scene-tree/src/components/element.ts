import type { ElementRawData, ElementAttrs, IElement } from '@asra/utils'
import { IDTypes, NameTypes, EntityTypes, id, name } from '@asra/utils'
import Props from './props'
import Computed from './computed'

type ElementDataType = Partial<ElementRawData>

const ElementProps: (keyof ElementAttrs)[] = ['id', 'name', 'visible', 'lock']

class Element<T extends ElementAttrs = ElementAttrs> implements IElement<T> {
  _idType: IDTypes = IDTypes.ELEMENT
  _nameType: NameTypes = NameTypes.ELEMENT
  _entityType: EntityTypes = EntityTypes.ELEMENT
  data: T = {
    id: '',
    type: EntityTypes.UNDEFINED,
    name: '',
    visible: true,
    lock: false
  } as T
  props: Props = new Props()
  computed: Computed = new Computed()

  constructor() {
    this._init()
  }

  _init(): void {
    this.data.id = id(this._idType)
    this.data.type = this._entityType
    this.data.name = name(this._nameType)
    this.data.visible = true
    this.data.lock = false
  }

  get<K extends keyof T>(key: K): T[K] {
    if (key in this.data) {
      return this.data[key]
    }
    throw new Error('Not allow to get value which is not in entity data.')
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
