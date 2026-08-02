export type DiagnosticCounterSink = (counterName: string, value: number) => void

const diagnosticCounterSinks = new Set<DiagnosticCounterSink>()

export const subscribeToDiagnosticCounters = (
  sink: DiagnosticCounterSink
): (() => void) => {
  diagnosticCounterSinks.add(sink)
  return () => diagnosticCounterSinks.delete(sink)
}

export const emitDiagnosticCounter = (counterName: string, value = 1): void => {
  for (const sink of diagnosticCounterSinks) {
    try {
      sink(counterName, value)
    } catch {
      // Diagnostic observers cannot alter the product flow they measure.
    }
  }
}
