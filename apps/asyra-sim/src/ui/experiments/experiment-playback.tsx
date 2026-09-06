import { useExperimentField } from './experiment-context'
import { PlaybackControls } from '../viewport/playback-controls'
import { useLivePreview } from './use-live-preview'
import { LiveObservations } from './live-observations'

export function ExperimentPlayback() {
  const canonical = useExperimentField('canonical')

  const dirty = useExperimentField('dirty')

  const experimentId = useExperimentField('experimentId')

  const canonicalKey = useExperimentField('canonicalKey')

  const revision = useExperimentField('revision')

  const previewActive = useExperimentField('previewActive')

  const running = useExperimentField('running')

  const run = useExperimentField('selectedRun')

  const warnings = useExperimentField('warnings')

  const active = !!canonical && !dirty && (previewActive ?? true) && !running

  const identity = `${experimentId}:${canonicalKey}:${revision}:${run?.result.runId ?? ''}:${warnings.join(',')}`

  const playback = useLivePreview(active, identity)

  return (
    <>
      {canonical && !dirty && (
        <>
          <PlaybackControls
            key={identity}
            interval={canonical.definition.interval}
            active={active}
            onSample={playback.sample}
            onReset={playback.reset}
            onSuspend={playback.suspend}
          />

          <LiveObservations identity={identity} />
        </>
      )}
    </>
  )
}
