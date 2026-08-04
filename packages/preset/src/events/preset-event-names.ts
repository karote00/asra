import { EventTypes, defineEvent, type EventDefinition } from '@asyra/core'
import { InputSystemEvents } from './input-events.js'

type EventNamesMap = Record<string, string>

type DefinitionsFromNames<TNames extends EventNamesMap> = {
  [K in keyof TNames]: EventDefinition<unknown, unknown>
}

const defineEventsFromNames = <TNames extends EventNamesMap>(
  names: TNames
): DefinitionsFromNames<TNames> =>
  Object.fromEntries(
    Object.entries(names).map(([key, eventName]) => [
      key,
      defineEvent(eventName)
    ])
  ) as DefinitionsFromNames<TNames>

const FrameworkEventNames = EventTypes

export const PresetEventNames = {
  ...FrameworkEventNames,
  ...InputSystemEvents
} as const

export type PresetEventName =
  (typeof PresetEventNames)[keyof typeof PresetEventNames]

export type PresetEventDefinitions = DefinitionsFromNames<
  typeof PresetEventNames
>

export const FrameworkEventDefinitions =
  defineEventsFromNames(FrameworkEventNames)
export const BasicInputEventDefinitions =
  defineEventsFromNames(InputSystemEvents)

export const PresetEventDefinitions: PresetEventDefinitions = {
  ...FrameworkEventDefinitions,
  ...BasicInputEventDefinitions
}
