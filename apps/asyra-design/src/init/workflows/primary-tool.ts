import type { Workflow } from '@asyra/core/types'

export const switchPrimaryToolWorkflow: Workflow = {
  // No context update needed for switch primary tool shortcut
  contextUpdate:
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    () => {},
  coreAPI: 'executeAction',
  APIArgs: (core, raw) => ['input.shortcut.switchPrimaryTool', raw.detail]
}
