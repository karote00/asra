import { ViewSource } from '../shared/view-source'
import { ExperimentFieldsView } from './experiment-fields-view'
import type { ExperimentInputs } from './experiment-inputs'
import type { useExperimentController } from './use-experiment-controller'

export type ExperimentState = ExperimentInputs &
  ReturnType<typeof useExperimentController>

export class ExperimentView extends ViewSource<ExperimentState> {
  readonly fields: ExperimentFieldsView

  constructor(initial: ExperimentState) {
    super(initial)

    this.fields = new ExperimentFieldsView(this.fieldInputs(initial))
  }

  private fieldInputs(state: ExperimentState) {
    return {
      draft: state.draft,
      workcell: state.workcell,
      methods: state.methods,
      exclusions: state.exclusions,
      onChange: state.changed,
      onExclusions: (value: string) => {
        const current = this.getSnapshot()

        current.setExclusions(value)

        current.setPreflight(null)
      }
    }
  }

  override publish(next: ExperimentState): void {
    const notify = this.stage(next)

    this.fields.publish(this.fieldInputs(next))

    notify()
  }
}
