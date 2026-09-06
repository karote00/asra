import { CandidatePicker } from './candidate-picker'
import { Hierarchy } from './hierarchy'
import { useWorkbenchField, useWorkbenchValue } from './workbench-context'

function HierarchyHeading() {
  const count = useWorkbenchValue((state) => state.workcell?.bodies.length ?? 0)

  return (
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
        {count}
      </span>
    </div>
  )
}

export function HierarchyPanel() {
  const hierarchyOpen = useWorkbenchField('hierarchyOpen')

  return (
    <aside
      className={`hierarchy-panel bg-sim-raised border-r border-r-sim-border flex flex-col
        min-h-0 overflow-auto max-[1100px]:hidden max-[1100px]:[&.is-open]:flex
        max-[1100px]:[&.is-open]:absolute
        max-[1100px]:[&.is-open]:inset-[0_auto_0_0] max-[1100px]:[&.is-open]:w-70
        max-[1100px]:[&.is-open]:z-4
        max-[1100px]:[&.is-open]:shadow-[8px_0_24px_#10233026] ${hierarchyOpen ? 'is-open' : ''}`}
    >
      <HierarchyHeading />

      <CandidatePicker />

      <Hierarchy />

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
}
