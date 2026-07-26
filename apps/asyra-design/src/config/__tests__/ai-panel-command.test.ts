import { describe, expect, it, vi } from 'vitest'
import { GroupCommandPlatforms } from '../../constants'
import {
  createAiPanelCommandDescriptor,
  matchesAiPanelToggleShortcut
} from '../ai-panel-command'

const keyboardEvent = (
  options: KeyboardEventInit,
  target: HTMLElement = document.body
) => {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'i',
    ...options
  })
  Object.defineProperty(event, 'target', { value: target })
  return event
}

describe('Agent panel command metadata and shortcut', () => {
  it.each([
    [GroupCommandPlatforms.MACOS, '⌘I'],
    [GroupCommandPlatforms.WINDOWS_LINUX, 'Ctrl+I']
  ] as const)(
    'projects one %s command descriptor',
    (platform, shortcutLabel) => {
      const execute = vi.fn()

      expect(createAiPanelCommandDescriptor({ execute, platform })).toEqual({
        id: 'toggle-agent-panel',
        label: 'Toggle Agent Panel',
        ariaLabel: 'Toggle Agent Panel',
        shortcutLabel,
        enabled: true,
        restoreInvokerFocusOnActivation: false,
        execute
      })
    }
  )

  it('accepts only the platform primary modifier and rejects repeats or extra modifiers', () => {
    expect(
      matchesAiPanelToggleShortcut(
        keyboardEvent({ metaKey: true }),
        GroupCommandPlatforms.MACOS
      )
    ).toBe(true)
    expect(
      matchesAiPanelToggleShortcut(
        keyboardEvent({ ctrlKey: true }),
        GroupCommandPlatforms.WINDOWS_LINUX
      )
    ).toBe(true)
    expect(
      matchesAiPanelToggleShortcut(
        keyboardEvent({ metaKey: true, repeat: true }),
        GroupCommandPlatforms.MACOS
      )
    ).toBe(false)
    expect(
      matchesAiPanelToggleShortcut(
        keyboardEvent({ altKey: true, metaKey: true }),
        GroupCommandPlatforms.MACOS
      )
    ).toBe(false)
    expect(
      matchesAiPanelToggleShortcut(
        keyboardEvent({ ctrlKey: true }),
        GroupCommandPlatforms.MACOS
      )
    ).toBe(false)
  })

  it('bypasses unrelated editable fields but lets the Agent prompt toggle closed', () => {
    const input = document.createElement('input')
    const prompt = document.createElement('textarea')
    prompt.dataset.aiAgentPrompt = 'true'

    expect(
      matchesAiPanelToggleShortcut(
        keyboardEvent({ metaKey: true }, input),
        GroupCommandPlatforms.MACOS
      )
    ).toBe(false)
    expect(
      matchesAiPanelToggleShortcut(
        keyboardEvent({ metaKey: true }, prompt),
        GroupCommandPlatforms.MACOS
      )
    ).toBe(true)
  })
})
