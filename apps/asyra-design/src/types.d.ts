import core from '../contexts'
import type { CanvasPipelineDebugger } from '@asyra/core/canvas-pipeline-debugger'
import type { CollaborationDebugHandle } from './collaboration/lifecycle'
import type { AiDrawingPerformanceProfile } from './init/performance/ai-drawing-performance-profile'

// For local debug
declare global {
  interface Window {
    __Core__: core
    __CanvasPipelineDebugger__?: CanvasPipelineDebugger
    __Collaboration__?: CollaborationDebugHandle
    __AiDrawingPerformance__?: AiDrawingPerformanceProfile
  }
}
