import type { Workflow, WorkflowRegistry } from '../types/workflow'

export class WorkflowRegistryClass {
  private workflows = new Map<string, Workflow>()

  register(name: string, workflow: Workflow): void {
    this.workflows.set(name, workflow)
  }

  get(name: string): Workflow | undefined {
    return this.workflows.get(name)
  }

  has(name: string): boolean {
    return this.workflows.has(name)
  }

  unregister(name: string): void {
    this.workflows.delete(name)
  }

  clear(): void {
    this.workflows.clear()
  }

  getWorkflows(): string[] {
    return Array.from(this.workflows.keys())
  }

  getAll(): WorkflowRegistry {
    const result: WorkflowRegistry = {}
    for (const [name, workflow] of this.workflows) {
      result[name] = workflow
    }
    return result
  }
}
