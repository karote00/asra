import React, { useSyncExternalStore } from 'react'
import { PresetSystemPropertyKeys } from '@asyra/preset'
import type { PositionData } from '@asyra/utils'
import type { AiDrawingProgressState } from '../common-apis/system-context'
import { SystemPropertyKeys } from '../constants'
import core from '../contexts'

const EMPTY_VIEWPORT_POSITION = Object.freeze({ x: 0, y: 0 })

const useSystemProperty = <T,>(key: string, fallback: T): T => {
  const getSnapshot = () =>
    core.getSystemPropertyObservable<T>(key)?.getValue() ?? fallback

  return useSyncExternalStore(
    (onStoreChange) => {
      const subject = core.getSystemPropertyObservable<T>(key)
      if (!subject) {
        return () => undefined
      }

      const subscription = subject.subscribe(() => onStoreChange())
      return () => subscription.unsubscribe()
    },
    getSnapshot,
    getSnapshot
  )
}

const AiDrawingProgressIndicator: React.FC = () => {
  const progress = useSystemProperty<AiDrawingProgressState | null>(
    SystemPropertyKeys.AI_DRAWING_PROGRESS,
    null
  )
  const viewportPosition = useSystemProperty<PositionData>(
    PresetSystemPropertyKeys.VIEWPORT_POSITION,
    EMPTY_VIEWPORT_POSITION
  )
  const zoom = useSystemProperty<number>(PresetSystemPropertyKeys.ZOOM, 1)

  if (!progress) {
    return null
  }

  const left = progress.bounds.x * zoom + viewportPosition.x
  const top = progress.bounds.y * zoom + viewportPosition.y
  const width = progress.bounds.width * zoom
  const height = progress.bounds.height * zoom
  if (
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null
  }

  const preparing = progress.phase === 'preparing'
  const label = preparing
    ? 'Preparing drawing'
    : `Drawing ${progress.completedElements} of ${progress.totalElements}`
  const progressRatio =
    progress.totalElements === 0
      ? 0
      : progress.completedElements / progress.totalElements

  return (
    <div
      aria-busy="true"
      aria-label={label}
      className={`pointer-events-none absolute z-10 overflow-hidden rounded-sm border border-violet-500 ${
        preparing ? 'bg-slate-900/30' : 'bg-transparent'
      }`}
      data-phase={progress.phase}
      data-testid="ai-drawing-progress-indicator"
      role="status"
      style={{ height, left, top, width }}
    >
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-violet-100 shadow-lg">
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-300 border-t-transparent motion-reduce:animate-none"
          data-testid="ai-drawing-progress-spinner"
        />
        <span>{label}</span>
      </div>
      {!preparing ? (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1 bg-slate-600"
        >
          <div
            className="h-full bg-violet-500"
            style={{
              width: `${Math.max(0, Math.min(1, progressRatio)) * 100}%`
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

export default AiDrawingProgressIndicator
