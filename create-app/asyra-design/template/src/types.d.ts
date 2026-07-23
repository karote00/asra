import core from '../contexts'
import { elementApis } from './common-apis/element'
import { hierarchyApis } from './common-apis/hierarchy'
import { strokeApis } from './common-apis/strokes'
import type { CanvasPipelineDebugger } from '@asyra/core/canvas-pipeline-debugger'
import type { ProviderStatus } from '@asyra/collaboration'

// For local debug
declare global {
  interface Window {
    __Core__: core
    __AsyraCanvasPipelineDebugger__?: CanvasPipelineDebugger
    __AsyraE2E__?: {
      elementApis: typeof elementApis
      hierarchyApis: typeof hierarchyApis
      strokeApis: typeof strokeApis
    }
    __AsyraCollaboration__?: {
      identity: Readonly<{
        documentId: string
        roomId: string
        actorId: string
      }>
      getStatus(): ProviderStatus
      disconnect(): Promise<void>
      reconnect(): Promise<void>
      whenIdle(): Promise<void>
      dispose(): Promise<void>
    }
  }
}
