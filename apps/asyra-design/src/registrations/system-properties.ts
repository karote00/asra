/**
 * System Property Registrations
 *
 * These properties come from system state (zoom, primaryTool)
 * systemContext creates observables, uiContext subscribes to them
 */

import core from '../contexts'
import { PrimaryToolType } from '../constants'
import type { SelectedVectorPointState } from '../common-apis/system-context'

/**
 * Register system properties
 * - Registers in systemContext to create observables
 * - Registers in uiContext with system observables as source
 */
export const registerSystemProperties = () => {
  // Register zoom in systemContext (if needed) and get the observable
  const zoomObservable =
    core.getSystemPropertyObservable<number>('zoom') ??
    core.registerSystemProperty<number>('zoom', 1)

  // Register zoom in uiContext with system observable as source
  core.registerUIProperty<number>('zoom', {
    defaultValue: 1,
    source$: zoomObservable
  })

  // Register primaryTool in systemContext and get the observable
  const primaryToolObservable = core.registerSystemProperty<string>(
    'primaryTool',
    PrimaryToolType.SELECT
  )

  // Register primaryTool in uiContext with system observable as source
  core.registerUIProperty<string>('primaryTool', {
    defaultValue: PrimaryToolType.SELECT,
    source$: primaryToolObservable
  })

  const pathEditingVectorObservable = core.registerSystemProperty<string | null>(
    'pathEditingVectorId',
    null
  )
  core.registerSystemProperty<boolean>('pathEditingStartNewSubpath', false)

  const selectedPointObservable =
    core.registerSystemProperty<SelectedVectorPointState | null>(
      'selectedVectorPoint',
      null
    )
  core.registerSystemProperty<SelectedVectorPointState | null>(
    'hoveredVectorPoint',
    null
  )

  core.registerUIProperty<string | null>('pathEditingVectorId', {
    defaultValue: null,
    source$: pathEditingVectorObservable
  })
  core.registerUIProperty<SelectedVectorPointState | null>(
    'selectedVectorPoint',
    {
      defaultValue: null,
      source$: selectedPointObservable
    }
  )
}
