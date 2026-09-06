import type { Pose } from '../../domain/math'
import type { Body } from '../../domain/workcell'
import { useViewValue } from '../shared/use-view-value'
import type { ReadonlyView } from '../shared/view-source'

export type BodySource = ReadonlyView<Body>

export interface DisplayUnits {
  lengthUnit: 'm' | 'mm'
  angleUnit: 'rad' | 'deg'
}

export function useDisplayUnits(source: ReadonlyView<DisplayUnits>) {
  const lengthUnit = useViewValue(source, (value) => value.lengthUnit)

  const angleUnit = useViewValue(source, (value) => value.angleUnit)

  return {
    lengthUnit,
    angleUnit,
    lengthScale: lengthUnit === 'mm' ? 1000 : 1,
    angleScale: angleUnit === 'deg' ? 180 / Math.PI : 1
  }
}

/** Observe primitive coordinates, not a cloned pose object or component props. */
export function usePoseValues<T>(
  source: ReadonlyView<T>,
  read: (value: T) => Pose | undefined
) {
  useViewValue(source, (value) => read(value)?.position[0])

  useViewValue(source, (value) => read(value)?.position[1])

  useViewValue(source, (value) => read(value)?.position[2])

  useViewValue(source, (value) => read(value)?.rotation[0])

  useViewValue(source, (value) => read(value)?.rotation[1])

  useViewValue(source, (value) => read(value)?.rotation[2])

  useViewValue(source, (value) => read(value)?.rotation[3])
}

export function useBodyPose(source: BodySource) {
  usePoseValues(source, (body) => body.pose)

  return source.getSnapshot().pose
}

export function useBodyJoint(source: BodySource) {
  useViewValue(source, (body) => body.joint.kind)

  useViewValue(source, (body) => body.joint.min)

  useViewValue(source, (body) => body.joint.value)

  useViewValue(source, (body) => body.joint.max)

  useViewValue(source, (body) => body.joint.axis[0])

  useViewValue(source, (body) => body.joint.axis[1])

  useViewValue(source, (body) => body.joint.axis[2])

  return source.getSnapshot().joint
}

export function useOriginalBinding(source: BodySource, id: string) {
  const read = (body: Body) =>
    body.visuals?.find((binding) => binding.id === id)

  useViewValue(source, (body) => read(body)?.version)

  useViewValue(source, (body) => read(body)?.assetId)

  useViewValue(source, (body) => read(body)?.scale[0])

  useViewValue(source, (body) => read(body)?.scale[1])

  useViewValue(source, (body) => read(body)?.scale[2])

  usePoseValues(source, (body) => read(body)?.pose)

  return read(source.getSnapshot())
}

export function useNativeCollider(source: BodySource, id: string) {
  const read = (body: Body) =>
    body.colliders.find((collider) => collider.id === id)

  const shape = (body: Body) => read(body)?.geometry

  useViewValue(source, (body) => shape(body)?.kind)

  useViewValue(source, (body) => {
    const geometry = shape(body)

    return geometry?.kind === 'box' ? geometry.size[0] : undefined
  })

  useViewValue(source, (body) => {
    const geometry = shape(body)

    return geometry?.kind === 'box' ? geometry.size[1] : undefined
  })

  useViewValue(source, (body) => {
    const geometry = shape(body)

    return geometry?.kind === 'box' ? geometry.size[2] : undefined
  })

  useViewValue(source, (body) => {
    const geometry = shape(body)

    return geometry?.kind === 'sphere' || geometry?.kind === 'capsule'
      ? geometry.radius
      : undefined
  })

  useViewValue(source, (body) => {
    const geometry = shape(body)

    return geometry?.kind === 'capsule' ? geometry.length : undefined
  })

  usePoseValues(source, (body) => read(body)?.pose)

  return read(source.getSnapshot())
}
