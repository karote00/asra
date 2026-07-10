import core from '../contexts'
import { elementApis } from './common-apis/element'
import { strokeApis } from './common-apis/strokes'

// For local debug
declare global {
  interface Window {
    __Core__: core
    __AsyraE2E__?: {
      elementApis: typeof elementApis
      strokeApis: typeof strokeApis
    }
  }
}
