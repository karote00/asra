import type { Body } from '../../domain/workcell'
import { BodyEditor } from '../objects/body-editor'
import { EmptyInspector } from './empty-inspector'
import {
  useWorkbenchField,
  useWorkbenchValue,
  useWorkbenchView
} from './workbench-context'

export function ObjectInspector() {
  const view = useWorkbenchView()

  const ready = useWorkbenchField('ready')

  const selectedId = useWorkbenchField('selectedId')

  const runtime = useWorkbenchField('runtime')

  const candidateId = useWorkbenchField('candidateId')

  const lifecycle = useWorkbenchField('lifecycle')

  const hasSelected = useWorkbenchValue((state) => !!state.selected)

  if (!ready || !hasSelected || !selectedId || !runtime || !candidateId) {
    return <EmptyInspector lifecycle={lifecycle} />
  }

  const isCurrentEditor = () => {
    const state = view.getSnapshot()

    return (
      state.runtime === runtime &&
      state.candidateId === candidateId &&
      state.selectedId === selectedId
    )
  }

  const update = (body: Body) =>
    isCurrentEditor() ? view.getSnapshot().updateBody(body) : Promise.resolve()

  const remove = () => {
    if (isCurrentEditor()) view.getSnapshot().removeBody()
  }

  return (
    <BodyEditor
      key={`${lifecycle.generation}:${candidateId}:${selectedId}`}
      body={view.body(selectedId)}
      workcell={view.workcell}
      onChange={update}
      onRemove={remove}
    />
  )
}
