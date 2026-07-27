import type { CanonicalElementBatchResult } from '@asyra/core'

export interface AsyraDesignAiProgressiveSlice {
  readonly orderedIds: readonly string[]
}

export interface AsyraDesignAiProgressiveDeliveryStage {
  readonly assertNotAborted: () => void
  readonly deliveryHandle: CanonicalElementBatchResult['deliveryHandle']
  readonly signal: AbortSignal
  readonly slices: readonly AsyraDesignAiProgressiveSlice[]
  readonly yieldToHost: () => Promise<void>
}

export interface AsyraDesignAiProgressiveDeliveryCoordinator {
  stage(stage: AsyraDesignAiProgressiveDeliveryStage): void
  flush(): Promise<void>
}

export const createAsyraDesignAiProgressiveDeliveryCoordinator =
  (): AsyraDesignAiProgressiveDeliveryCoordinator => {
    const stages: AsyraDesignAiProgressiveDeliveryStage[] = []
    const orderedIds = new Set<string>()
    let deliveryHandle:
      | CanonicalElementBatchResult['deliveryHandle']
      | undefined

    const reset = (): void => {
      stages.length = 0
      orderedIds.clear()
      deliveryHandle = undefined
    }

    return Object.freeze({
      stage(stage: AsyraDesignAiProgressiveDeliveryStage): void {
        stage.assertNotAborted()
        if (stage.signal.aborted) {
          stage.assertNotAborted()
        }
        if (stage.slices.length === 0) {
          throw new Error(
            'Asyra Design AI progressive delivery requires at least one slice'
          )
        }
        if (deliveryHandle && deliveryHandle !== stage.deliveryHandle) {
          throw new Error(
            'Asyra Design AI progressive delivery requires one Factory handle per transaction'
          )
        }

        const stageIds = stage.slices.flatMap(({ orderedIds: sliceIds }) => {
          if (sliceIds.length === 0) {
            throw new Error(
              'Asyra Design AI progressive delivery cannot stage an empty slice'
            )
          }
          return [...sliceIds]
        })
        const observedStageIds = new Set<string>()
        stageIds.forEach((orderedId) => {
          if (
            orderedId.length === 0 ||
            orderedIds.has(orderedId) ||
            observedStageIds.has(orderedId)
          ) {
            throw new Error(
              `Asyra Design AI progressive delivery has an invalid ordered id: ${orderedId}`
            )
          }
          observedStageIds.add(orderedId)
        })

        deliveryHandle = stage.deliveryHandle
        observedStageIds.forEach((orderedId) => orderedIds.add(orderedId))
        stages.push(
          Object.freeze({
            ...stage,
            slices: Object.freeze(
              stage.slices.map(({ orderedIds: sliceIds }) =>
                Object.freeze({
                  orderedIds: Object.freeze([...sliceIds])
                })
              )
            )
          })
        )
      },
      async flush(): Promise<void> {
        if (!deliveryHandle || stages.length === 0) {
          return
        }
        try {
          const activeDeliveryHandle = deliveryHandle
          stages.forEach((stage) => stage.assertNotAborted())
          const deliverySlices = stages.flatMap((stage) =>
            stage.slices.map((slice) => ({ slice, stage }))
          )
          const slices = deliverySlices.map(({ slice }, index) =>
            Object.freeze({
              orderedIds: slice.orderedIds,
              sliceId: `ai-composition:${activeDeliveryHandle.transactionId}:${index + 1}`
            })
          )
          activeDeliveryHandle.setDeliveryPlan(
            Object.freeze({
              mode: 'progressive',
              slices: Object.freeze(slices)
            })
          )
          for (let index = 0; index < deliverySlices.length; index += 1) {
            const { stage } = deliverySlices[index]
            stage.assertNotAborted()
            activeDeliveryHandle.deliverSlice(slices[index].sliceId)
            await stage.yieldToHost()
            stage.assertNotAborted()
          }
        } finally {
          reset()
        }
      }
    })
  }
