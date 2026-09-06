import { useEffect, useRef } from 'react'
import { LivePreview, type LiveSampleOptions } from './live-preview'
import { useCommittedCallback } from '../shared/use-committed-callback'
import { useExperimentView } from './experiment-context'
import { RecordedPlaybackEvidence } from './recorded-playback-evidence'
import { isPresentedRunStale } from '../results/run-freshness'

export function useLivePreview(active: boolean, identity: string) {
  const view = useExperimentView()
  const current = useRef<LivePreview | null>(null)
  const settled = useRef(Promise.resolve())

  const suspend = useCommittedCallback(() => {
    const previous = current.current

    current.current = null
    previous?.dispose()

    if (previous) settled.current = previous.completion
  })

  useEffect(() => {
    if (!active) suspend()

    return suspend
  }, [active, identity, suspend])

  const sample = useCommittedCallback(
    (time: number, options: LiveSampleOptions) => {
      if (!active) return

      const state = view.getSnapshot()

      if (!state.canonical) return

      if (!current.current) {
        const run = state.selectedRun

        let recorded: RecordedPlaybackEvidence | undefined

        if (
          run &&
          state.canonicalDraft &&
          !isPresentedRunStale(run, state.workcell, state.canonicalDraft)
        ) {
          recorded = new RecordedPlaybackEvidence(run)
        }

        current.current = new LivePreview(
          state.workcell,
          state.canonical.definition.trajectory,
          state.canonical.definition.interval,
          () =>
            state.runtime.features.live.prepare(identity, () =>
              state.runtime.createExperimentSnapshot(
                state.experimentId,
                state.warnings
              )
            ),
          state.runtime.features.live,
          state.onPlayback,
          settled.current,
          recorded
        )
      }

      current.current.sample(time, options)
    }
  )

  const reset = useCommittedCallback(() => {
    suspend()
    view.getSnapshot().onPlayback(null)
  })

  return { sample, suspend, reset }
}
