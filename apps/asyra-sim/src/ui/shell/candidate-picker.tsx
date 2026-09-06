import { useWorkbenchField, useWorkbenchValue } from './workbench-context'

export function CandidatePicker() {
  const candidateId = useWorkbenchField('candidateId')

  const setCandidateId = useWorkbenchField('setCandidateId')

  const setSelectedId = useWorkbenchField('setSelectedId')

  const setPlayback = useWorkbenchField('setPlayback')

  const ready = useWorkbenchField('ready')

  const membership = useWorkbenchValue((state) =>
    JSON.stringify(state.candidates.map((candidate) => candidate.id))
  )

  const candidateIds = JSON.parse(membership) as string[]

  const hasSelectedCandidate = useWorkbenchField('hasSelectedCandidate')

  const createCandidate = useWorkbenchField('createCandidate')

  const duplicateCandidate = useWorkbenchField('duplicateCandidate')

  const addBody = useWorkbenchField('addBody')

  const workcell = useWorkbenchValue((state) => !!state.workcell)

  return (
    <div
      className="candidate-picker pt-0 px-4 pb-5 border-b border-b-sim-divider mb-[10px]
          [&_label]:text-[10px] [&_select]:text-[11px]"
    >
      <div className="model-actions grid grid-cols-[1fr_1fr] gap-2 mb-4 [&_button]:text-[11px] [&_button]:p-2">
        <button disabled={!ready} onClick={createCandidate}>
          New workcell
        </button>

        <button disabled={!ready || !workcell} onClick={addBody}>
          Add fixture
        </button>
      </div>

      <label>
        Candidate
        <select
          aria-label="Candidate"
          disabled={!ready}
          value={hasSelectedCandidate ? (candidateId ?? '') : ''}
          onChange={(event) => {
            setCandidateId(event.target.value)

            setSelectedId(null)

            setPlayback(null)
          }}
        >
          {candidateIds.length === 0 && (
            <option value="">
              {ready
                ? 'No workcell — create one or Redo'
                : 'No active document'}
            </option>
          )}

          {candidateIds.length > 0 && !hasSelectedCandidate && (
            <option value="">No active candidate — select one or Redo</option>
          )}

          {candidateIds.map((id) => (
            <CandidateOption key={id} id={id} />
          ))}
        </select>
      </label>

      <button
        className="duplicate-candidate mt-[10px] w-full text-[10px]"
        disabled={!ready || !workcell}
        onClick={duplicateCandidate}
      >
        Duplicate candidate
      </button>
    </div>
  )
}

function CandidateOption({ id }: { id: string }) {
  const name = useWorkbenchValue(
    (state) => state.candidates.find((candidate) => candidate.id === id)?.name
  )

  return <option value={id}>{name}</option>
}
