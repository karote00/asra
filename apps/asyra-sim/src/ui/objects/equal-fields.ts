import type { Pose } from '../../domain/math'
import type { Joint, VisualBinding } from '../../domain/workcell'

export const equalNumbers = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, index) => Object.is(value, b[index]))

export const equalPose = (a: Pose, b: Pose) =>
  equalNumbers(a.position, b.position) && equalNumbers(a.rotation, b.rotation)

export const equalJoint = (a: Joint, b: Joint) =>
  a.kind === b.kind &&
  a.value === b.value &&
  a.min === b.min &&
  a.max === b.max &&
  equalNumbers(a.axis, b.axis)

/** Compare placement metadata only; never scan or cache original mesh triangles. */
export const equalBindings = (
  a: readonly VisualBinding[] | undefined,
  b: readonly VisualBinding[] | undefined
) =>
  a === b ||
  ((a?.length ?? 0) === (b?.length ?? 0) &&
    (a ?? []).every((binding, index) => {
      const next = b?.[index]

      return (
        !!next &&
        binding.version === next.version &&
        binding.id === next.id &&
        binding.assetId === next.assetId &&
        equalPose(binding.pose, next.pose) &&
        equalNumbers(binding.scale, next.scale)
      )
    }))
