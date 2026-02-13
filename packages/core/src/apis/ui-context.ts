import uiContext from '@asyra/ui-context'
import type { PropertyRegistration, PropertyValue } from '@asyra/ui-context'

export const createUIContextAPIs = () => ({
  registerUIProperty: <T extends PropertyValue>(
    key: string,
    config: PropertyRegistration<T>
  ) => {
    uiContext.registerProperty<T>(key, config)
  },

  getUIProperty: <T extends PropertyValue>(key: string) => {
    return uiContext.get<T>(key)
  },

  setUIProperty: <T extends PropertyValue>(key: string, value: T) => {
    uiContext.set<T>(key, value)
  },

  getUIPropertySubject: <T extends PropertyValue>(key: string) => {
    return uiContext.getSubject<T>(key)
  },

  onUIPropertyChange: <T extends PropertyValue>(
    key: string,
    callback: (value: T) => void
  ) => {
    return uiContext.onChange(key, callback)
  }
})
