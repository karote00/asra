import type { ReadonlyView } from '../shared/view-source'
import type { ExperimentInputs } from './experiment-inputs'
import { ExperimentProvider, useExperimentView } from './experiment-context'
import { ExperimentFields } from './experiment-fields'
import { ExperimentHeading, ExperimentPicker } from './experiment-picker'
import { ExperimentPlayback } from './experiment-playback'
import {
  ExperimentTrajectory,
  ExperimentOriginalImport
} from './experiment-imports'
import {
  ExperimentSave,
  ExperimentPreflightAction,
  ExperimentRunAction
} from './experiment-actions'
import {
  ExperimentProgress,
  ExperimentPreflight,
  ExperimentError,
  ExperimentEvidence
} from './experiment-evidence'

export function ExperimentPanel({
  inputs
}: {
  inputs: ReadonlyView<ExperimentInputs>
}) {
  return (
    <ExperimentProvider inputs={inputs}>
      <ExperimentLayout />
    </ExperimentProvider>
  )
}

function ExperimentLayout() {
  const view = useExperimentView()

  return (
    <div
      className="experiment-panel h-full flex flex-col [&_>_.panel-heading]:flex-none
        [&_>_.panel-heading]:border-b [&_>_.panel-heading]:border-b-sim-divider
        [&_>_.panel-heading]:pt-[19px]"
    >
      <ExperimentHeading />

      <div
        className="experiment-scroll overflow-auto p-[18px] flex flex-col gap-[17px]
          min-h-0 [&_>_*]:shrink-0 [&_button]:text-[11px] [&_textarea]:resize-y
          [&_textarea]:text-[11px] [&_textarea]:leading-[1.6] [&_summary]:flex
          [&_summary]:flex-wrap [&_summary]:justify-between
          [&_summary]:items-baseline [&_summary]:[gap:5px_8px]
          [&_summary_>_span]:float-none [&_summary_>_span]:text-right
          overflow-x-hidden [&_label]:wrap-anywhere [&_button]:wrap-anywhere
          [&_summary]:wrap-anywhere [&_.section-heading]:flex-wrap
          [&_.section-heading]:gap-2 [&_.preview-time]:tabular-nums"
      >
        <ExperimentPicker />

        <ExperimentPlayback />

        <ExperimentFields source={view.fields} />

        <ExperimentTrajectory />

        <ExperimentOriginalImport />

        <ExperimentSave />

        <ExperimentPreflightAction />

        <ExperimentProgress />

        <ExperimentPreflight />

        <ExperimentRunAction />

        <ExperimentError />

        <ExperimentEvidence />
      </div>
    </div>
  )
}
