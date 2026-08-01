import propsManager, { type PropsManager } from '@asyra/props-manager'
import { ComputedAttrs, IComputed, IProps, Setter } from '@asyra/utils'

class Computed<T extends ComputedAttrs>
  extends Setter<T>
  implements IComputed<T>
{
  _idType!: string
  _nameType!: string

  constructor(
    elementId: string,
    props: IProps,
    propertyNames: string[],
    private readonly propsManagerOwner: PropsManager = propsManager,
    initialOwnerValues?: Readonly<Record<string, unknown>>
  ) {
    super(() => undefined)

    this._init()
    this.data.id = elementId
    this.setup(props, propertyNames, initialOwnerValues)
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

  setup(
    props: IProps,
    propertyNames: string[],
    initialOwnerValues?: Readonly<Record<string, unknown>>
  ): void {
    propertyNames.forEach((propName) => {
      const initialOwnerValue = initialOwnerValues?.[propName]
      if (
        initialOwnerValues &&
        Object.prototype.hasOwnProperty.call(initialOwnerValues, propName) &&
        initialOwnerValue !== undefined &&
        !Array.isArray(initialOwnerValue)
      ) {
        ;(this.data as unknown as Record<string, unknown>)[propName] =
          initialOwnerValue
        return
      }

      const propId = props.getPropId(propName)
      if (!propId) return

      const propComponent = this.propsManagerOwner.getPropertyById(propId)
      if (!propComponent) {
        return
      }

      const values = propComponent.getValue()
      Object.assign(this.data, values)
    })
  }

  set<K extends keyof T>(key: K, data: T[K]) {
    this.ensureKey(key as string)
    super.set(key, data)
  }

  dispose() {
    // Computed owns no subscriptions; Element cleanup retains this lifecycle hook.
  }

  save() {
    // Save all keys in data except id?
    // Original save was explicit: x, y, width, height.
    // Now it should be dynamic?
    return { ...this.data }
  }
}

export default Computed
