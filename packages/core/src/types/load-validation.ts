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

/**
 * Observes detached validation diagnostics and detached post-apply load
 * evidence. It includes applied managed-system serialization and validated
 * package apply inputs. The data is not a canonical state artifact or state owner.
 */
export type LoadDiagnosticsHook = (
  diagnostics: LoadValidationDiagnostic[],
  data: CoreRawData
) => void
