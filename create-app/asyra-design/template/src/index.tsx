import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import '@asyra/design-system/index.css'
import DataContexts from './contexts/data-change'

import App from './app'
import reportWebVitals from './reportWebVitals'
import {
  isAiDrawingPerformanceProfileRequested,
  installAiDrawingPerformanceProfile
} from './init/performance/ai-drawing-performance-profile'
import { installRuntimeDiagnosticService } from './init/diagnostics/runtime-diagnostic-service'
import { startApp as startAppRuntime } from './startup'

const performanceProfileRequested = isAiDrawingPerformanceProfileRequested(
  window.location.search
)
const performanceProfile = performanceProfileRequested
  ? installAiDrawingPerformanceProfile({
      runtime: import.meta.env.PROD ? 'production' : 'development'
    })
  : null
const disposeRuntimeDiagnosticService = installRuntimeDiagnosticService()
window.addEventListener('pagehide', disposeRuntimeDiagnosticService, {
  once: true
})
const bootstrapApp = async (): Promise<void> => {
  await startAppRuntime({
    render: (initialization) => {
      if (performanceProfile) {
        performanceProfile.attachConversation(initialization.aiConversation)
        window.addEventListener(
          'pagehide',
          () => performanceProfile.dispose(),
          {
            once: true
          }
        )
      }

      const root = ReactDOM.createRoot(
        document.getElementById('root') as HTMLElement
      )
      root.render(
        <React.StrictMode>
          <DataContexts />
          <App
            ai={{
              confirmation: initialization.aiConfirmation,
              conversation: initialization.aiConversation,
              history: initialization.aiHistory
            }}
          />
        </React.StrictMode>
      )
    }
  })

  // If you want to start measuring performance in your app, pass a function
  // to log results (for example: reportWebVitals(console.log))
  // or send it to an analytics endpoint. Learn more here: https://bit.ly/CRA-vitals
  reportWebVitals()
}

void bootstrapApp().catch((error: unknown) => {
  disposeRuntimeDiagnosticService()
  performanceProfile?.dispose()
  // eslint-disable-next-line no-console
  console.error('[startup] App startup failed:', error)
})
