import {
  useExperimentField,
  useExperimentValue,
  useExperimentView
} from './experiment-context'
import { GlbPreview } from '../imports/glb-preview'
import { TrajectoryImportPanel } from '../imports/trajectory-import-panel'

export function ExperimentTrajectory() {
  const view = useExperimentView()

  const canonical = useExperimentField('canonical')

  const workcell = useExperimentField('workcell')

  const trajectory = useExperimentValue((state) => state.draft.trajectory)

  return (
    <>
      <TrajectoryImportPanel
        key={`${canonical?.id ?? 'new'}:${canonical?.definition.revision ?? 0}`}
        workcell={workcell}
        trajectory={trajectory}
        onAccept={(value) => {
          const first = value.trajectory.keyframes[0]

          const last = value.trajectory.keyframes.at(-1)

          if (!first || !last)
            throw new Error('Accepted trajectory has no keyframes')

          view.getSnapshot().changed({
            ...view.getSnapshot().draft,
            trajectory: value.trajectory,
            sourceUnits: value.sourceUnits,
            interval: [first.time, last.time]
          })
        }}
      />
    </>
  )
}

export function ExperimentOriginalImport() {
  const runtime = useExperimentField('runtime')

  const candidateId = useExperimentField('candidateId')

  const workcell = useExperimentField('workcell')

  const onVisualPreview = useExperimentField('onVisualPreview')

  const isCurrent = useExperimentField('isCurrent')

  const visualImportActive = useExperimentField('visualImportActive')

  return (
    <>
      <GlbPreview
        runtime={runtime}
        candidateId={candidateId}
        workcell={workcell}
        onPreview={onVisualPreview}
        isCurrent={isCurrent}
        active={visualImportActive}
      />
    </>
  )
}
