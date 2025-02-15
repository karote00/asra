import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import '@asra/design-system/index.css'
import DataContexts from './contexts/data-change'

import RenderApp from './render-app'
import App from './app'
import reportWebVitals from './reportWebVitals'

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <React.StrictMode>
    <DataContexts />
    <RenderApp />
    <App />
  </React.StrictMode>
)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
