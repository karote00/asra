import Core from '@asra/core'

// For local debug
declare global {
  interface Window {
    __Core__: Core
  }
}
