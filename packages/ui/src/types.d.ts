import Core from '@asra/core'
import Factory from '@asra/factory'

// For local debug
declare global {
  interface Window {
    __Core__: Core
    __Factory__: Factory
  }
}
