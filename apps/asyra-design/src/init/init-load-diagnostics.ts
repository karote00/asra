import type { LoadValidationDiagnostic } from '@asyra/core'
import type { CoreRawData } from '@asyra/utils'
import core from '../contexts'

export interface LoadDiagnosticsReport {
  timestamp: number
  diagnostics: LoadValidationDiagnostic[]
  data: CoreRawData
}

export type LoadDiagnosticsSubscriber = (report: LoadDiagnosticsReport) => void

export interface LoadDiagnosticsInitOptions {
  logger?: (message: string) => void
}

const subscribers = new Set<LoadDiagnosticsSubscriber>()

let unregisterCoreHook: (() => void) | null = null

const defaultLogger = (message: string): void => {
  console.warn(message)
}

export const formatLoadDiagnostics = (
  diagnostics: LoadValidationDiagnostic[]
): string[] => {
  return diagnostics.map(
    ({ scope, path, message }) => `[load][${scope}] ${path}: ${message}`
  )
}

const reportDiagnostics = (
  report: LoadDiagnosticsReport,
  logger: (message: string) => void
): void => {
  if (subscribers.size === 0) {
    formatLoadDiagnostics(report.diagnostics).forEach((line) => {
      logger(line)
    })
    return
  }

  subscribers.forEach((subscriber) => {
    subscriber(report)
  })
}

export const initLoadDiagnostics = (
  options: LoadDiagnosticsInitOptions = {}
): void => {
  if (unregisterCoreHook) {
    return
  }

  const logger = options.logger ?? defaultLogger

  unregisterCoreHook = core.registerLoadDiagnosticsHook((diagnostics, data) => {
    const report: LoadDiagnosticsReport = {
      timestamp: Date.now(),
      diagnostics,
      data
    }

    reportDiagnostics(report, logger)
  })
}

export const subscribeLoadDiagnostics = (
  subscriber: LoadDiagnosticsSubscriber
): (() => void) => {
  subscribers.add(subscriber)

  return () => {
    subscribers.delete(subscriber)
  }
}

export const destroyLoadDiagnostics = (): void => {
  if (!unregisterCoreHook) {
    return
  }

  unregisterCoreHook()
  unregisterCoreHook = null
  subscribers.clear()
}
