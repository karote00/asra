import * as Y from 'yjs'
import type {
  CollaborationComposition,
  CollaborationInstanceCompositionInput,
  CollaborationLifecycleResource,
  CollaborationPermissionPolicy
} from './types'
import { AwarenessRuntime } from './awareness'

export class CollaborationDisposalError extends Error {
  readonly failures: readonly unknown[]

  constructor(failures: readonly unknown[]) {
    super(`Collaboration disposal failed in ${failures.length} cleanup(s)`)
    this.name = 'CollaborationDisposalError'
    this.failures = Object.freeze([...failures])
  }
}

type InstanceComposition<TOperationDefinition> = CollaborationComposition<
  TOperationDefinition,
  CollaborationPermissionPolicy,
  CollaborationLifecycleResource,
  Y.Doc,
  CollaborationLifecycleResource,
  CollaborationLifecycleResource
>

const callLifecycle = async (
  resource: CollaborationLifecycleResource | undefined
): Promise<void> => {
  if (!resource) return
  if (typeof resource.destroy === 'function') {
    await resource.destroy()
    return
  }
  if (typeof resource.dispose === 'function') {
    await resource.dispose()
  }
}

export class CollaborationInstance<TOperationDefinition = unknown> {
  readonly identity: Readonly<{
    documentId: string
    roomId: string
    actorId: string
  }>
  readonly factory: InstanceComposition<TOperationDefinition>['factory']
  readonly yDoc: Y.Doc
  readonly provider?: CollaborationLifecycleResource
  readonly awareness: CollaborationLifecycleResource
  readonly persistence?: CollaborationLifecycleResource
  readonly operationDefinitions: readonly TOperationDefinition[]
  readonly permissionPolicy: CollaborationPermissionPolicy

  private readonly composition: InstanceComposition<TOperationDefinition>
  private readonly disposers: Array<() => void | Promise<void>> = []
  private disposed = false
  private disposePromise: Promise<void> | null = null

  constructor(composition: InstanceComposition<TOperationDefinition>) {
    if (composition.yDoc !== undefined && !(composition.yDoc instanceof Y.Doc)) {
      throw new Error('[collaboration] yDoc must be a Y.Doc')
    }
    this.composition = composition
    this.identity = Object.freeze({
      documentId: composition.documentId,
      roomId: composition.roomId,
      actorId: composition.actorId
    })
    this.factory = composition.factory
    this.yDoc = composition.yDoc ?? new Y.Doc()
    this.provider = composition.provider
    this.awareness = composition.awareness ?? new AwarenessRuntime()
    this.persistence = composition.persistence
    this.operationDefinitions = composition.operationDefinitions
    this.permissionPolicy = composition.permissionPolicy
  }

  ownDisposer(disposer: () => void | Promise<void>): () => void {
    if (this.disposed) {
      throw new Error('[collaboration] instance is disposed')
    }
    this.disposers.push(disposer)
    return disposer
  }

  isDisposed(): boolean {
    return this.disposed
  }

  dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise
    this.disposed = true
    this.disposePromise = this.disposeOwnedResources()
    return this.disposePromise
  }

  private async disposeOwnedResources(): Promise<void> {
    const failures: unknown[] = []
    const attempt = async (cleanup: () => void | Promise<void>) => {
      try {
        await cleanup()
      } catch (error) {
        failures.push(error)
      }
    }

    for (const disposer of [...this.disposers].reverse()) {
      await attempt(disposer)
    }
    this.disposers.length = 0

    if (this.composition.resourceOwnership.provider === 'owned') {
      await attempt(() => callLifecycle(this.provider))
    }
    if (this.composition.resourceOwnership.persistence === 'owned') {
      await attempt(() => callLifecycle(this.persistence))
    }
    if (this.composition.resourceOwnership.awareness === 'owned') {
      await attempt(() => callLifecycle(this.awareness))
    }
    if (this.composition.resourceOwnership.yDoc === 'owned') {
      await attempt(() => this.yDoc.destroy())
    }

    if (failures.length > 0) {
      throw new CollaborationDisposalError(failures)
    }
  }
}

export const createCollaboration = <TOperationDefinition = unknown>(
  input: CollaborationInstanceCompositionInput<TOperationDefinition>,
  defineComposition: (
    input: CollaborationInstanceCompositionInput<TOperationDefinition>
  ) => InstanceComposition<TOperationDefinition>
): CollaborationInstance<TOperationDefinition> =>
  new CollaborationInstance(defineComposition(input))
