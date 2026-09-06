import { memo } from 'react'
import { Hierarchy } from './hierarchy'
import { useWorkbenchController } from './use-workbench-controller'

type Props = Pick<
  ReturnType<typeof useWorkbenchController>,
  | 'candidateId'
  | 'setCandidateId'
  | 'selectedId'
  | 'setSelectedId'
  | 'hierarchyOpen'
  | 'setPlayback'
  | 'ready'
  | 'workcell'
  | 'candidates'
  | 'hasSelectedCandidate'
  | 'select'
  | 'addBody'
  | 'createCandidate'
  | 'duplicateCandidate'
>

export const HierarchyPanel = memo(function HierarchyPanel({
  candidateId,
  setCandidateId,
  selectedId,
  setSelectedId,
  hierarchyOpen,
  setPlayback,
  ready,
  workcell,
  candidates,
  hasSelectedCandidate,
  select,
  addBody,
  createCandidate,
  duplicateCandidate
}: Props) {
  return (
    <aside
      className={`hierarchy-panel bg-sim-raised border-r border-r-sim-border flex flex-col
        min-h-0 overflow-auto max-[1100px]:hidden max-[1100px]:[&.is-open]:flex
        max-[1100px]:[&.is-open]:absolute
        max-[1100px]:[&.is-open]:inset-[0_auto_0_0] max-[1100px]:[&.is-open]:w-70
        max-[1100px]:[&.is-open]:z-4
        max-[1100px]:[&.is-open]:shadow-[8px_0_24px_#10233026] ${hierarchyOpen ? 'is-open' : ''}`}
    >
      <div
        className="panel-heading flex items-center justify-between pt-[23px] px-5 pb-[17px]
          gap-[10px] [&_h2]:mt-[6px]"
      >
        <div>
          <span className="eyebrow text-[9px] tracking-[1.3px] text-sim-muted font-bold">
            MODEL
          </span>

          <h2>Workcell hierarchy</h2>
        </div>

        <span className="count text-[10px] bg-sim-subtle text-sim-secondary py-1 px-[7px] rounded-[4px]">
          {workcell?.bodies.length ?? 0}
        </span>
      </div>

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
            {candidates.length === 0 && (
              <option value="">
                {ready
                  ? 'No workcell — create one or Redo'
                  : 'No active document'}
              </option>
            )}

            {candidates.length > 0 && !hasSelectedCandidate && (
              <option value="">No active candidate — select one or Redo</option>
            )}

            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
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

      {workcell && (
        <Hierarchy
          workcell={workcell}
          selected={selectedId}
          onSelect={select}
        />
      )}

      <div className="hierarchy-note mt-auto py-6 px-5 text-sim-muted text-[10px] leading-[1.75] [&_p]:mt-[9px]">
        <span className="eyebrow text-[9px] tracking-[1.3px] text-sim-muted font-bold">
          MODEL NOTES
        </span>

        <p>
          Synthetic six-axis example.
          <br />
          Not a vendor-calibrated model.
        </p>

        <p>Visibility does not determine which objects enter an analysis.</p>
      </div>
    </aside>
  )
})
