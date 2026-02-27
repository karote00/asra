import propsManager from '@asyra/props-manager'
import {
  ComputedAttrs,
  IComputed,
  IProps,
  Setter,
  type EvnetOptions
} from '@asyra/utils'
import ElementChangeHandler from './element-change-handler'

const elementChangeHandler = new ElementChangeHandler()

class Computed<T extends ComputedAttrs>
  extends Setter<T>
  implements IComputed<T>
{
  _idType!: string
  _nameType!: string

  constructor(elementId: string, props: IProps, propertyNames: string[]) {
    super(elementChangeHandler.addChange)

    this._init()
    this.data.id = elementId
    this.setup(props, propertyNames)
  }

  _init() {
    this.data = {
      id: ''
    } as T
  }

  setup(props: IProps, propertyNames: string[]): void {
    propertyNames.forEach((propName) => {
      const propId = props.getPropId(propName)
      if (!propId) return

      const propComponent = propsManager.getPropertyById(propId)
      if (!propComponent) {
        return
      }

      const values = propComponent.getValue()
      // Merge all values into computed data
      Object.assign(this.data, values)
    })
  }

  set<K extends keyof T>(key: K, data: T[K], options?: EvnetOptions) {
    super.set(key, data, options)
  }

  save() {
    // Save all keys in data except id?
    // Original save was explicit: x, y, width, height.
    // Now it should be dynamic?
    return { ...this.data }
  }
}

export default Computed
