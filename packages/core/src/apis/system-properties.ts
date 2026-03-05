import systemContext from '@asyra/system-context'

export const createSystemPropertyAPIs = () => ({
  defineSystemProperty: <T>(
    key: string,
    defaultValue: T,
    options?: {
      runtime?: boolean
      silent?: boolean
      validate?: (value: unknown) => value is T
    }
  ) => {
    return systemContext.registerProperty<T>(key, defaultValue, options)
  },

  registerSystemProperty: <T>(
    key: string,
    defaultValue: T,
    options?: {
      runtime?: boolean
      silent?: boolean
      validate?: (value: unknown) => value is T
    }
  ) => {
    return systemContext.registerProperty<T>(key, defaultValue, options)
  },

  getSystemProperty: <T>(key: string) => {
    return systemContext.getManagedProperty<T>(key)
  },

  setSystemProperty: <T>(key: string, value: T) => {
    systemContext.setManagedProperty<T>(key, value)
  },

  getSystemPropertyObservable: <T>(key: string) => {
    return systemContext.getManagedPropertyObservable<T>(key)
  }
})
