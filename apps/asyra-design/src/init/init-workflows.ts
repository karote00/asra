import { workflowRegistry } from '@asyra/core'
import { registerWorkflows } from './workflows'

export const initWorkflows = (): void => {
  registerWorkflows(workflowRegistry)
}
