import { MouseState } from '../states/mouse-state'
import type { PrimaryToolState } from '../states/primary-tool'

export interface HandlerDeps {
  primaryToolState: PrimaryToolState
  mouseState: MouseState
}
