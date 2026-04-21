import type { SolidCenterStrokeResolvedPacket } from './solid-center-stroke-packets'
import type { CenterDashedOverlapCandidate } from './center-dashed-overlap-graph'

const parseGeometryIdentity = (geometryId: string) => {
  const parts = geometryId.split(':')
  if (parts.length < 4) {
    return {
      strokeId: 'stroke:unknown',
      intervalId: geometryId,
      authoredVisibleIntervalIndex: -1,
      startDistance: 0,
      endDistance: 0,
      wrapsSeam: false,
      previousVisibleIntervalId: null,
      nextVisibleIntervalId: null
    }
  }

  return {
    strokeId: `stroke:${parts[1]}`,
    intervalId: parts.slice(2).join(':'),
    authoredVisibleIntervalIndex: -1,
    startDistance: 0,
    endDistance: 0,
    wrapsSeam: false,
    previousVisibleIntervalId: null,
    nextVisibleIntervalId: null
  }
}

export const buildCenterDashedOverlapCandidatesFromResolvedPackets = (
  packets: SolidCenterStrokeResolvedPacket[]
): CenterDashedOverlapCandidate[] =>
  packets.map((packet) => {
    const identity = packet.geometry.debugMeta
      ? {
          strokeId: packet.geometry.debugMeta.strokeId ?? 'stroke:unknown',
          intervalId:
            packet.geometry.debugMeta.intervalId ?? packet.geometry.geometryId,
          authoredVisibleIntervalIndex:
            packet.geometry.debugMeta.authoredVisibleIntervalIndex ?? -1,
          startDistance: packet.geometry.debugMeta.startDistance ?? 0,
          endDistance: packet.geometry.debugMeta.endDistance ?? 0,
          wrapsSeam: packet.geometry.debugMeta.wrapsSeam ?? false,
          previousVisibleIntervalId:
            packet.geometry.debugMeta.previousVisibleIntervalId ?? null,
          nextVisibleIntervalId:
            packet.geometry.debugMeta.nextVisibleIntervalId ?? null
        }
      : parseGeometryIdentity(packet.geometry.geometryId)

    return {
      candidateId: packet.geometry.geometryId,
      intervalId: identity.intervalId,
      strokeId: identity.strokeId,
      authoredVisibleIntervalIndex: identity.authoredVisibleIntervalIndex,
      startDistance: identity.startDistance,
      endDistance: identity.endDistance,
      wrapsSeam: identity.wrapsSeam,
      previousVisibleIntervalId: identity.previousVisibleIntervalId,
      nextVisibleIntervalId: identity.nextVisibleIntervalId,
      polygons: packet.geometry.polygons
    }
  })
