import type { ElementRawData, ElementAttrs, IElement } from '@asra/utils'
import { IDTypes, NameTypes, EntityTypes, id, name } from '@asra/utils'
import Props from './props'
import Computed from './computed'

type ElementDataType = Partial<ElementRawData>

class Element<T extends ElementAttrs = ElementAttrs> implements IElement<T> {
  _idType: IDTypes = IDTypes.ELEMENT
  _nameType: NameTypes = NameTypes.ELEMENT
  _entityType: EntityTypes = EntityTypes.ELEMENT
  data: T = {
    id: '',
    type: EntityTypes.UNDEFINED,
    name: ''
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

    if (data.type) {
      this.data.type = data.type
    }
    this.props.load(data.props)
  }

  save(): ElementRawData {
    const data = {} as ElementRawData
    data.id = this.get('id')
    data.type = this.get('type')
    data.name = this.get('name')
    return data
  }
}

export default Element
