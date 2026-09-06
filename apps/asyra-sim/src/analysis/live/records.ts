import {
  EXPERIMENT_RESOURCE_PROFILE,
  type ExperimentSnapshot
} from '../contracts'
import { measureWorkerPayload } from '../worker-protocol'
import { LIVE_LIMITS, type LiveSample } from './protocol'

const EMPTY_RECORDS: readonly LiveSample[] = Object.freeze([])

/** Analysis-owned, bounded observations for one exact admitted input lifetime. */
export class LiveEvidenceRecords {
  private input: ExperimentSnapshot | null = null
  private key: string | null = null
  private readonly samples = new Map<
    number,
    { sample: LiveSample; bytes: number }
  >()
  private bytes = 0
  private values: readonly LiveSample[] = Object.freeze([])

  getAll = (key?: string) =>
    key === undefined || key === this.key ? this.values : EMPTY_RECORDS

  getInput(key: string) {
    return this.key === key ? this.input : null
  }

  owns(input: ExperimentSnapshot) {
    return this.input === input
  }

  replace(input: ExperimentSnapshot | null, key: string | null = null) {
    this.input = input
    this.key = key
    this.samples.clear()
    this.bytes = 0
    this.values = Object.freeze([])
  }

  get(time: number) {
    return this.samples.get(time)?.sample
  }

  record(input: ExperimentSnapshot, sample: LiveSample) {
    if (!this.owns(input))
      throw new Error('Retired live input cannot record evidence')

    const bytes = measureWorkerPayload(sample)
    const previous = this.samples.get(sample.time)

    if (previous) {
      this.bytes -= previous.bytes
      this.samples.delete(sample.time)
    }

    while (
      this.samples.size >= LIVE_LIMITS.maxRecordedSamples ||
      this.bytes + bytes > EXPERIMENT_RESOURCE_PROFILE.maxEvidenceBytes
    ) {
      const first = this.samples.entries().next().value

      if (!first) throw new Error('Live sample exceeds the recording budget')

      this.samples.delete(first[0])
      this.bytes -= first[1].bytes
    }

    this.samples.set(sample.time, { sample, bytes })
    this.bytes += bytes
    this.values = Object.freeze(
      [...this.samples.values()].map((item) => item.sample)
    )
  }
}
