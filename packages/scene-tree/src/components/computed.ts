import propsManager from '@asyra/props-manager'
import { acknowledgeTransactionReplayApplied } from '@asyra/reactive-events'
import {
  ComputedAttrs,
  DataTypes,
  IComputed,
  IProps,
  PropertyComponentInstanceTypes,
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
  private subscriptions = new Map<string, () => void>()

  constructor(elementId: string, props: IProps, propertyNames: string[]) {
    super(elementChangeHandler.addChange, acknowledgeTransactionReplayApplied)

    this._init()
    this.data.id = elementId
    this.setup(props, propertyNames)
  }

  _init() {
    this.data = {
      id: ''
    } as T
  }

  private ensureKey(key: string) {
    if (key in this.data) {
      return
    }

    ;(this.data as unknown as Record<string, unknown>)[key] = undefined
  }

  private applyPropertyValues(
    values: Record<string, DataTypes>,
    options?: EvnetOptions
  ) {
    const computedOptions =
      options?.shared === undefined
        ? options
        : {
            ...options,
            shared: undefined
          }
    Object.entries(values).forEach(([key, value]) => {
      if (value === undefined) {
        return
      }

      this.ensureKey(key)
      this.set(key as keyof T, value as T[keyof T], computedOptions)
    })
  }

  private subscribeToProperty(propComponent: PropertyComponentInstanceTypes) {
    const propId = propComponent.get('id')
    if (typeof propId !== 'string' || propId.length === 0) {
      return
    }

    if (this.subscriptions.has(propId)) {
      return
    }

    const unsubscribe = propComponent.on((change) => {
      const values = propComponent.getValue()
      this.applyPropertyValues(values, change.options)
    })
    this.subscriptions.set(propId, unsubscribe)
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
      this.subscribeToProperty(propComponent)
    })
  }

  set<K extends keyof T>(key: K, data: T[K], options?: EvnetOptions) {
    super.set(key, data, options)
  }

  dispose() {
    this.subscriptions.forEach((unsubscribe) => unsubscribe())
    this.subscriptions.clear()
  }

  save() {
    // Save all keys in data except id?
    // Original save was explicit: x, y, width, height.
    // Now it should be dynamic?
    return { ...this.data }
  }
}

export default Computed
