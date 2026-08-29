import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WorkspaceApp } from './App'
import './workspace.css'

const root = document.getElementById('flow-inspector-workspace-root')
const bundle = globalThis.FLOW_INSPECTOR_WORKSPACE_BUNDLE

if (!root) throw new Error('Missing Flow Inspector workspace root.')
if (!bundle) throw new Error('Missing Flow Inspector workspace bundle.')

createRoot(root).render(
  <StrictMode>
    <WorkspaceApp bundle={bundle} />
  </StrictMode>
)
