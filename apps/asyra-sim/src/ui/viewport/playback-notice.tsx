import { useWorkbenchValue } from '../shell/workbench-context'
import type { PlaybackFeedback } from '../experiments/playback-feedback'

const titles: Record<PlaybackFeedback['kind'], string> = {
  collision: 'Collision detected',
  clearance: 'Clearance warning',
  unresolved: 'Not fully checked',
  checking: 'Checking playback',
  clear: 'No issue in checked scope',
  error: 'Live check unavailable'
}

export function PlaybackNotice() {
  const feedback = useWorkbenchValue((state) => state.playback?.feedback)

  const matches = useWorkbenchValue(
    (state) => state.playback?.feedback?.checkedTime === state.playback?.time
  )

  if (!feedback) return null

  const warning =
    feedback.kind === 'collision' ||
    feedback.kind === 'clearance' ||
    feedback.kind === 'error'

  return (
    <aside
      data-testid="playback-feedback"
      data-kind={feedback.kind}
      data-pose-matches={matches}
      aria-live="polite"
      className={`absolute z-2 top-12 right-4 w-[310px] max-w-[calc(100%-32px)]
        rounded-lg border bg-sim-raised p-3 text-sim-text shadow-lg pointer-events-none max-[700px]:p-2
        ${warning ? 'border-[#ed9c55]' : 'border-sim-border'}`}
    >
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <strong
          className={feedback.kind === 'collision' ? 'text-[#ff625e]' : ''}
        >
          {titles[feedback.kind]}
        </strong>

        <span className="text-[9px] uppercase tracking-wide text-sim-muted">
          {feedback.origin === 'recorded' ? 'Recorded' : 'Live'}
        </span>
      </div>

      {feedback.checkedTime !== null && (
        <p className="mt-1 text-[11px] tabular-nums">
          Checked {feedback.checkedTime.toFixed(4)} s
          {!matches && ' - earlier pose'}
        </p>
      )}

      <div className="max-[700px]:hidden">
        <FeedbackDetails feedback={feedback} highlighted={matches && warning} />
      </div>

      <details className="hidden max-[700px]:block pointer-events-auto mt-1 text-[10px]">
        <summary className="cursor-pointer text-sim-muted">Details</summary>

        <FeedbackDetails feedback={feedback} highlighted={matches && warning} />
      </details>
    </aside>
  )
}

function FeedbackDetails({
  feedback,
  highlighted
}: {
  feedback: PlaybackFeedback
  highlighted: boolean
}) {
  return (
    <>
      {feedback.pairNames.slice(0, 2).map((name) => (
        <p key={name} className="mt-1 text-[10px] wrap-anywhere">
          {name}
        </p>
      ))}

      {feedback.pairNames.length > 2 && (
        <p className="text-[10px]">
          +{feedback.pairNames.length - 2} more pairs
        </p>
      )}

      <p className="mt-2 text-[10px] leading-relaxed text-sim-muted">
        {highlighted && feedback.bodyIds.length > 0
          ? 'Whole parts highlighted - not a precise contact region. '
          : ''}
        {feedback.message}
      </p>

      {!feedback.complete && feedback.kind !== 'checking' && (
        <p className="mt-1 text-[10px] text-sim-muted">
          Incomplete coverage - other contacts may be unobserved.
        </p>
      )}
    </>
  )
}
