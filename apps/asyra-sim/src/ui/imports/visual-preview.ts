import type { Workcell } from '../../domain/workcell'
import type { PreparedVisualImport } from '../../storage/visual-archive'

export interface VisualPreview {
  workcell: Workcell
  prepared: PreparedVisualImport
}
