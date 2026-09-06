import { ToolbarButton } from './toolbar-button'
import { useWorkbenchField, useWorkbenchValue } from './workbench-context'

export function WorkbenchToolbar() {
  const hierarchyOpen = useWorkbenchField('hierarchyOpen')

  const setHierarchyOpen = useWorkbenchField('setHierarchyOpen')

  const inspector = useWorkbenchField('inspector')

  const setInspector = useWorkbenchField('setInspector')

  const setPlayback = useWorkbenchField('setPlayback')

  const setShowRuns = useWorkbenchField('setShowRuns')

  const ready = useWorkbenchField('ready')

  const workcell = useWorkbenchValue((state) => !!state.workcell)

  const runError = useWorkbenchField('runError')

  const performHistory = useWorkbenchField('performHistory')

  return (
    <div
      className="commandbar min-h-[49px] flex flex-none items-center justify-start py-2
        px-[22px] bg-sim-raised border-b border-b-sim-divider max-[700px]:py-2
        max-[700px]:px-3"
    >
      <div
        className="commands flex flex-wrap items-center gap-2 max-[700px]:gap-[6px]
          [&_button[aria-pressed=true]]:bg-sim-selected
          [&_button[aria-pressed=true]]:border-sim-focus
          [&_button[aria-pressed=true]]:text-sim-selected-text"
      >
        <ToolbarButton
          label="Model"
          className="model-toggle [@media(width>1100px)]:hidden"
          aria-expanded={hierarchyOpen}
          onClick={() => setHierarchyOpen((value) => !value)}
        >
          <rect x="3" y="3" width="6" height="5" rx="1" />

          <rect x="14" y="10" width="7" height="5" rx="1" />

          <rect x="14" y="18" width="7" height="3" rx="1" />

          <path d="M6 8v11.5h8M6 12.5h8" />
        </ToolbarButton>

        <ToolbarButton
          label="Undo"
          disabled={!ready}
          onClick={() => performHistory('undo')}
          aria-keyshortcuts="Meta+Z Control+Z"
          title="Undo (⌘Z / Ctrl+Z)"
        >
          <path
            d="m9 5-5 5 5 5M4 10h10a6 6 0 0 1 0 12"
            transform="translate(0 -2)"
          />
        </ToolbarButton>

        <ToolbarButton
          label="Redo"
          disabled={!ready}
          onClick={() => performHistory('redo')}
          aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
          title="Redo (⌘⇧Z / Ctrl+Shift+Z)"
        >
          <path
            d="m15 5 5 5-5 5M20 10H10a6 6 0 0 0 0 12"
            transform="translate(0 -2)"
          />
        </ToolbarButton>

        <span className="divider h-[18px] w-[1px] bg-sim-border my-0 mx-[5px] max-[700px]:m-0" />

        <ToolbarButton
          label="Experiments"
          disabled={!ready || !workcell}
          aria-pressed={inspector === 'experiment'}
          onClick={() => setInspector('experiment')}
        >
          <path d="M9 3h6M10 3v6l-6 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-6-9V3M7.3 13h9.4M9 17h.01M14 18h.01" />
        </ToolbarButton>

        <ToolbarButton
          label="Runs & compare"
          title="Results - Runs & compare"
          disabled={!ready || !!runError}
          onClick={() => setShowRuns(true)}
        >
          <path d="M4 3v18h17M8 17v-5M13 17V6M18 17V9" />
        </ToolbarButton>

        <ToolbarButton
          label="Object"
          disabled={!ready}
          aria-pressed={inspector === 'object'}
          onClick={() => {
            setInspector('object')

            setPlayback(null)
          }}
        >
          <path d="m12 3 9 5v8l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v8M7.5 5.5l9 5" />
        </ToolbarButton>
      </div>
    </div>
  )
}
