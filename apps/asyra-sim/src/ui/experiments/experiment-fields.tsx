import { useViewValue } from '../shared/use-view-value'
import { AcceptanceFields } from './acceptance-fields'
import { MethodFields } from './method-fields'
import type { ExperimentFieldsView } from './experiment-fields-view'
import { ScopeFields } from './scope-fields'
import {
  ThresholdFields,
  IntervalFields,
  NumericalFields
} from './experiment-numerical-fields'

interface Props {
  source: ExperimentFieldsView
}

export function ExperimentFields({ source }: Props) {
  return (
    <>
      <MethodSelection source={source} />

      <ThresholdFields source={source} />

      <AcceptanceSelection source={source} />

      <IntervalFields source={source} />

      <NumericalFields source={source} />

      <ScopeFields source={source} />
    </>
  )
}

function MethodSelection({ source }: Props) {
  useViewValue(source, (value) => value.draft.method)

  const methods = useViewValue(source, (value) => value.methods)

  const draft = source.getSnapshot().draft

  return (
    <MethodFields
      value={draft.method}
      methods={methods}
      onChange={(method) =>
        source.changeDraft((draft) => ({ ...draft, method }))
      }
    />
  )
}

function AcceptanceSelection({ source }: Props) {
  useViewValue(source, (value) => value.draft.rule.acceptance)

  useViewValue(source, (value) => value.draft.rule.minimumClearance)

  const draft = source.getSnapshot().draft

  return (
    <AcceptanceFields
      value={draft.rule.acceptance}
      baseline={draft.rule.minimumClearance}
      onChange={(acceptance) => {
        const { acceptance: _previous, ...rule } =
          source.getSnapshot().draft.rule

        source.changeDraft((draft) => ({
          ...draft,
          rule: { ...rule, ...(acceptance ? { acceptance } : {}) }
        }))
      }}
    />
  )
}
