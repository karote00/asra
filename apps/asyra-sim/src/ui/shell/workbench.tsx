import { memo } from 'react'
import { ExperimentPanel } from '../experiments/experiment-panel'
import { BodyEditor } from '../objects/body-editor'
import { downloadRecovery } from '../projects/download-project'
import { RunLibrary } from '../results/run-library'
import { ErrorNotice } from '../shared/fields'
import { EmptyInspector } from './empty-inspector'
import { HierarchyPanel } from './hierarchy-panel'
import { useWorkbenchController } from './use-workbench-controller'
import { ViewportPanel } from './viewport-panel'
import { WorkbenchHeader } from './workbench-header'
import { WorkbenchStatus } from './workbench-status'
import { WorkbenchToolbar } from './workbench-toolbar'

const StableExperimentPanel = memo(ExperimentPanel)

export function Workbench() {
  const {
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
  } = useWorkbenchController()

  return (
    <div className="workbench h-[100dvh] min-h-135 flex flex-col overflow-hidden">
      <WorkbenchHeader
        resources={resources}
        ready={ready}
        unsavedRunCount={unsavedRunCount}
      />

      <WorkbenchToolbar
        hierarchyOpen={hierarchyOpen}
        setHierarchyOpen={setHierarchyOpen}
        inspector={inspector}
        setInspector={setInspector}
        setPlayback={setPlayback}
        setShowRuns={setShowRuns}
        ready={ready}
        workcell={workcell}
        runError={runError}
        performHistory={performHistory}
      />

      {error && <ErrorNotice message={error} onDismiss={() => setError('')} />}
      {runError && (
        <div
          className="error-notice flex items-center justify-between bg-sim-warning
            text-sim-warning-text py-[10px] px-5 border-b border-b-sim-warning-text
            gap-4 [&_button]:bg-transparent [&_button]:border-0"
          role="alert"
        >
          {runError}
        </div>
      )}

      {lifecycle.error && (
        <div
          className="lifecycle-notice py-3 px-[22px] bg-sim-error text-sim-error-text flex
            gap-4 items-center justify-between"
          role="alert"
        >
          <span>
            {lifecycle.error}
            {lifecycle.status === 'failed'
              ? ' No editable runtime is available. Correct the cause before reloading.'
              : ''}
          </span>

          {lifecycle.recoveryAvailable && (
            <button
              onClick={() => {
                try {
                  const snapshot = resources?.controller.getRecovery()

                  if (snapshot) downloadRecovery(snapshot)
                } catch (reason) {
                  setError(String(reason))
                }
              }}
            >
              Download recovery
            </button>
          )}
        </div>
      )}

      {modelError && (
        <div
          className="error-notice flex items-center justify-between bg-sim-warning
            text-sim-warning-text py-[10px] px-5 border-b border-b-sim-warning-text
            gap-4 [&_button]:bg-transparent [&_button]:border-0"
          role="alert"
        >
          {modelError}. Correct the model or use Undo; analysis is unavailable.
        </div>
      )}

      {loadIssues.length > 0 && (
        <details
          className="load-diagnostics py-3 px-[22px] text-sim-warning-text bg-sim-warning
            text-[11px] max-h-50 overflow-auto [&_summary]:cursor-pointer
            [&_summary]:font-[650] [&_p]:mt-[10px] [&_p]:leading-[1.6]
            [&_li]:my-[6px] [&_li]:mx-0 [&_li]:wrap-anywhere"
          data-testid="load-diagnostics"
          key={lifecycle.generation}
        >
          <summary>
            {loadIssues.length} load review requirement
            {loadIssues.length === 1 ? '' : 's'} - source diagnostics retained
          </summary>

          <p>
            Recovered fields are not proof of the original input. Formal
            analysis must remain blocked until these requirements are resolved.
          </p>

          <ul>
            {loadIssues.slice(0, 20).map((issue, index) => (
              <li key={index}>
                <code>{issue.path}</code>: {issue.message}
              </li>
            ))}
          </ul>

          {loadIssues.length > 20 && (
            <p>
              Showing the first 20 requirements; all are retained in saved data.
            </p>
          )}
        </details>
      )}

      <main
        className="work-area relative grid grid-cols-[265px_minmax(300px,_1fr)_360px]
          flex-1 min-h-0 max-[1100px]:grid-cols-[minmax(0,_1fr)_360px]
          max-[700px]:grid-cols-[minmax(0,_1fr)]
          max-[700px]:grid-rows-[minmax(220px,_0.85fr)_minmax(0,_1fr)]"
      >
        <HierarchyPanel
          createCandidate={createCandidate}
          duplicateCandidate={duplicateCandidate}
          candidateId={candidateId}
          setCandidateId={setCandidateId}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          hierarchyOpen={hierarchyOpen}
          setPlayback={setPlayback}
          ready={ready}
          workcell={workcell}
          candidates={candidates}
          hasSelectedCandidate={hasSelectedCandidate}
          select={select}
          addBody={addBody}
        />

        <ViewportPanel
          host={host}
          setHost={setHost}
          selectedId={selectedId}
          playback={playback}
          visualPreview={visualPreview}
          wireframe={wireframe}
          setWireframe={setWireframe}
          grid={grid}
          setGrid={setGrid}
          lifecycle={lifecycle}
          runtime={runtime}
          ready={ready}
          isCurrent={isCurrent}
          workcell={workcell}
          selected={selected}
          select={select}
        />

        <aside
          className="properties-panel bg-sim-surface min-h-0 min-w-0 border-l
            border-l-sim-border overflow-hidden max-[700px]:border-l-0
            max-[700px]:border-t max-[700px]:border-t-sim-border"
        >
          {ready && runtime && candidateId && workcell && (
            <div
              className="inspector-content h-full [&[hidden]]:hidden"
              hidden={inspector !== 'experiment'}
            >
              <StableExperimentPanel
                key={`${lifecycle.generation}:${candidateId}`}
                runtime={runtime}
                candidateId={candidateId}
                workcell={workcell}
                revision={revision}
                perform={perform}
                onPlayback={setPlayback}
                onVisualPreview={onVisualPreview}
                isCurrent={isCurrent}
                visualImportActive={inspector === 'experiment' && !playback}
                previewActive={
                  inspector === 'experiment' &&
                  !showRuns &&
                  !visualPreview &&
                  !playback?.historical
                }
                runs={runs}
                retainedIds={retainedIds}
                onRun={onRun}
                onOpenRuns={openRuns}
              />
            </div>
          )}

          <div
            className="inspector-content h-full [&[hidden]]:hidden"
            hidden={inspector !== 'object'}
          >
            {ready && selected && workcell && runtime && candidateId ? (
              <BodyEditor
                key={`${lifecycle.generation}:${candidateId}:${selected.id}`}
                body={selected}
                workcell={workcell}
                onChange={updateBody}
                onRemove={removeBody}
              />
            ) : (
              <EmptyInspector lifecycle={lifecycle} />
            )}
          </div>
        </aside>
      </main>

      {showRuns && ready && runtime && (
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
      )}

      <WorkbenchStatus
        runtime={runtime}
        historyDepth={historyDepth}
        runtimeStatus={runtimeStatus}
      />
    </div>
  )
}
