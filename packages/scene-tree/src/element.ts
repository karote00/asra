import {
  ElementRawData,
  EntityTypes,
  ID_TYPES,
  id,
  NAME_TYPES,
  name
} from '@asra/utils'
import Props from './props'
import Computed from './computed'

type ElementDataType = Partial<ElementRawData>

class Element {
  _idType: ID_TYPES = ID_TYPES.ELEMENT
  _nameType: NAME_TYPES = NAME_TYPES.ELEMENT
  data: {
    id: string
    name: string
    [key: string]: any
  } = {
    id: '',
    name: ''
  }
  type: EntityTypes = EntityTypes.ELEMENT
  props: Props = new Props()
  computed: Computed = new Computed()

  constructor() {
    this._init()
  }

  _init(): void {
    this.data.id = id(this._idType)
    this.data.name = name(this._nameType)
  }

  load(data: ElementDataType): void {
    if (!data) {
      return
    }

    this.type = data.type!
    this.props.load(data.props)
  }

  get(key: string) {
    if (key in this.data) {
      return this.data[key]
    }

    throw new Error('Not allow to get value which is not in entity data.')
  }
}

export default Element
