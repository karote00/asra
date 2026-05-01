import { useCallback } from 'react'
import { systemContextApis } from '../common-apis'
import { useStrokeDebugDisableVisualOverlapCollapse } from '../providers'

const shouldShowStrokeDebugToggle =
  import.meta.env.DEV ||
  import.meta.env.VITE_ASYRA_ENABLE_STROKE_DEBUG_UI === 'true'

const StrokeOverlapDebugIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2.25" y="5" width="6.75" height="6.75" rx="1" />
    <rect x="7" y="2.25" width="6.75" height="6.75" rx="1" opacity="0.72" />
    <path d="M3 13L13 3" opacity="0.9" />
  </svg>
)

const StrokeDebugToggle = () => {
  const disabled = useStrokeDebugDisableVisualOverlapCollapse()

  if (!shouldShowStrokeDebugToggle) {
    return null
  }

  const handleToggle = useCallback(() => {
    systemContextApis.setStrokeDebugDisableVisualOverlapCollapse(!disabled)
  }, [disabled])

  return (
    <button
      type="button"
      className={`tool-btn ${disabled ? 'active' : ''}`}
      onClick={handleToggle}
      data-testid="stroke-debug-overlap-toggle"
      data-active={disabled}
      title={
        disabled
          ? 'Debug: raw stroke overlap faces are visible'
          : 'Debug: visual overlap collapse is enabled'
      }
      aria-label={
        disabled
          ? 'Disable raw stroke overlap debug view'
          : 'Enable raw stroke overlap debug view'
      }
      aria-pressed={disabled}
    >
      <StrokeOverlapDebugIcon />
    </button>
  )
}

export default StrokeDebugToggle
