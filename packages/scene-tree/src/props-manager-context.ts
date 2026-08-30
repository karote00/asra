import propsManager, { type PropsManager } from '@asyra/props-manager'

let scopedPropsManager: PropsManager | undefined
let scopedInitialOwnerValues: Readonly<Record<string, unknown>> | undefined

export const getSceneTreePropsManager = (): PropsManager =>
  scopedPropsManager ?? propsManager

export const getSceneTreeInitialOwnerValues = ():
  Readonly<Record<string, unknown>> | undefined => scopedInitialOwnerValues

export const runWithSceneTreePropsManager = <T>(
  owner: PropsManager,
  callback: () => T
): T => {
  const previousOwner = scopedPropsManager
  scopedPropsManager = owner
  try {
    return callback()
  } finally {
    scopedPropsManager = previousOwner
  }
}

export const runWithSceneTreeInitialOwnerValues = <T>(
  values: Readonly<Record<string, unknown>>,
  callback: () => T
): T => {
  const previousValues = scopedInitialOwnerValues
  scopedInitialOwnerValues = values
  try {
    return callback()
  } finally {
    scopedInitialOwnerValues = previousValues
  }
}
