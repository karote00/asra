import { memo } from 'react'
import { ProjectControls } from '../projects/project-controls'
import { ThemeToggle } from './theme-toggle'
import { useWorkbenchController } from './use-workbench-controller'

type Props = Pick<
  ReturnType<typeof useWorkbenchController>,
  'resources' | 'ready' | 'unsavedRunCount'
>

export const WorkbenchHeader = memo(function WorkbenchHeader({
  resources,
  ready,
  unsavedRunCount
}: Props) {
  return (
    <header
      className="topbar h-16 flex-none flex items-center justify-between py-0 px-[26px]
        bg-sim-surface border-b border-b-sim-divider gap-6 max-[800px]:py-0
        max-[800px]:px-4 max-[700px]:gap-[10px] max-[700px]:py-0
        max-[700px]:px-3"
    >
      <div
        className="brand flex items-center gap-3 [&_strong]:text-[20px]
          [&_strong]:tracking-[-0.8px] [&_strong]:text-sim-text
          [&_strong_>_span]:font-normal [&_strong_>_span]:text-sim-muted
          [&_strong_>_span]:ml-[3px] max-[1100px]:mr-auto max-[700px]:gap-2"
      >
        <span
          className="brand-mark font-[750] text-[27px] bg-[#123340] text-[#fff] w-[33px]
            h-[33px] rounded-[9px] leading-[30px] text-center
            [&_span]:text-[#64d2bd]"
        >
          a<span>·</span>
        </span>

        <strong>
          {'Asyra'.toLowerCase()}
          <span>sim</span>
        </strong>
      </div>

      <div
        className="project-title text-[12px] font-[650] flex flex-col gap-1 mr-auto
          pl-[25px] border-l border-l-sim-divider [&_span]:text-[10px]
          [&_span]:font-normal [&_span]:text-sim-muted max-[1100px]:hidden"
      >
        Robot workcell experiments<span>Local workspace</span>
      </div>

      {resources && (
        <ProjectControls
          session={resources.session}
          ready={ready}
          unsavedRunCount={unsavedRunCount}
        />
      )}

      <ThemeToggle />

      <span
        className="local-badge text-[10px] text-sim-success-text flex items-center
          gap-[7px] [&_i]:w-[6px] [&_i]:h-[6px] [&_i]:rounded-full
          [&_i]:bg-[#31a88d] [&_i]:inline-block max-[800px]:hidden"
      >
        <i />
        Private by default
      </span>
    </header>
  )
})
