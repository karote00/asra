import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode
} from 'react'
import { WorkbenchView, type WorkbenchState } from '../runtime/workbench-view'
import { useViewValue } from '../shared/use-view-value'
import { useWorkbenchController } from './use-workbench-controller'

const WorkbenchContext = createContext<WorkbenchView | null>(null)

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const state = useWorkbenchController()

  const [source] = useState(() => new WorkbenchView(state))

  useLayoutEffect(() => source.publish(state), [source, state])

  return (
    <WorkbenchContext.Provider value={source}>
      {children}
    </WorkbenchContext.Provider>
  )
}

export function useWorkbenchView(): WorkbenchView {
  const source = useContext(WorkbenchContext)

  if (!source) throw new Error('Missing workbench projection')

  return source
}

export function useWorkbenchValue<Value>(
  read: (state: WorkbenchState) => Value
): Value {
  return useViewValue(useWorkbenchView(), read)
}

export function useWorkbenchField<Key extends keyof WorkbenchState>(
  key: Key
): WorkbenchState[Key] {
  return useWorkbenchValue((state) => state[key])
}
