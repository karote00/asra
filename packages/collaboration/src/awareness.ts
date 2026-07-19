export class AwarenessRuntime {
  private disposed = false

  dispose(): void {
    this.disposed = true
  }

  isDisposed(): boolean {
    return this.disposed
  }
}
