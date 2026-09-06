import { useCallback, useLayoutEffect, useRef } from 'react'
import type { Body } from '../../domain/workcell'

/** Dispatch a section patch against the latest committed body, never a form copy. */
export function useBodyUpdate(
  body: Body,
  onChange: (body: Body) => Promise<void>
) {
  const current = useRef({ body, onChange })

  useLayoutEffect(() => {
    current.current = { body, onChange }
  }, [body, onChange])

  return useCallback((patch: Partial<Body>) => {
    void current.current.onChange({ ...current.current.body, ...patch })
  }, [])
}
