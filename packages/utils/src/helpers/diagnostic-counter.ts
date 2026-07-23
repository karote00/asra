export type DiagnosticCounterSink = (counterName: string, value: number) => void

export const emitDiagnosticCounter = (counterName: string, value = 1): void => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraDiagnosticCounterSink?: DiagnosticCounterSink
    }
  ).__asyraDiagnosticCounterSink
  if (!sink) return

  try {
    sink(counterName, value)
  } catch {
    // Diagnostic observers cannot alter the product flow they measure.
  }
}
