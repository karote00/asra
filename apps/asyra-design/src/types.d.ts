import core from '../contexts'

// For local debug
declare global {
  interface Window {
    __Core__: core
  }
}
