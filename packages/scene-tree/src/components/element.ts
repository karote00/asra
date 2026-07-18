import type {
  EvnetOptions,
  ElementRawData,
  ElementAttrs,
  IElement,
  IProps,
  PropsRawData,
  ComputedAttrs,
  PropertyComponentInstanceDataTypes
} from '@asyra/utils'
import { acknowledgeTransactionReplayApplied } from '@asyra/reactive-events'
import {
  Setter,
  IDTypes,
  NameTypes,
  EntityTypes,
  id,
  loadId,
  name,
  loadName
} from '@asyra/utils'
import Props from './props'
import Computed from './computed'
import ElementChangeHandler from './element-change-handler'

const elementChangeHandler = new ElementChangeHandler('raw')

type ElementDataType = Partial<ElementRawData>

const ElementProps: (keyof ElementAttrs)[] = [
  'id',
  'name',
  'parentId',
  'visible',
  'lock'
]

class Element<T extends ElementAttrs = ElementAttrs>
  extends Setter<T>
  implements IElement<T>
{
  _idType: string = ''
  _nameType: string = ''
  protected computedPropertyNames: string[] = ['position', 'dimension', 'fills']

  props!: IProps
  computed!: Computed<ComputedAttrs>

  constructor(
    data?: Partial<ElementRawData>,
    idPrefix?: string,
    namePrefix?: string
  ) {
    super(elementChangeHandler.addChange, acknowledgeTransactionReplayApplied)
    this._idType = idPrefix || IDTypes.ELEMENT
    this._nameType = namePrefix || NameTypes.ELEMENT

    this._init()

    if (data && Object.keys(data).length) {
      this.load(data)
    }

    this.setupProps(data?.props)
  }

  _init(): void {
    this.data = {
      id: id(this._idType),
      type: EntityTypes.UNDEFINED,
      name: name(this._nameType),
      parentId: '',
      visible: true,
      lock: false
    } as T
  }

  load(data: ElementDataType): void {
    if (!data) {
      return
    }

    if (data.type !== EntityTypes.WORKSPACE) {
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
    }
  }

  save(): ElementRawData {
    const data = {} as ElementRawData
    data.id = this.get('id')
    data.type = this.get('type')
    data.name = this.get('name')
    data.parentId = this.get('parentId')
    data.visible = this.get('visible')
    data.lock = this.get('lock')

    if (this.data.type !== EntityTypes.WORKSPACE) {
      data.props = this.props.save()
    }

    return data
  }

  setupProps(propsData?: Partial<PropsRawData>) {
    const elementId = this.get('id') as string
    if (this.data.type !== EntityTypes.WORKSPACE) {
      if (propsData) {
        this.props = new Props(elementId, propsData)
      } else {
        this.props = new Props(elementId)
      }

      this.computed = new Computed(
        elementId,
        this.props,
        this.computedPropertyNames
      )
    }
  }

  updateComputedData<K extends keyof ComputedAttrs>(
    key: K,
    data: ComputedAttrs[K],
    options?: EvnetOptions
  ) {
    if (key in this.computed.data || !(key in this.data)) {
      this.computed.set(key, data, options)

      // Convert data type from ComputedAttrs to PropertyComponentInstanceDataTypes
      type KEY = keyof PropertyComponentInstanceDataTypes
      this.props.updateData(
        key as KEY,
        data as PropertyComponentInstanceDataTypes[KEY],
        options
      )
    }
  }

  getAllComputedData() {
    if (this.get('type') !== EntityTypes.WORKSPACE) {
      this.computed.setup(this.props, this.computedPropertyNames)
      return this.computed.save()
    }

    return {}
  }

  cleanup(options?: EvnetOptions) {
    this.props.cleanup(options)
    this.computed.dispose()
  }
}

export default Element
