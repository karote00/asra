import {
  useExperimentField,
  useExperimentValue,
  useExperimentView
} from './experiment-context'

export function ExperimentSave() {
  const view = useExperimentView()

  const dirty = useExperimentField('dirty')

  const canonical = useExperimentValue((state) => !!state.canonical)

  return (
    <>
      <div
        className="draft-actions flex items-center justify-between gap-[10px] py-3 px-0
            border-t border-t-sim-divider border-b border-b-sim-divider
            [&_span]:text-[10px] [&_span]:text-sim-muted"
      >
        <span>
          {dirty ? 'Unsaved experiment draft' : 'Experiment unchanged'}
        </span>

        <button
          className="primary bg-sim-accent text-[#fff] border-sim-accent [&:hover]:bg-sim-accent-hover"
          disabled={!dirty}
          onClick={() => void view.getSnapshot().save()}
        >
          {canonical ? 'Save experiment' : 'Create experiment'}
        </button>
      </div>
    </>
  )
}

export function ExperimentPreflightAction() {
  const view = useExperimentView()

  const dirty = useExperimentField('dirty')

  const running = useExperimentField('running')

  const canonical = useExperimentValue((state) => !!state.canonical)

  return (
    <>
      <button
        className="wide w-full"
        disabled={!canonical || dirty || running}
        onClick={() => {
          try {
            view.getSnapshot().inspect()

            view.getSnapshot().setError('')
          } catch (reason) {
            view.getSnapshot().fail(reason)
          }
        }}
      >
        Run preflight
      </button>
    </>
  )
}

export function ExperimentRunAction() {
  const view = useExperimentView()

  const dirty = useExperimentField('dirty')

  const running = useExperimentField('running')

  const canonical = useExperimentValue((state) => !!state.canonical)

  return (
    <>
      <div className="run-actions flex gap-2 [&_>_.primary]:flex-1">
        <button
          className="primary bg-sim-accent text-[#fff] border-sim-accent [&:hover]:bg-sim-accent-hover"
          disabled={!canonical || dirty || running}
          onClick={() => void view.getSnapshot().run()}
        >
          {running ? 'Formal analysis running…' : 'Run formal analysis'}
        </button>
      </div>
    </>
  )
}
