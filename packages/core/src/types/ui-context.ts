import type { BehaviorSubject } from 'rxjs'
import type { PropertyRegistration, PropertyValue } from '@asyra/ui-context'

export interface UIContextAPIs {
  registerUIProperty: <T extends PropertyValue>(
    key: string,
    config: PropertyRegistration<T>
  ) => void
  getUIProperty: <T extends PropertyValue>(key: string) => T | undefined
  setUIProperty: <T extends PropertyValue>(key: string, value: T) => void
  getUIPropertySubject: <T extends PropertyValue>(
    key: string
  ) => BehaviorSubject<T> | undefined
  onUIPropertyChange: <T extends PropertyValue>(
    key: string,
    callback: (value: T) => void
  ) => () => void
}
