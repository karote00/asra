import propsManager from '@asra/props-manager'
import {
  ComputedAttrs,
  IComputed,
  IDTypes,
  NameTypes,
  PropsRawData,
  Setter
} from '@asra/utils'
import Props from './props'

const emptyChangeHandler = () => {}

const PROPS_MAP: Record<string, string[]> = {
  position: ['x', 'y'],
  dimension: ['width', 'height']
}

class Computed<T extends ComputedAttrs>
  extends Setter<T>
  implements IComputed<T>
{
  _idType!: IDTypes
  _nameType!: NameTypes

  constructor(props: Props) {
    super(emptyChangeHandler)

    this._init()
    this.setup(props)
  }

  _init() {
    this.data = {
      id: '',
      x: 0,
      y: 0,
      width: 0,
      height: 0
    } as T
  }

  setup(props: Props): void {
    Object.keys(PROPS_MAP).forEach((propName) => {
      const map = PROPS_MAP[propName]
      const propId = props[propName as keyof PropsRawData] as string
      const propComponent = propsManager.getComponentById(propId)
      if (!propComponent) {
        return
      }

      const values = propComponent.getValue()
      map.forEach((propKey) => {
        this.data[propKey as keyof T] = values[propKey] as T[keyof T]
      })
    })
  }

  set<K extends keyof T>(key: K, data: T[K]) {
    super.set(key, data)
  }

  save() {
    const data = {} as T
    data.x = this.data.x
    data.y = this.data.y
    data.width = this.data.width
    data.height = this.data.height

    return data
  }
}

export default Computed
