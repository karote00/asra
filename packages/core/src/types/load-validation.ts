import type { CoreRawData } from '@asyra/utils'

export type LoadValidationScope =
  | 'core'
  | 'props-manager'
  | 'scene-tree'
  | 'system-context'

export interface LoadValidationDiagnostic {
  scope: LoadValidationScope
  path: string
  message: string
}

export type LoadDiagnosticsHook = (
  diagnostics: LoadValidationDiagnostic[],
  data: CoreRawData
) => void
