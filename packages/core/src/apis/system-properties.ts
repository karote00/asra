import systemContext from '@asyra/system-context'

export const createSystemPropertyAPIs = () => ({
  registerSystemProperty: <T>(key: string, defaultValue: T) => {
    return systemContext.registerProperty<T>(key, defaultValue)
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
