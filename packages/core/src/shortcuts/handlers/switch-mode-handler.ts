import { ToolMode } from '@asra/utils'

interface SwitchModeHandlerDeps {
  setMode: (mode: ToolMode) => void
}

export class SiwtchModeHandler {
  constructor(private deps: SwitchModeHandlerDeps) {}

  init() {}
}
