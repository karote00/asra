import type { ModelLoadIssue } from '../common-apis/document'
import {
  decodeProject,
  encodeProject,
  type ProjectRepository,
  type ProjectSnapshot,
  type ProjectSummary
} from './project-format'

export interface DocumentPorts {
  capture(): Promise<ProjectSnapshot>
  apply(
    snapshot: ProjectSnapshot,
    assertCurrent: () => void
  ): Promise<readonly ModelLoadIssue[]>
}
export interface PersistenceState {
  project: Readonly<ProjectSummary> | null
  status: 'unsaved' | 'saving' | 'saved' | 'error'
  busy: 'save' | 'open' | null
  dirty: boolean
  error: string
}

/** Persistence acknowledgement only; the canonical document stays behind ports. */
export class ProjectSession {
  private state: PersistenceState = Object.freeze({
    project: null,
    status: 'unsaved',
    busy: null,
    dirty: true,
    error: ''
  })
  private revision = 0
  private disposed = false
  private lifetime = new AbortController()
  private listeners = new Set<() => void>()
  constructor(
    private readonly repository: ProjectRepository,
    private readonly document: DocumentPorts
  ) {}

  getState = (): PersistenceState => this.state
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  private publish(patch: Partial<PersistenceState>): void {
    if (this.disposed) return
    this.state = Object.freeze({ ...this.state, ...patch })
    this.listeners.forEach((listener) => listener())
  }
  markEdited(): void {
    if (this.disposed) return
    this.revision++
    this.publish({
      dirty: true,
      status: this.state.busy === 'save' ? 'saving' : 'unsaved',
      error: ''
    })
  }
  private assertLive(): void {
    if (this.disposed) throw new Error('Project session is closed')
    this.lifetime.signal.throwIfAborted()
  }
  private start(busy: 'save' | 'open'): number {
    this.assertLive()
    if (this.state.busy)
      throw new Error('Another save or open operation is still running')
    this.publish({
      busy,
      error: '',
      ...(busy === 'save' ? { status: 'saving' } : {})
    })
    return this.revision
  }
  private fail(error: unknown): never {
    this.publish({
      busy: null,
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }

  async save(name: string, newProject = false): Promise<void> {
    name = name.trim()
    if (!name || name.length > 200)
      throw new Error('Project name must contain 1–200 characters')
    const revision = this.start('save'),
      previous = newProject ? null : this.state.project
    try {
      const snapshot = await this.document.capture()
      this.assertLive()
      const metadata: ProjectSummary = {
        id: previous?.id ?? crypto.randomUUID(),
        name,
        revision: crypto.randomUUID(),
        savedAt: new Date().toISOString()
      }
      await this.repository.write(
        { ...metadata, payload: encodeProject(snapshot) },
        previous?.revision ?? null,
        this.lifetime.signal
      )
      this.assertLive()
      const dirty = this.revision !== revision
      this.publish({
        project: Object.freeze(metadata),
        status: dirty ? 'unsaved' : 'saved',
        dirty,
        busy: null,
        error: ''
      })
    } catch (error) {
      this.fail(error)
    }
  }

  async open(id: string, replacementAccepted: boolean): Promise<void> {
    if (!replacementAccepted)
      throw new Error('Opening requires explicit replacement acceptance')
    const revision = this.start('open')
    const assertCurrent = () => {
      this.assertLive()
      if (revision !== this.revision)
        throw new Error(
          'The model changed while opening; retry without editing or save the changes first'
        )
    }
    try {
      const stored = await this.repository.read(id, this.lifetime.signal)
      assertCurrent()
      const snapshot = decodeProject(stored.payload)
      const issues = await this.document.apply(snapshot, assertCurrent)
      this.assertLive()
      const { payload: _payload, ...metadata } = stored
      const dirty = this.revision !== revision || issues.length > 0
      this.publish({
        project: Object.freeze(metadata),
        status: dirty ? 'unsaved' : 'saved',
        dirty,
        busy: null,
        error: ''
      })
    } catch (error) {
      this.fail(error)
    }
  }

  list() {
    this.assertLive()
    return this.repository.list(this.lifetime.signal)
  }
  close(): void {
    if (this.disposed) return
    this.disposed = true
    this.lifetime.abort()
    this.listeners.clear()
    this.repository.close()
  }
}
