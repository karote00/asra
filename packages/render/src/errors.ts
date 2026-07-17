export const RenderErrorCodes = Object.freeze({
  MISSING_ENGINE_PROVIDER: 'MISSING_ENGINE_PROVIDER',
  INVALID_ENGINE_PROVIDER_RESULT: 'INVALID_ENGINE_PROVIDER_RESULT'
} as const)

export type RenderErrorCode =
  (typeof RenderErrorCodes)[keyof typeof RenderErrorCodes]

export class MissingRenderEngineProviderError extends Error {
  readonly code = RenderErrorCodes.MISSING_ENGINE_PROVIDER

  constructor() {
    super('Render engine provider is not configured')
    this.name = 'MissingRenderEngineProviderError'
  }
}

export class InvalidRenderEngineProviderResultError extends Error {
  readonly code = RenderErrorCodes.INVALID_ENGINE_PROVIDER_RESULT

  constructor() {
    super('Render engine provider did not return an engine')
    this.name = 'InvalidRenderEngineProviderResultError'
  }
}
