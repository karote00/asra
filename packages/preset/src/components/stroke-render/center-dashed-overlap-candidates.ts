import type { SolidCenterStrokeResolvedPacket } from './solid-center-stroke-packets'
import type { CenterDashedOverlapCandidate } from './center-dashed-overlap-graph'

export const buildCenterDashedOverlapCandidatesFromResolvedPackets = (
  packets: SolidCenterStrokeResolvedPacket[]
): CenterDashedOverlapCandidate[] =>
  packets.map((packet) => {
    const identity = {
      strokeId: packet.geometry.debugMeta?.strokeId ?? 'stroke:unknown',
      ownerKey: packet.geometry.debugMeta?.ownerKey,
      networkId: packet.geometry.debugMeta?.networkId,
      intervalId:
        packet.geometry.debugMeta?.intervalId ?? packet.geometry.geometryId,
      authoredVisibleIntervalIndex:
        packet.geometry.debugMeta?.authoredVisibleIntervalIndex ?? -1,
      startDistance: packet.geometry.debugMeta?.startDistance ?? 0,
      endDistance: packet.geometry.debugMeta?.endDistance ?? 0,
      wrapsSeam: packet.geometry.debugMeta?.wrapsSeam ?? false,
      previousVisibleIntervalId:
        packet.geometry.debugMeta?.previousVisibleIntervalId ?? null,
      nextVisibleIntervalId:
        packet.geometry.debugMeta?.nextVisibleIntervalId ?? null
    }

    return {
      candidateId: packet.geometry.geometryId,
      intervalId: identity.intervalId,
      strokeId: identity.strokeId,
      ownerKey: identity.ownerKey,
      networkId: identity.networkId,
      authoredVisibleIntervalIndex: identity.authoredVisibleIntervalIndex,
      startDistance: identity.startDistance,
      endDistance: identity.endDistance,
      wrapsSeam: identity.wrapsSeam,
      previousVisibleIntervalId: identity.previousVisibleIntervalId,
      nextVisibleIntervalId: identity.nextVisibleIntervalId,
      polygons: packet.geometry.polygons
    }
  })
