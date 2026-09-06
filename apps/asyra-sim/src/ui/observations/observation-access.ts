import type { SimRuntime } from '../../init/bootstrap'

export type ObservationAccess = Pick<
  SimRuntime,
  'getObservations' | 'getObservationAttachment' | 'exportObservations'
> & {
  features: {
    edit: Pick<
      SimRuntime['features']['edit'],
      'addObservation' | 'updateObservation' | 'removeObservation'
    >
    observations: SimRuntime['features']['observations']
  }
}
