import {
  AiPanelCommandIds,
  GroupCommandPlatforms,
  type AiPanelCommand,
  type GroupCommandPlatform
} from '../constants'

export interface AiPanelCommandDescriptor {
  readonly id: AiPanelCommand
  readonly label: string
  readonly ariaLabel: string
  readonly shortcutLabel: string
  readonly enabled: true
  readonly restoreInvokerFocusOnActivation: false
  readonly execute: () => void
}

interface CreateAiPanelCommandDescriptorOptions {
  readonly platform: GroupCommandPlatform
  readonly execute: () => void
}

const isAgentPrompt = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  target.closest('[data-ai-agent-prompt="true"]') !== null

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
  ) !== null

export const matchesAiPanelToggleShortcut = (
  event: KeyboardEvent,
  platform: GroupCommandPlatform
): boolean => {
  if (
    event.key.toLowerCase() !== 'i' ||
    event.repeat ||
    event.altKey ||
    event.shiftKey ||
    (isEditableTarget(event.target) && !isAgentPrompt(event.target))
  ) {
    return false
  }

  return platform === GroupCommandPlatforms.MACOS
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey
}

export const createAiPanelCommandDescriptor = ({
  platform,
  execute
}: CreateAiPanelCommandDescriptorOptions): AiPanelCommandDescriptor => ({
  id: AiPanelCommandIds.TOGGLE,
  label: 'Toggle Agent Panel',
  ariaLabel: 'Toggle Agent Panel',
  shortcutLabel: platform === GroupCommandPlatforms.MACOS ? '⌘I' : 'Ctrl+I',
  enabled: true,
  restoreInvokerFocusOnActivation: false,
  execute
})
