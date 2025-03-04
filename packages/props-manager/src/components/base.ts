import { Unit } from '@asra/utils'

abstract class BaseComponent<T> {
  abstract update(data: T): void
  abstract getValue(): Record<string, number>
  abstract getUnit(): Record<string, Unit>
}

export default BaseComponent
