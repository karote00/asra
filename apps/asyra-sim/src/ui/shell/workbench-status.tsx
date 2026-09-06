import { memo } from 'react'
import { useWorkbenchController } from './use-workbench-controller'

type Props = Pick<
  ReturnType<typeof useWorkbenchController>,
  'runtime' | 'historyDepth' | 'runtimeStatus'
>

export const WorkbenchStatus = memo(function WorkbenchStatus({
  runtime,
  historyDepth,
  runtimeStatus
}: Props) {
  return (
    <footer
      className="statusbar h-[29px] flex-none bg-sim-surface border-t
        border-t-sim-divider flex justify-between items-center py-0 px-4
        text-[9px] text-sim-muted gap-[15px] [&_>_span:first-child]:flex
        [&_>_span:first-child]:items-center [&_>_span:first-child]:gap-[7px]
        [&_>_span:first-child]:text-sim-secondary
        max-[800px]:[&_>_span:last-child]:hidden"
    >
      <span>
        <i
          className={
            runtime
              ? 'ready-dot w-[6px] h-[6px] rounded-full bg-[#31a88d] inline-block'
              : 'pending-dot h-[6px] w-[6px] inline-block bg-[#d3aa58] rounded-full'
          }
        />

        <span role="status">{runtimeStatus}</span>
      </span>

      <span data-testid="history-depth">Undo steps: {historyDepth}</span>

      <span>
        Machine-scale geometry{' '}
        <span className="footer-dot py-0 px-2 text-sim-muted">·</span> CUSTOM
        renderer <span className="footer-dot py-0 px-2 text-sim-muted">·</span>{' '}
        Not a released product
      </span>
    </footer>
  )
})
