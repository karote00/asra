import { ExperimentPanel } from '../experiments/experiment-panel'
import {
  useWorkbenchField,
  useWorkbenchValue,
  useWorkbenchView
} from './workbench-context'

export function ExperimentInspector() {
  const view = useWorkbenchView()

  const runtime = useWorkbenchField('runtime')

  const candidateId = useWorkbenchField('candidateId')

  const ready = useWorkbenchField('ready')

  const generation = useWorkbenchValue((state) => state.lifecycle.generation)

  const hasWorkcell = useWorkbenchValue((state) => !!state.workcell)

  if (!ready || !runtime || !candidateId || !hasWorkcell || !view.experiment)
    return null

  return (
    <ExperimentPanel
      key={`${generation}:${candidateId}`}
      inputs={view.experiment}
    />
  )
}
