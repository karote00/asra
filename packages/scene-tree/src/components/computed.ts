import propsManager from '@asyra/props-manager'
import {
  ComputedAttrs,
  IComputed,
  IDTypes,
  NameTypes,
  Setter
} from '@asyra/utils'
import Props from './props'
import ElementChangeHandler from './element-change-handler'

const elementChangeHandler = new ElementChangeHandler()

class Computed<T extends ComputedAttrs>
  extends Setter<T>
  implements IComputed<T> {
  _idType!: string
  _nameType!: string

  constructor(elementId: string, props: Props, propertyNames: string[]) {
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

  setup(props: Props, propertyNames: string[]): void {
    propertyNames.forEach((propName) => {
      const propId = (props as any)[propName]
      if (!propId) return

      const propComponent = propsManager.getComponentById(propId)
      if (!propComponent) {
        return
      }

      const values = propComponent.getValue()
      // Merge all values into computed data
      Object.assign(this.data, values)
    })
  }

  set<K extends keyof T>(key: K, data: T[K]) {
    super.set(key, data)
  }

  save() {
    // Save all keys in data except id?
    // Original save was explicit: x, y, width, height.
    // Now it should be dynamic?
    return { ...this.data }
  }
}

export default Computed
