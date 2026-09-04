import type { SimRuntime } from './bootstrap'
import { encodeProject, type ProjectSnapshot } from '../storage/project-format'
import type { VisualAssetArchive } from '../storage/visual-archive'
import { prepareProjectVisuals } from '../storage/project-visuals'

export interface RuntimeState {
  readonly status:
    'idle' | 'starting' | 'ready' | 'replacing' | 'failed' | 'closed'
  readonly runtime: SimRuntime | null
  readonly generation: number
  readonly error: string
  readonly recoveryAvailable: boolean
}

/** Owns App lifetimes, not canonical data or persistence acknowledgement. */
export class RuntimeController {
  private state: RuntimeState = Object.freeze({
    status: 'idle',
    runtime: null,
    generation: 0,
    error: '',
    recoveryAvailable: false
  })
  private owned: SimRuntime | null = null
  private recovery: ProjectSnapshot | null = null
  private operation: Promise<unknown> | null = null
  private closing: Promise<void> | undefined
  private preparation: AbortController | null = null
  private closed = false
  private listeners = new Set<() => void>()

  constructor(
    private readonly create: (
      snapshot?: ProjectSnapshot,
      prepared?: VisualAssetArchive
    ) => Promise<SimRuntime>,
    private readonly prepareVisuals: (
      snapshot: ProjectSnapshot,
      signal: AbortSignal
    ) => Promise<VisualAssetArchive> = (snapshot, signal) =>
      prepareProjectVisuals(snapshot, undefined, signal)
  ) {}

  getState = (): RuntimeState => this.state
  getRecovery = (): ProjectSnapshot | null =>
    this.closed ? null : structuredClone(this.recovery)
  subscribe = (listener: () => void): (() => void) => {
    this.assertOpen()
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publish(patch: Partial<RuntimeState>): void {
    if (this.closed) return
    this.state = Object.freeze({ ...this.state, ...patch })
    this.listeners.forEach((listener) => listener())
  }
  private assertOpen(): void {
    if (this.closed) throw new Error('Runtime controller is closed')
  }
  private requireReady(): SimRuntime {
    this.assertOpen()
    if (this.state.status !== 'ready' || !this.owned)
      throw new Error('No editable runtime is ready')
    return this.owned
  }
  private run<T>(action: () => Promise<T>): Promise<T> {
    if (this.closed)
      return Promise.reject(new Error('Runtime controller is closed'))
    if (this.operation)
      return Promise.reject(
        new Error('Another runtime operation is still running')
      )
    const operation = Promise.resolve().then(action)
    this.operation = operation
    return operation.finally(() => {
      this.operation = null
    })
  }

  start(): Promise<void> {
    return this.run(async () => {
      this.assertOpen()
      if (this.state.status !== 'idle')
        throw new Error('Runtime controller already started')
      this.publish({ status: 'starting', error: '' })
      try {
        this.owned = await this.create()
        this.assertOpen()
        this.activate(this.owned)
      } catch (error) {
        this.publish({ status: 'failed', runtime: null, error: message(error) })
        throw error
      }
    })
  }

  private activate(runtime: SimRuntime): void {
    this.recovery = null
    this.publish({
      status: 'ready',
      runtime,
      generation: this.state.generation + 1,
      recoveryAvailable: false,
      error: ''
    })
  }

  async capture(): Promise<ProjectSnapshot> {
    if (this.operation)
      throw new Error('Another runtime operation is still running')
    const runtime = this.requireReady()
    const captured = await runtime.captureSnapshot()
    if (this.requireReady() !== runtime)
      throw new Error('Runtime changed during capture')
    return captured
  }

  replace(snapshot: ProjectSnapshot, assertCurrent: () => void) {
    // Detach synchronously: callers cannot change B while this operation awaits A.
    const target = structuredClone(snapshot)
    return this.run(async () => {
      const previous = this.requireReady()
      assertCurrent()
      encodeProject(target)
      previous.preflight(target.document)
      let retired = false,
        successor: SimRuntime | undefined,
        prepared: VisualAssetArchive | undefined,
        resume: (() => void) | undefined
      const preparation = new AbortController()
      this.preparation = preparation
      try {
        prepared = await this.prepareVisuals(target, preparation.signal)
        this.assertOpen()
        assertCurrent()
        resume = previous.pauseEditing()
        this.publish({ status: 'replacing', error: '' })
        const recovery = await previous.captureSnapshot()
        this.assertOpen()
        assertCurrent()
        const detached = structuredClone(recovery)
        encodeProject(detached)
        this.recovery = detached
        retired = true
        this.publish({ runtime: null })
        await previous.dispose()
        this.owned = null
        this.assertOpen()
        assertCurrent()
        successor = await this.create(target, prepared)
        // A successful successor owns the prepared archive through its teardown.
        prepared = undefined
        this.owned = successor
        this.assertOpen()
        assertCurrent()
        const issues = successor.getLoadIssues()
        this.activate(successor)
        return issues
      } catch (error) {
        let failure = error
        if (!retired) {
          if (!this.closed) resume?.()
          this.publish({
            status: 'ready',
            runtime: previous,
            error: message(error)
          })
        } else {
          if (successor) {
            this.owned = null
            try {
              await successor.dispose()
            } catch (cleanupError) {
              failure = new AggregateError(
                [error, cleanupError],
                'Replacement and successor cleanup failed'
              )
            }
          }
          this.publish({
            status: 'failed',
            runtime: null,
            error: message(failure),
            recoveryAvailable: this.recovery !== null
          })
        }
        throw failure
      } finally {
        this.preparation = null
        prepared?.dispose()
      }
    })
  }

  dispose(): Promise<void> {
    if (this.closing) return this.closing
    this.closed = true
    this.preparation?.abort()
    const pending = this.operation
    this.state = Object.freeze({
      ...this.state,
      status: 'closed',
      runtime: null,
      recoveryAvailable: false
    })
    this.listeners.clear()
    this.closing = Promise.resolve().then(async () => {
      // A failed operation must not prevent disposal of a runtime it acquired.
      await pending?.catch(() => undefined)
      const owned = this.owned
      this.owned = null
      this.recovery = null
      await owned?.dispose()
    })
    return this.closing
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
