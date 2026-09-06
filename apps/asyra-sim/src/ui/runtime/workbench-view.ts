import type { Body, Workcell } from '../../domain/workcell'
import type { ExperimentInputs } from '../experiments/experiment-inputs'
import type { useWorkbenchController } from '../shell/use-workbench-controller'
import { ViewSource } from '../shared/view-source'

export type WorkbenchState = ReturnType<typeof useWorkbenchController>

/** One current read projection per workbench lifetime, with body-owned channels. */
export class WorkbenchView extends ViewSource<WorkbenchState> {
  readonly workcell: ViewSource<Workcell | null>
  experiment: ViewSource<ExperimentInputs> | null

  private readonly bodies = new Map<string, ViewSource<Body>>()

  constructor(initial: WorkbenchState) {
    super(initial)

    this.workcell = new ViewSource(initial.workcell)

    const experiment = experimentInputs(initial)

    this.experiment = experiment ? new ViewSource(experiment) : null

    for (const body of initial.workcell?.bodies ?? []) {
      this.bodies.set(body.id, new ViewSource(body))
    }
  }

  body(id: string): ViewSource<Body> {
    const source = this.bodies.get(id)

    if (!source) throw new Error(`Missing projected body: ${id}`)

    return source
  }

  override publish(next: WorkbenchState): void {
    const previous = this.getSnapshot()

    const notify: (() => void)[] = []

    const experiment = experimentInputs(next)

    if (!experiment) this.experiment = null
    else if (
      !this.experiment ||
      previous.runtime !== next.runtime ||
      previous.candidateId !== next.candidateId
    ) {
      this.experiment = new ViewSource(experiment)
    } else notify.push(this.experiment.stage(experiment))

    if (
      previous.runtime !== next.runtime ||
      previous.candidateId !== next.candidateId
    ) {
      this.bodies.clear()
    }

    if (previous.workcell !== next.workcell || !this.bodies.size) {
      const ids = new Set<string>()

      for (const body of next.workcell?.bodies ?? []) {
        ids.add(body.id)

        const source = this.bodies.get(body.id)

        if (source) notify.push(source.stage(body))
        else this.bodies.set(body.id, new ViewSource(body))
      }

      for (const id of this.bodies.keys()) {
        if (!ids.has(id)) this.bodies.delete(id)
      }

      notify.push(this.workcell.stage(next.workcell))
    }

    notify.push(this.stage(next))

    for (const flush of notify) flush()
  }
}

function experimentInputs(state: WorkbenchState): ExperimentInputs | null {
  if (!state.ready || !state.runtime || !state.candidateId || !state.workcell)
    return null

  return {
    runtime: state.runtime,
    candidateId: state.candidateId,
    workcell: state.workcell,
    revision: state.revision,
    perform: state.perform,
    onPlayback: state.setPlayback,
    runs: state.runs,
    retainedIds: state.retainedIds,
    onRun: state.onRun,
    onOpenRuns: state.openRuns,
    onVisualPreview: state.onVisualPreview,
    isCurrent: state.isCurrent,
    visualImportActive: state.inspector === 'experiment' && !state.playback,
    previewActive:
      state.inspector === 'experiment' &&
      !state.showRuns &&
      !state.visualPreview &&
      !state.playback?.historical
  }
}
