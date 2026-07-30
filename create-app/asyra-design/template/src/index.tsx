import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import '@asyra/design-system/index.css'
import DataContexts from './contexts/data-change'

import App from './app'
import reportWebVitals from './reportWebVitals'
import { startAsyraDesignApp } from './startup'

const startApp = async (): Promise<void> => {
  await startAsyraDesignApp({
    deliveryMode: 'progressive',
    render: (initialization) => {
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

void startApp().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[Asyra Design] App startup failed:', error)
})
