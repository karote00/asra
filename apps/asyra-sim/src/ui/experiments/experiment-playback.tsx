import { useExperimentField, useExperimentView } from './experiment-context'
import { PlaybackControls } from '../viewport/playback-controls'
import { useCommittedCallback } from '../shared/use-committed-callback'

export function ExperimentPlayback() {
  const view = useExperimentView()

  const canonical = useExperimentField('canonical')

  const dirty = useExperimentField('dirty')

  const experimentId = useExperimentField('experimentId')

  const canonicalKey = useExperimentField('canonicalKey')

  const revision = useExperimentField('revision')

  const previewActive = useExperimentField('previewActive')

  const running = useExperimentField('running')

  const onSample = useCommittedCallback((time: number) =>
    view.getSnapshot().replayCurrent(time)
  )

  const onReset = useCommittedCallback(() =>
    view.getSnapshot().onPlayback(null)
  )

  return (
    <>
      {canonical && !dirty && (
        <PlaybackControls
          key={`${experimentId}:${canonicalKey}:${revision}`}
          interval={canonical.definition.interval}
          active={(previewActive ?? true) && !running}
          onSample={onSample}
          onReset={onReset}
        />
      )}
    </>
  )
}
