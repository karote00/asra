import {
  useExperimentField,
  useExperimentValue,
  useExperimentView
} from './experiment-context'

export function ExperimentHeading() {
  const count = useExperimentValue((state) => state.experiments.length)

  return (
    <div
      className="panel-heading flex items-center justify-between pt-[23px] px-5 pb-[17px]
          gap-[10px] [&_h2]:mt-[6px]"
    >
      <div>
        <span className="eyebrow text-[9px] tracking-[1.3px] text-sim-muted font-bold">
          EXPERIMENT
        </span>

        <h2>Collision & clearance</h2>
      </div>

      <span className="count text-[10px] bg-sim-subtle text-sim-secondary py-1 px-[7px] rounded-[4px]">
        {count}
      </span>
    </div>
  )
}

export function ExperimentPicker() {
  const view = useExperimentView()

  const experiments = useExperimentField('experiments')

  const name = useExperimentField('name')

  const canonical = useExperimentValue((state) => state.canonical)

  return (
    <>
      <div
        className="experiment-picker flex items-end gap-2 [&_label]:flex-1
            [&_label]:min-w-0 [&_button]:flex-none [&_button]:whitespace-nowrap"
      >
        <label>
          Experiment
          <select
            aria-label="Experiment"
            value={canonical?.id ?? ''}
            onChange={(event) =>
              event.target.value
                ? view.getSnapshot().setExperimentId(event.target.value)
                : view.getSnapshot().freshDraft()
            }
          >
            <option value="">New draft</option>

            {experiments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} - r{item.definition.revision}
              </option>
            ))}
          </select>
        </label>

        <button onClick={() => view.getSnapshot().freshDraft()}>
          New experiment
        </button>
      </div>

      {!canonical && (
        <label>
          Name
          <input
            aria-label="Experiment name"
            value={name}
            maxLength={200}
            onChange={(event) => view.getSnapshot().setName(event.target.value)}
          />
        </label>
      )}
    </>
  )
}
