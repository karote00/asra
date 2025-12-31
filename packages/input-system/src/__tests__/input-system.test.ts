import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InputSystem } from '../input-system'
import * as KeyMapModule from '@asra/utils/key-map'
import * as ConstantsModule from '@asra/utils/constants'
import * as EventMappingsModule from '@asra/utils/event-mappings'
import {
  InputSystemEvents,
  InputType,
  RawInputEvent,
  ModifierKey,
  PointerEventData
} from '@asra/utils/types'

vi.mock('../../utils/src/key-map', () => ({
  default: {
    isModifierKeys: vi.fn(),
    isSpecialEvent: vi.fn()
  }
}))

vi.mock('../../utils/src/constants', () => ({
  default: {
    CLICK_THRESHOLD: 5,
    CLEAR_KEY_TIME: 100
  }
}))

vi.mock('../../utils/src/event-mappings', () => ({
  InputEventMappings: {}
}))

describe('InputSystem', () => {
  let inputSystem: InputSystem
  let addEventListenerSpy: vi.SpyInstance
  let _removeEventListenerSpy: vi.SpyInstance
  let preventDefaultSpy: vi.SpyInstance
  let clearTimeoutSpy: vi.SpyInstance
  let setTimeoutSpy: vi.SpyInstance
  let mockHTMLElement: HTMLElement

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()

    // Mock window event listeners
    addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    _removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    preventDefaultSpy = vi.fn()
    clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
    setTimeoutSpy = vi.spyOn(global, 'setTimeout')

    // Mock HTMLElement for event.target
    mockHTMLElement = {
      tagName: 'div',
      isContentEditable: false
      // Add other properties as needed by the code under test
    } as unknown as HTMLElement

    inputSystem = new InputSystem()
  })

  // Test constructor and setupListeners
  it('should set up event listeners on window during construction', () => {
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    )
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'keyup',
      expect.any(Function)
    )
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'mousedown',
      expect.any(Function)
    )
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'mouseup',
      expect.any(Function)
    )
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function)
    )
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'wheel',
      expect.any(Function),
      { passive: false }
    )
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'contextmenu',
      expect.any(Function)
    )
  })

  // Test handleKeyDown
  it('should add key to activeKeys and prevent default if not input active', () => {
    const event = new KeyboardEvent('keydown', { code: 'KeyA' })
    Object.defineProperty(event, 'target', { value: mockHTMLElement }) // Not an input field
    event.preventDefault = preventDefaultSpy

    inputSystem['handleKeyDown'](event)

    expect(inputSystem['activeKeys'].has('KeyA')).toBe(true)
    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('should not prevent default if input field is active', () => {
    const event = new KeyboardEvent('keydown', { code: 'KeyA' })
    const inputElement = document.createElement('input')
    Object.defineProperty(event, 'target', { value: inputElement })
    event.preventDefault = preventDefaultSpy

    inputSystem['handleKeyDown'](event)

    expect(inputSystem['activeKeys'].has('KeyA')).toBe(true)
    expect(preventDefaultSpy).not.toHaveBeenCalled()
  })

  it('should start timer for non-modifier keys', () => {
    vi.mocked(KeyMapModule.default.isModifierKeys).mockReturnValue(false) // Mock as non-modifier
    const event = new KeyboardEvent('keydown', { code: 'KeyA' })
    Object.defineProperty(event, 'target', { value: mockHTMLElement })
    event.preventDefault = preventDefaultSpy

    inputSystem['handleKeyDown'](event)

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1)
    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      ConstantsModule.CLEAR_KEY_TIME
    )
  })

  it('should not start timer for modifier keys', () => {
    vi.mocked(KeyMapModule.default.isModifierKeys).mockReturnValue(true) // Mock as modifier
    const event = new KeyboardEvent('keydown', { code: 'ShiftLeft' })
    Object.defineProperty(event, 'target', { value: mockHTMLElement })
    event.preventDefault = preventDefaultSpy

    inputSystem['handleKeyDown'](event)

    expect(setTimeoutSpy).not.toHaveBeenCalled()
  })

  // Test handleKeyUp
  it('should remove key from activeKeys and clear timer', () => {
    inputSystem['activeKeys'].add('KeyA')
    const timerId = 123
    inputSystem['timers'].set('KeyA', timerId as unknown as NodeJS.Timeout)
    const event = new KeyboardEvent('keyup', { code: 'KeyA' })
    Object.defineProperty(event, 'target', { value: mockHTMLElement })
    event.preventDefault = preventDefaultSpy

    inputSystem['handleKeyUp'](event)

    expect(inputSystem['activeKeys'].has('KeyA')).toBe(false)
    expect(clearTimeoutSpy).toHaveBeenCalledWith(timerId)
    expect(inputSystem['timers'].has('KeyA')).toBe(false)
    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  // Test handleMouseDown
  it('should add mouse button key to activeKeys and set startPos', () => {
    const event = new MouseEvent('mousedown', {
      button: 0,
      clientX: 10,
      clientY: 20
    })
    Object.defineProperty(event, 'target', { value: mockHTMLElement })
    inputSystem['handleMouseDown'](event)

    expect(inputSystem['activeKeys'].has('leftMouseDown')).toBe(true)
    expect(inputSystem['_startPos']).toEqual({ clientX: 10, clientY: 20 })
  })

  // Test handleMouseUp
  it('should add mouse up key, remove mouse down key, and trigger checkCombinations', () => {
    inputSystem['activeKeys'].add('leftMouseDown')
    const event = new MouseEvent('mouseup', {
      button: 0,
      clientX: 10,
      clientY: 20
    })
    Object.defineProperty(event, 'target', { value: mockHTMLElement })
    inputSystem['handleMouseUp'](event)

    expect(inputSystem['activeKeys'].has('leftMouseUp')).toBe(true)
    expect(inputSystem['activeKeys'].has('leftMouseDown')).toBe(false)
  })

  // Test handleMouseMove
  it('should add mouse move key and trigger checkCombinations if dragging beyond threshold', () => {
    inputSystem['_startPos'] = { clientX: 0, clientY: 0 }
    const event = new MouseEvent('mousemove', {
      button: 0,
      clientX: 10,
      clientY: 10
    }) // Distance > CLICK_THRESHOLD (5)
    Object.defineProperty(event, 'target', { value: mockHTMLElement })
    inputSystem['handleMouseMove'](event)

    expect(inputSystem['activeKeys'].has('leftMouseMove')).toBe(true)
  })

  it('should not add mouse move key if dragging within threshold', () => {
    inputSystem['_startPos'] = { clientX: 0, clientY: 0 }
    const event = new MouseEvent('mousemove', {
      button: 0,
      clientX: 1,
      clientY: 1
    }) // Distance < CLICK_THRESHOLD (5)
    Object.defineProperty(event, 'target', { value: mockHTMLElement })
    inputSystem['handleMouseMove'](event)

    expect(inputSystem['activeKeys'].has('leftMouseMove')).toBe(false)
  })

  // Test handleWheel
  it('should prevent default and trigger checkCombinations for wheel event', () => {
    vi.mocked(KeyMapModule.default.isSpecialEvent).mockReturnValue(true) // Mock as special event
    const event = new WheelEvent('wheel', {
      deltaX: 10,
      deltaY: 20,
      clientX: 50,
      clientY: 60
    })
    Object.defineProperty(event, 'target', { value: mockHTMLElement })
    event.preventDefault = preventDefaultSpy

    inputSystem['handleWheel'](event)

    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(inputSystem['activeKeys'].has('wheel')).toBe(false) // Should be removed immediately
  })

  // Test getActiveModifiers
  it('should return active modifier keys', () => {
    inputSystem['activeKeys'].add('ShiftLeft')
    inputSystem['activeKeys'].add('KeyA')
    inputSystem['activeKeys'].add('ControlLeft')
    vi.mocked(KeyMapModule.default.isModifierKeys).mockImplementation(
      (key: string) => ['ShiftLeft', 'ControlLeft'].includes(key)
    )

    const modifiers = inputSystem.getActiveModifiers(inputSystem['activeKeys'])
    expect(modifiers).toEqual(['shiftleft', 'controlleft'])
  })

  // Test getAllModifiers
  it('should return all modifier keys status', () => {
    const activeModifiers: ModifierKey[] = ['shift', 'alt']
    const allModifiers = inputSystem.getAllModifiers(activeModifiers)
    expect(allModifiers).toEqual({
      meta: false,
      ctrl: false,
      alt: true,
      shift: true
    })
  })

  // Test checkCombinations and triggerAction
  it('should trigger action for matching combination', () => {
    const triggerActionSpy = vi.spyOn(inputSystem, 'triggerAction' as any)
    inputSystem['activeKeys'].add('KeyA')
    vi.mocked(EventMappingsModule).InputEventMappings = {
      [InputSystemEvents.INPUT_KEYBOARD_A]: [
        { type: InputType.KEYBOARD, keys: ['KeyA'], modifiers: [] }
      ]
    }

    inputSystem['checkCombinations'](InputType.KEYBOARD)

    expect(triggerActionSpy).toHaveBeenCalledTimes(1)
    expect(triggerActionSpy).toHaveBeenCalledWith(
      InputSystemEvents.INPUT_KEYBOARD_A,
      expect.objectContaining({
        type: InputType.KEYBOARD,
        keys: ['KeyA']
      })
    )
  })

  it('should not trigger action for non-matching combination', () => {
    const triggerActionSpy = vi.spyOn(inputSystem, 'triggerAction' as any)
    inputSystem['activeKeys'].add('KeyB') // Active key is B
    vi.mocked(EventMappingsModule).InputEventMappings = {
      [InputSystemEvents.INPUT_KEYBOARD_A]: [
        { type: InputType.KEYBOARD, keys: ['KeyA'], modifiers: [] } // Mapping is for A
      ]
    }

    inputSystem['checkCombinations'](InputType.KEYBOARD)

    expect(triggerActionSpy).not.toHaveBeenCalled()
  })

  it('should trigger action with detail if provided in combo', () => {
    const triggerActionSpy = vi.spyOn(inputSystem, 'triggerAction' as any)
    inputSystem['activeKeys'].add('KeyA')
    const mockDetail = { some: 'detail' }
    vi.mocked(EventMappingsModule).InputEventMappings = {
      [InputSystemEvents.INPUT_KEYBOARD_A]: [
        {
          type: InputType.KEYBOARD,
          keys: ['KeyA'],
          modifiers: [],
          detail: mockDetail
        }
      ]
    }

    inputSystem['checkCombinations'](InputType.KEYBOARD)

    expect(triggerActionSpy).toHaveBeenCalledWith(
      InputSystemEvents.INPUT_KEYBOARD_A,
      expect.objectContaining({
        detail: mockDetail
      })
    )
  })

  it('should call registered listeners when triggerAction is called', () => {
    const listener1 = vi.fn()
    const listener2 = vi.fn()
    inputSystem.on(InputSystemEvents.INPUT_KEYBOARD_A, listener1)
    inputSystem.on(InputSystemEvents.INPUT_KEYBOARD_A, listener2)

    const rawEvent: RawInputEvent = {
      type: InputType.KEYBOARD,
      keys: ['KeyA'],
      modifiers: { meta: false, ctrl: false, alt: false, shift: false },
      pointer: {} as PointerEventData
    }
    inputSystem['triggerAction'](InputSystemEvents.INPUT_KEYBOARD_A, rawEvent)

    expect(listener1).toHaveBeenCalledTimes(1)
    expect(listener1).toHaveBeenCalledWith(rawEvent)
    expect(listener2).toHaveBeenCalledTimes(1)
    expect(listener2).toHaveBeenCalledWith(rawEvent)
  })

  it('should handle async listeners correctly', async () => {
    const asyncListener = vi.fn(() => Promise.resolve())
    inputSystem.on(InputSystemEvents.INPUT_KEYBOARD_A, asyncListener)

    const rawEvent: RawInputEvent = {
      type: InputType.KEYBOARD,
      keys: ['KeyA'],
      modifiers: { meta: false, ctrl: false, alt: false, shift: false },
      pointer: {} as PointerEventData
    }
    await inputSystem['triggerAction'](
      InputSystemEvents.INPUT_KEYBOARD_A,
      rawEvent
    )

    expect(asyncListener).toHaveBeenCalledTimes(1)
  })

  it('should catch errors in async listeners', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      /* no-op */
    })
    const asyncListener = vi.fn(() => Promise.reject('Test Error'))
    inputSystem.on(InputSystemEvents.INPUT_KEYBOARD_A, asyncListener)

    const rawEvent: RawInputEvent = {
      type: InputType.KEYBOARD,
      keys: ['KeyA'],
      modifiers: { meta: false, ctrl: false, alt: false, shift: false },
      pointer: {} as PointerEventData
    }
    await inputSystem['triggerAction'](
      InputSystemEvents.INPUT_KEYBOARD_A,
      rawEvent
    )

    expect(asyncListener).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      'Error in async input system callback:',
      'Test Error'
    )
    errorSpy.mockRestore()
  })
})
