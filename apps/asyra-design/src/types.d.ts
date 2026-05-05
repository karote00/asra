import core from '../contexts'
import { elementApis } from './common-apis/element'

// For local debug
declare global {
  interface Window {
    __Core__: core
    __AsyraE2E__?: {
      elementApis: typeof elementApis
    }
  }
}
