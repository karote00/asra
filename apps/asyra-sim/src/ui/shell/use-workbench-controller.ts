import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SimRuntime } from '../../init/bootstrap'
import type { RunRecord } from '../../storage/run-record'
import { type PlaybackView } from '../experiments/playback-view'
import type { VisualPreview } from '../imports/visual-preview'
import { useProjectRuntime } from '../runtime/use-project-runtime'
import { useWorkbenchData } from '../runtime/workbench-data'
import {
  useHistoryShortcuts,
  type HistoryDirection
} from '../shared/history-shortcuts'
import { useWorkbenchActions } from './use-workbench-actions'

export function useWorkbenchController() {
  const [host, setHost] = useState<HTMLDivElement | null>(null)

  const [candidateId, setCandidateId] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [hierarchyOpen, setHierarchyOpen] = useState(false)

  const [inspector, setInspector] = useState<'object' | 'experiment'>('object')

  const [playback, setPlayback] = useState<PlaybackView | null>(null)

  const [visualPreview, setVisualPreview] = useState<VisualPreview | null>(null)

  const [wireframe, setWireframe] = useState(false)

  const onVisualPreview = useCallback((value: VisualPreview | null) => {
    setVisualPreview(value)

    if (value) {
      setPlayback(null)

      setWireframe(false)
    }
  }, [])

  const [pendingRuns, setPendingRuns] = useState<RunRecord[]>([])

  const [showRuns, setShowRuns] = useState(false)

  const [grid, setGrid] = useState(true)

  const [error, setError] = useState('')

  const [status, setStatus] = useState('Starting local runtime…')

  const onRuntime = useCallback((value: SimRuntime | null) => {
    setCandidateId(value?.getCandidates()[0]?.id ?? null)

    setSelectedId(null)

    setHierarchyOpen(false)

    setInspector('object')

    setPlayback(null)

    setVisualPreview(null)

    setWireframe(false)

    if (value) setPendingRuns([])

    setShowRuns(false)

    setGrid(true)

    setError('')

    setStatus(value ? 'Local runtime ready' : 'Replacing document…')
  }, [])

  const { resources, lifecycle, revision } = useProjectRuntime(host, onRuntime)

  const runtime = lifecycle.runtime

  const ready = lifecycle.status === 'ready'

  const isCurrent = useCallback(
    (value: SimRuntime) => {
      const state = resources?.controller.getState()

      return state?.status === 'ready' && state.runtime === value
    },
    [resources]
  )

  const onRun = useCallback(
    (run: RunRecord) => {
      if (runtime && isCurrent(runtime))
        setPendingRuns((current) => [...current, run])
    },
    [runtime, isCurrent]
  )

  const openRuns = useCallback(() => setShowRuns(true), [])

  const {
    workcell,
    modelError,
    candidates,
    loadIssues,
    retainedRuns,
    runError,
    historyDepth
  } = useWorkbenchData(runtime, candidateId, revision)

  const hasSelectedCandidate = candidates.some(
    (candidate) => candidate.id === candidateId
  )

  const retainedIds = useMemo(
    () => new Set(retainedRuns.map((run) => run.result.runId)),
    [retainedRuns]
  )

  const runs = useMemo(
    () => [
      ...new Map(
        [...pendingRuns, ...retainedRuns].map((run) => [run.result.runId, run])
      ).values()
    ],
    [pendingRuns, retainedRuns]
  )

  const unsavedRunCount = pendingRuns.filter(
    (run) => !retainedIds.has(run.result.runId)
  ).length

  useEffect(() => {
    if (!unsavedRunCount) return

    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()

      event.returnValue = ''
    }

    window.addEventListener('beforeunload', guard)

    return () => window.removeEventListener('beforeunload', guard)
  }, [unsavedRunCount])

  const selected = workcell?.bodies.find((body) => body.id === selectedId)

  const select = useCallback(
    (id: string | null) => {
      if (runtime && isCurrent(runtime)) {
        setSelectedId(id)

        setHierarchyOpen(false)

        setInspector('object')

        setPlayback(null)
      }
    },
    [runtime, isCurrent]
  )

  const perform = useCallback(
    async (
      action: (assertCurrent: () => void) => Promise<unknown>,
      message: string
    ) => {
      const assertCurrent = () => {
        if (!runtime || !isCurrent(runtime))
          throw new Error('The document is no longer active')
      }

      try {
        assertCurrent()

        await action(assertCurrent)

        assertCurrent()

        setError('')

        setStatus(message)
      } catch (reason) {
        if (!runtime || !isCurrent(runtime)) return

        setError(reason instanceof Error ? reason.message : String(reason))

        setStatus('Action rejected; the model was not changed')
      }
    },
    [runtime, isCurrent]
  )

  const performHistory = useCallback(
    (direction: HistoryDirection) => {
      if (!runtime) return

      void perform(
        () => runtime.features.history[direction](),
        direction === 'undo' ? 'Undo applied' : 'Redo applied'
      )
    },
    [runtime, perform]
  )

  useHistoryShortcuts(ready, performHistory)

  let runtimeStatus = status

  if (lifecycle.status === 'failed') runtimeStatus = 'Runtime unavailable'
  else if (lifecycle.status === 'replacing')
    runtimeStatus = 'Replacing document…'

  const {
    addBody,
    updateBody,
    removeBody,
    isRunStale,
    retainRun,
    replayRun,
    createCandidate,
    duplicateCandidate
  } = useWorkbenchActions({
    runtime,
    candidateId,
    selected,
    perform,
    isCurrent,
    setSelectedId,
    setCandidateId,
    setPlayback,
    setStatus
  })

  return {
    host,
    setHost,
    candidateId,
    setCandidateId,
    selectedId,
    setSelectedId,
    hierarchyOpen,
    setHierarchyOpen,
    inspector,
    setInspector,
    playback,
    setPlayback,
    visualPreview,
    wireframe,
    setWireframe,
    onVisualPreview,
    showRuns,
    setShowRuns,
    grid,
    setGrid,
    error,
    setError,
    status,
    setStatus,
    resources,
    lifecycle,
    revision,
    runtime,
    ready,
    isCurrent,
    onRun,
    openRuns,
    workcell,
    modelError,
    candidates,
    loadIssues,
    runError,
    historyDepth,
    hasSelectedCandidate,
    retainedIds,
    runs,
    unsavedRunCount,
    selected,
    select,
    perform,
    performHistory,
    addBody,
    runtimeStatus,
    updateBody,
    removeBody,
    isRunStale,
    retainRun,
    replayRun,
    createCandidate,
    duplicateCandidate
  }
}
