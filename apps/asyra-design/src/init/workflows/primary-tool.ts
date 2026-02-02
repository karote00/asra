import type { Workflow } from '@asyra/core'
import type { RawInputEvent } from '@asyra/utils'
import { InputSystemEvents } from '../../constants'

export const switchPrimaryToolWorkflow: Workflow = {
  // No context update needed for switch primary tool shortcut
  contextUpdate:
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    () => { },
  coreAPI: 'executeAction',
  APIArgs: (core, raw: RawInputEvent) => [
    InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
    raw.detail
  ]
}
