import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode
} from 'react'
import { useViewValue } from '../shared/use-view-value'
import type { ReadonlyView } from '../shared/view-source'
import type { ExperimentInputs } from './experiment-inputs'
import { ExperimentView, type ExperimentState } from './experiment-view'
import { useExperimentController } from './use-experiment-controller'

const ExperimentContext = createContext<ExperimentView | null>(null)

export function ExperimentProvider({
  inputs,
  children
}: {
  inputs: ReadonlyView<ExperimentInputs>
  children: ReactNode
}) {
  const runtime = useViewValue(inputs, (value) => value.runtime)

  const candidateId = useViewValue(inputs, (value) => value.candidateId)

  const workcell = useViewValue(inputs, (value) => value.workcell)

  const revision = useViewValue(inputs, (value) => value.revision)

  const perform = useViewValue(inputs, (value) => value.perform)

  const onPlayback = useViewValue(inputs, (value) => value.onPlayback)

  const runs = useViewValue(inputs, (value) => value.runs)

  const onRun = useViewValue(inputs, (value) => value.onRun)

  useViewValue(inputs, (value) => value.retainedIds)

  useViewValue(inputs, (value) => value.onOpenRuns)

  useViewValue(inputs, (value) => value.onVisualPreview)

  useViewValue(inputs, (value) => value.isCurrent)

  useViewValue(inputs, (value) => value.visualImportActive)

  useViewValue(inputs, (value) => value.previewActive)

  const controller = useExperimentController({
    runtime,
    candidateId,
    workcell,
    revision,
    perform,
    onPlayback,
    runs,
    onRun
  })

  const state = { ...inputs.getSnapshot(), ...controller }

  const [view] = useState(() => new ExperimentView(state))

  useLayoutEffect(() => view.publish(state), [view, state])

  return (
    <ExperimentContext.Provider value={view}>
      {children}
    </ExperimentContext.Provider>
  )
}

export function useExperimentView(): ExperimentView {
  const view = useContext(ExperimentContext)

  if (!view) throw new Error('Missing experiment projection')

  return view
}

export function useExperimentValue<Value>(
  read: (state: ExperimentState) => Value
): Value {
  return useViewValue(useExperimentView(), read)
}

export function useExperimentField<Key extends keyof ExperimentState>(
  key: Key
): ExperimentState[Key] {
  return useExperimentValue((state) => state[key])
}
