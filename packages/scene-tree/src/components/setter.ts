import { EntityTypes, OWNER, SCENE_TREE_ACTIONS } from '@asra/utils'
import type { DataTypes, ElementAttrs, ISetter } from '@asra/utils'
import sceneTree from '../sceneTree'
import { EventTypes } from '@asra/reactive-events'

class Setter<T extends ElementAttrs = ElementAttrs> implements ISetter<T> {
  data: T = {
    id: '',
    type: EntityTypes.UNDEFINED,
    name: '',
    visible: true,
    lock: false
  } as T

  get<K extends keyof T>(key: K): T[K] {
    if (key in this.data) {
      return this.data[key]
    }
    throw new Error('Not allow to get value which is not in entity data.')
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    if (key in this.data) {
      const before = this._cloneData(this.data[key])
      this.data[key] = value
      const after = this._cloneData(value)

      sceneTree.addChange({
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT,
        owner: OWNER.SCENE_TREE,
        eventName: EventTypes.UPDATE_ELEMENT,
        elementId: this.get('id'),
        key: key as string,
        before: before as DataTypes,
        after: after as DataTypes
      })
    }
  }

  private _cloneData<T>(data: T): T {
    if (typeof data === 'number' || typeof data === 'string') {
      return data
    } else if (Array.isArray(data)) {
      return [...data] as T
    } else if (typeof data === 'object' && data !== null) {
      return Object.keys(data).reduce((acc, key) => {
        ;(acc as Record<string, unknown>)[key] = this._cloneData(
          (data as Record<string, unknown>)[key]
        )
        return acc
      }, {} as T)
    }
    return data
  }
}

export default Setter
