import type { CoreRawData, LoadDiagnostic } from '@asyra/utils'

export type LoadValidationScope =
  'core' | 'props-manager' | 'scene-tree' | 'system-context'

export interface LoadValidationDiagnostic extends LoadDiagnostic {
  scope: LoadValidationScope
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
