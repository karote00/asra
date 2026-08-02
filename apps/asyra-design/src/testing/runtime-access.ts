import { elementApis } from '../common-apis/element'
import { hierarchyApis } from '../common-apis/hierarchy'
import { strokeApis } from '../common-apis/strokes'
import {
  getActiveCollaborationHandle,
  type CollaborationDebugHandle
} from '../collaboration/lifecycle'
import core from '../contexts'
import {
  getActiveAiDrawingPerformanceProfile,
  type AiDrawingPerformanceProfile
} from '../init/performance/ai-drawing-performance-profile'
import {
  subscribeToBrowserDragPhases,
  subscribeToDiagnosticCounters
} from '@asyra/utils'

const testState = new Map<string, unknown>()
const testCaptureDisposers = new Map<string, () => void>()

export const testRuntimeState = Object.freeze({
  delete: (key: string): boolean => testState.delete(key),
  get: <T>(key: string): T | undefined => testState.get(key) as T | undefined,
  set: <T>(key: string, value: T): T => {
    testState.set(key, value)
    return value
  }
})

const startCapture = (
  key: string,
  subscribe: (append: (value: unknown) => void) => (() => void) | undefined
): void => {
  testCaptureDisposers.get(key)?.()
  const values: unknown[] = []
  testState.set(key, values)
  const dispose = subscribe((value) => values.push(value))
  if (dispose) testCaptureDisposers.set(key, dispose)
}

export const startSharedPublicationCapture = (key: string): void =>
  startCapture(key, (append) =>
    core.deps.factory.subscribeToSharedPublication(append)
  )

export const startSharedChannelCapture = (key: string, channel: string): void =>
  startCapture(key, (append) =>
    core.deps.factory.observeSharedDataChannel(channel, append)
  )

export const clearTestCapture = (key: string): void => {
  testState.set(key, [])
}

export const readTestCapture = (key: string): readonly unknown[] =>
  testRuntimeState.get<readonly unknown[]>(key) ?? []

export const stopTestCapture = (key: string): void => {
  testCaptureDisposers.get(key)?.()
  testCaptureDisposers.delete(key)
  testState.delete(key)
}

export const startSystemPropertyWriteCapture = (
  key: string,
  options: {
    readonly propertyName?: string
    readonly whileMouseDragging?: boolean
  } = {}
): void => {
  stopTestCapture(key)
  const writes: (readonly [string, unknown])[] = []
  testState.set(key, writes)
  const original = core.setSystemProperty
  const wrapper = ((...args: Parameters<typeof original>) => {
    const propertyName = String(args[0])
    if (
      (!options.propertyName || propertyName === options.propertyName) &&
      (!options.whileMouseDragging ||
        Boolean(core.getSystemProperty('mouseDragging')))
    ) {
      writes.push([propertyName, args[1]])
    }
    return original.apply(core, args)
  }) as typeof original
  core.setSystemProperty = wrapper
  testCaptureDisposers.set(key, () => {
    if (core.setSystemProperty === wrapper) {
      core.setSystemProperty = original
    }
  })
}

export {
  core,
  elementApis,
  hierarchyApis,
  strokeApis,
  subscribeToBrowserDragPhases,
  subscribeToDiagnosticCounters,
  getActiveAiDrawingPerformanceProfile,
  getActiveCollaborationHandle
}
export type { AiDrawingPerformanceProfile, CollaborationDebugHandle }
