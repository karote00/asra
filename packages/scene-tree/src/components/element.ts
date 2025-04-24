import type {
  ElementRawData,
  ElementAttrs,
  IElement,
  PropsRawData,
  ComputedAttrs,
  PropertyComponentInstanceDataTypes,
  ElementInitData
} from '@asra/utils'
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
  computed!: Computed<ComputedAttrs>

  constructor(data: ElementInitData = {}) {
    super(elementChangeHandler.addChange)
    this._init()

    const { rawData, propOverrides } = data

    if (rawData && Object.keys(rawData).length) {
      this.load(rawData)
    } else {
      this.create()
    }

    this.setupProps(rawData?.props)
    this.applyPropOverrides(propOverrides)
  }

  _init(): void {
    this._idType ??= IDTypes.ELEMENT
    this._nameType ??= NameTypes.ELEMENT
    this.data = {
      id: '',
      type: EntityTypes.UNDEFINED,
      name: '',
      visible: false,
      lock: true
    } as T
  }

  create(): void {
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

      this.computed = new Computed(elementId, this.props)
    }
  }

  applyPropOverrides<K extends keyof PropertyComponentInstanceDataTypes>(
    propOverrides?: ElementInitData['propOverrides']
  ) {
    if (!propOverrides) {
      return
    }

    Object.keys(propOverrides).forEach((propKey) => {
      this.props.updateData(
        propKey as K,
        propOverrides[propKey as K] as PropertyComponentInstanceDataTypes[K]
      )
    })
  }

  updateComputedData<K extends keyof ComputedAttrs>(
    key: K,
    data: ComputedAttrs[K]
  ) {
    if (!(key in this.data)) {
      this.computed.set(key, data)

      // Convert data type from ComputedAttrs to PropertyComponentInstanceDataTypes
      type KEY = keyof PropertyComponentInstanceDataTypes
      this.props.updateData(
        key as KEY,
        data as PropertyComponentInstanceDataTypes[KEY]
      )
    }
  }

  getAllComputedData() {
    if (this.get('type') !== EntityTypes.WORKSPACE) {
      return this.computed.save()
    }

    return {}
  }

  cleanup() {
    this.props.cleanup()
  }
}

export default Element
