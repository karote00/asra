export type StrokeDiagnosticsMode = 'off' | 'summary' | 'full'

interface StrokeDiagnosticsGlobal {
  __ASYRA_STROKE_DIAGNOSTICS_MODE__?: StrokeDiagnosticsMode
}

const isStrokeDiagnosticsMode = (
  value: unknown
): value is StrokeDiagnosticsMode =>
  value === 'off' || value === 'summary' || value === 'full'

export const getStrokeDiagnosticsMode = (): StrokeDiagnosticsMode => {
  const configured = (globalThis as StrokeDiagnosticsGlobal)
    .__ASYRA_STROKE_DIAGNOSTICS_MODE__
  return isStrokeDiagnosticsMode(configured) ? configured : 'off'
}

export const shouldEmitStrokeDiagnostics = () =>
  getStrokeDiagnosticsMode() !== 'off'

export const shouldEmitFullStrokeDiagnostics = () =>
  getStrokeDiagnosticsMode() === 'full'
