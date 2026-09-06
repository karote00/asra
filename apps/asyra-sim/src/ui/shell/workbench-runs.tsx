import { RunLibrary } from '../results/run-library'
import { useWorkbenchField } from './workbench-context'

export function WorkbenchRuns() {
  const showRuns = useWorkbenchField('showRuns')

  const ready = useWorkbenchField('ready')

  const runtime = useWorkbenchField('runtime')

  const lifecycle = useWorkbenchField('lifecycle')

  const isCurrent = useWorkbenchField('isCurrent')

  const runs = useWorkbenchField('runs')

  const retainedIds = useWorkbenchField('retainedIds')

  const candidates = useWorkbenchField('candidates')

  const isRunStale = useWorkbenchField('isRunStale')

  const retainRun = useWorkbenchField('retainRun')

  const replayRun = useWorkbenchField('replayRun')

  const setCandidateId = useWorkbenchField('setCandidateId')

  const setSelectedId = useWorkbenchField('setSelectedId')

  const setPlayback = useWorkbenchField('setPlayback')

  const setShowRuns = useWorkbenchField('setShowRuns')

  if (!showRuns || !ready || !runtime) return null

  return (
    <RunLibrary
      key={lifecycle.generation}
      runtime={runtime}
      isCurrent={() => isCurrent(runtime)}
      runs={runs}
      retainedIds={retainedIds}
      candidateIds={new Set(candidates.map((candidate) => candidate.id))}
      isStale={isRunStale}
      onRetain={retainRun}
      onReplay={replayRun}
      onCandidate={(id) => {
        setCandidateId(id)

        setSelectedId(null)

        setPlayback(null)
      }}
      onClose={() => setShowRuns(false)}
    />
  )
}
