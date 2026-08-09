import type { SharedPublication } from '@asyra/factory'
import type { DocumentLoadSource } from '@asyra/persistence'
import type { CanonicalChange } from './canonical-changes.js'

export interface ApplyRemoteCanonicalChangeSlicesInput {
  readonly origin: SharedPublication['origin']
  readonly slices: readonly (readonly CanonicalChange[])[]
}

export interface CoreCollaborationBridge {
  applyRemoteCanonicalChangeSlices(
    input: ApplyRemoteCanonicalChangeSlicesInput
  ): Promise<void>
  load(data: unknown): void
  subscribeToSharedPublication(
    subscriber: (publication: SharedPublication) => void
  ): () => void
}

export interface CoreCollaborationPreparation {
  readonly loadSource?: DocumentLoadSource
}

export interface CoreCollaborationSession {
  prepare(
    bridge: CoreCollaborationBridge
  ):
    | CoreCollaborationPreparation
    | undefined
    | Promise<CoreCollaborationPreparation | undefined>
  activate(): void | Promise<void>
  dispose(): void | Promise<void>
}
