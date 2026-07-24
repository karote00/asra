import type { MouseEvent } from 'react'
import { runGroupCommand } from '../controllers/group-command-actions'

interface GroupCommandControlsProps {
  canGroup: boolean
  canUngroup: boolean
}

export const GroupCommandControls = ({
  canGroup,
  canUngroup
}: GroupCommandControlsProps) => {
  const handleCommand =
    (command: 'group' | 'ungroup') =>
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      runGroupCommand(command)
    }

  return (
    <div className="ml-auto flex items-center gap-1">
      <button
        type="button"
        className="rounded px-1.5 py-0.5 text-[10px] text-[#bbb] enabled:hover:bg-white/10 enabled:hover:text-white disabled:text-[#555]"
        aria-label="Group selected layers"
        data-testid="layers-group-button"
        disabled={!canGroup}
        title="Group (⌘/Ctrl+G)"
        onClick={handleCommand('group')}
      >
        Group
      </button>
      <button
        type="button"
        className="rounded px-1.5 py-0.5 text-[10px] text-[#bbb] enabled:hover:bg-white/10 enabled:hover:text-white disabled:text-[#555]"
        aria-label="Ungroup selected layer"
        data-testid="layers-ungroup-button"
        disabled={!canUngroup}
        title="Ungroup (⌘/Ctrl+Shift+G)"
        onClick={handleCommand('ungroup')}
      >
        Ungroup
      </button>
    </div>
  )
}
