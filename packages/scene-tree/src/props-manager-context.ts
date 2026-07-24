import propsManager, { type PropsManager } from '@asyra/props-manager'

let scopedPropsManager: PropsManager | undefined

export const getSceneTreePropsManager = (): PropsManager =>
  scopedPropsManager ?? propsManager

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
