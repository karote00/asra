import Core from '@asyra/core'

// For local debug
declare global {
  interface Window {
    __Core__: Core
  }
}
