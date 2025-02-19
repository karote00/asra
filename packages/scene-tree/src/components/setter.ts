import { EntityTypes } from '@asra/utils'
import type { ElementAttrs, ISetter } from '@asra/utils'

class Setter<T extends ElementAttrs = ElementAttrs> implements ISetter<T> {
  data: T = {
    id: '',
    type: EntityTypes.UNDEFINED,
    name: '',
    visible: true,
    lock: false
  } as T

  constructor() {}

  get<K extends keyof T>(key: K): T[K] {
    if (key in this.data) {
      return this.data[key]
    }
    throw new Error('Not allow to get value which is not in entity data.')
  }

  set() {}
}

export default Setter
