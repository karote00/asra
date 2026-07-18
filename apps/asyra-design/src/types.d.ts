import core from '../contexts'
import { elementApis } from './common-apis/element'
import { strokeApis } from './common-apis/strokes'
import type { CanvasPipelineDebugger } from '@asyra/core/canvas-pipeline-debugger'

// For local debug
declare global {
  interface Window {
    __Core__: core
    __AsyraCanvasPipelineDebugger__?: CanvasPipelineDebugger
    __AsyraE2E__?: {
      elementApis: typeof elementApis
      strokeApis: typeof strokeApis
    }
  }
}
