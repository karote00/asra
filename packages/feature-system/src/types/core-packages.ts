import type { SystemContextSnapshot } from '@asyra/utils'
import type { RawInputEvent } from '@asyra/utils'

/** Minimal input system interface - on(event, callback) */
export interface InputSystemLike {
  on?(
    event: string,
    callback: (raw: RawInputEvent) => void | Promise<void>
  ): unknown
}

/** Minimal system context interface - getSystemContextSnapshot() */
export interface SystemContextLike {
  getSystemContextSnapshot?(): SystemContextSnapshot
}

/** Core packages passed to feature-system via setCorePackages */
export interface CorePackages {
  inputSystem?: InputSystemLike
  systemContext?: SystemContextLike
  interactionCore?: unknown
  core?: unknown
}
