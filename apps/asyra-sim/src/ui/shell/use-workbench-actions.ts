import { useCallback } from 'react'
import type { ExperimentSnapshot } from '../../analysis/contracts'
import { IDENTITY_POSE } from '../../domain/math'
import { jointValuesAt, type Body } from '../../domain/workcell'
import type { SimRuntime } from '../../init/bootstrap'
import type { RunRecord } from '../../storage/run-record'
import { definitionToDraft } from '../experiments/experiment-draft'
import { type PlaybackView } from '../experiments/playback-view'
import { isPresentedRunStale } from '../results/run-freshness'

export function useWorkbenchActions({
  runtime,
  candidateId,
  selected,
  perform,
  isCurrent,
  setSelectedId,
  setCandidateId,
  setPlayback,
  setStatus
}: {
  runtime: SimRuntime | null
  candidateId: string | null
  selected: Body | undefined
  perform: (
    action: (assertCurrent: () => void) => Promise<unknown>,
    message: string
  ) => Promise<void>
  isCurrent: (runtime: SimRuntime) => boolean
  setSelectedId: (id: string | null) => void
  setCandidateId: (id: string | null) => void
  setPlayback: (value: PlaybackView | null) => void
  setStatus: (value: string) => void
}) {
  const addBody = useCallback(() => {
    if (!runtime || !candidateId) return

    const body: Body = {
      id: crypto.randomUUID(),
      name: 'New fixture',
      parentId: null,
      role: 'fixture',
      pose: { ...IDENTITY_POSE, position: [1, 0.25, 1] },
      joint: { kind: 'fixed', axis: [0, 1, 0], value: 0, min: 0, max: 0 },
      colliders: [
        {
          id: 'shape',
          pose: IDENTITY_POSE,
          geometry: { kind: 'box', size: [0.5, 0.5, 0.5] }
        }
      ],
      visible: true,
      color: 0x8ba6b4
    }

    void perform(async (assertCurrent) => {
      await runtime.features.edit.upsert(candidateId, body)

      assertCurrent()

      setSelectedId(body.id)
    }, 'Fixture added - one Undo action')
  }, [runtime, candidateId, perform, setSelectedId])

  const updateBody = useCallback(
    (body: Body) => {
      if (!runtime || !candidateId) return Promise.resolve()

      return perform(
        () => runtime.features.edit.upsert(candidateId, body),
        'Property updated - one Undo action'
      )
    },
    [runtime, candidateId, perform]
  )

  const removeBody = useCallback(() => {
    if (!runtime || !candidateId || !selected) return

    if (
      window.confirm(
        'Delete this object and all its descendants? You can Undo this action.'
      )
    )
      void perform(async (assertCurrent) => {
        await runtime.features.edit.remove(candidateId, selected.id)

        assertCurrent()

        setSelectedId(null)
      }, 'Object removed')
  }, [runtime, candidateId, selected, perform, setSelectedId])

  const isRunStale = useCallback(
    (run: RunRecord) => {
      if (!runtime) return true

      try {
        const experiment = runtime.getExperiment(
          run.snapshot.source.experimentId
        )

        return (
          !experiment ||
          isPresentedRunStale(
            run,
            runtime.getWorkcell(run.snapshot.source.candidateId),
            definitionToDraft(experiment.definition)
          )
        )
      } catch {
        return true
      }
    },
    [runtime, candidateId]
  )

  const retainRun = useCallback(
    async (run: RunRecord) => {
      if (!runtime || !isCurrent(runtime))
        throw new Error('The document is no longer active')

      await runtime.features.storage.retain(run)

      if (isCurrent(runtime))
        setStatus('Result retained - save the project for durable storage')
    },
    [runtime, isCurrent, setStatus]
  )

  const replayRun = useCallback(
    (
      snapshot: ExperimentSnapshot,
      time: number,
      bodyIds: readonly string[]
    ) => {
      if (runtime && isCurrent(runtime))
        setPlayback({
          workcell: snapshot.workcell,
          joints: jointValuesAt(snapshot.trajectory, time),
          time,
          historical: true,
          bodyIds
        })
    },
    [runtime, isCurrent, setPlayback]
  )

  const createCandidate = useCallback(
    () =>
      runtime &&
      void perform(async (assertCurrent) => {
        const id = await runtime.features.edit.createCandidate('New workcell', {
          version: 1,
          robotRootId: null,
          bodies: []
        })

        assertCurrent()

        setCandidateId(id)

        setSelectedId(null)

        setPlayback(null)
      }, 'Blank workcell created'),
    [runtime, perform, setCandidateId, setSelectedId, setPlayback]
  )

  const duplicateCandidate = useCallback(() => {
    if (!runtime || !candidateId) return

    const name = window.prompt(
      'Name the independent candidate. Copies committed model and experiment inputs only; unsaved drafts and historical runs are not copied.',
      'New candidate'
    )

    if (name === null) return

    void perform(async (assertCurrent) => {
      const id = await runtime.features.edit.duplicateCandidate(
        candidateId,
        name
      )

      assertCurrent()

      setCandidateId(id)

      setSelectedId(null)

      setPlayback(null)
    }, 'Candidate duplicated - one Undo action')
  }, [
    runtime,
    candidateId,
    perform,
    setCandidateId,
    setSelectedId,
    setPlayback
  ])

  return {
    addBody,
    updateBody,
    removeBody,
    isRunStale,
    retainRun,
    replayRun,
    createCandidate,
    duplicateCandidate
  }
}
