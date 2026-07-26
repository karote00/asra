import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import '@asyra/design-system/index.css'
import DataContexts from './contexts/data-change'

import App from './app'
import reportWebVitals from './reportWebVitals'
import { initApp } from './init'
import {
  resolveAsyraDesignAiDeliveryMode,
  resolveAsyraDesignAiMode
} from './ai/mode'

const initialization = initApp({
  aiDeliveryMode: resolveAsyraDesignAiDeliveryMode(window.location.search),
  aiMode: resolveAsyraDesignAiMode(window.location.search)
})

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <React.StrictMode>
    <DataContexts />
    <App
      ai={
        initialization.aiMode === 'mock' &&
        initialization.aiConversation &&
        initialization.aiConfirmation &&
        initialization.aiHistory
          ? {
              confirmation: initialization.aiConfirmation,
              conversation: initialization.aiConversation,
              history: initialization.aiHistory
            }
          : undefined
      }
    />
  </React.StrictMode>
)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send it to an analytics endpoint. Learn more here: https://bit.ly/CRA-vitals
reportWebVitals()
