import { ErrorNotice } from '../shared/fields'
import { downloadRecovery } from '../projects/download-project'
import { useWorkbenchField } from './workbench-context'

export function WorkbenchNotices() {
  const error = useWorkbenchField('error')

  const setError = useWorkbenchField('setError')

  const runError = useWorkbenchField('runError')

  const lifecycle = useWorkbenchField('lifecycle')

  const resources = useWorkbenchField('resources')

  const modelError = useWorkbenchField('modelError')

  const loadIssues = useWorkbenchField('loadIssues')

  return (
    <>
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
    </>
  )
}
