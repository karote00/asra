export type DiagnosticCounterSink = (counterName: string, value: number) => void

export const emitDiagnosticCounter = (counterName: string, value = 1): void => {
  ;(
    globalThis as typeof globalThis & {
      __asyraDiagnosticCounterSink?: DiagnosticCounterSink
    }
  ).__asyraDiagnosticCounterSink?.(counterName, value)
}
