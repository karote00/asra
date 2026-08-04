import type { RenderEngineCapability } from './types.js'

export class UnsupportedRenderEngineCapabilityError extends Error {
  readonly engineName: string
  readonly missingCapabilities: readonly RenderEngineCapability[]

  constructor(
    engineName: string,
    missingCapabilities: readonly RenderEngineCapability[]
  ) {
    super(
      `Render engine "${engineName}" does not support required capabilities: ${missingCapabilities.join(
        ', '
      )}`
    )
    this.name = 'UnsupportedRenderEngineCapabilityError'
    this.engineName = engineName
    this.missingCapabilities = [...missingCapabilities]
  }
}
