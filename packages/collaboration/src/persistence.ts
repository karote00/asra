import type { YjsBinaryUpdate } from './yjs-document'

export interface PersistedUpdate extends YjsBinaryUpdate {
  readonly documentId: string
}

export interface UpdatePersistence {
  append(update: PersistedUpdate): Promise<void>
  load(documentId: string): Promise<readonly PersistedUpdate[]>
  dispose?(): void | Promise<void>
}

export interface MemoryPersistenceOptions {
  readonly appendFailure?: unknown
  readonly loadFailure?: unknown
}

const cloneUpdate = (update: PersistedUpdate): PersistedUpdate =>
  Object.freeze({
    documentId: update.documentId,
    operationId: update.operationId,
    update: update.update.slice()
  })

export class MemoryPersistence implements UpdatePersistence {
  private readonly updates = new Map<string, PersistedUpdate[]>()
  private disposed = false

  constructor(private readonly options: MemoryPersistenceOptions = {}) {}

  async append(update: PersistedUpdate): Promise<void> {
    this.requireUsable()
    if (this.options.appendFailure !== undefined) {
      throw this.options.appendFailure
    }
    const records = this.updates.get(update.documentId) ?? []
    records.push(cloneUpdate(update))
    this.updates.set(update.documentId, records)
  }

  async load(documentId: string): Promise<readonly PersistedUpdate[]> {
    this.requireUsable()
    if (this.options.loadFailure !== undefined) throw this.options.loadFailure
    return Object.freeze((this.updates.get(documentId) ?? []).map(cloneUpdate))
  }

  dispose(): void {
    this.disposed = true
    this.updates.clear()
  }

  private requireUsable(): void {
    if (this.disposed) {
      throw new Error('[collaboration] update persistence is disposed')
    }
  }
}
