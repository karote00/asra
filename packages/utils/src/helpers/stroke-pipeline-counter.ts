export type StrokePipelineCounterSink = (
  counterName: string,
  value: number
) => void

export const emitStrokePipelineCounter = (
  counterName: string,
  value = 1
): void => {
  ;(
    globalThis as typeof globalThis & {
      __asyraStrokePipelineCounterSink?: StrokePipelineCounterSink
    }
  ).__asyraStrokePipelineCounterSink?.(counterName, value)
}
