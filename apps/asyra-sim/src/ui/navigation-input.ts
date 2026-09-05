export type NavigationInput = 'trackpad' | 'mouse'
const preferenceKey = 'asyra-sim.navigation-input'

/** Device preference only; it never belongs to a project or Undo history. */
export function readNavigationInput(): NavigationInput {
  try {
    if (localStorage.getItem(preferenceKey) === 'mouse') return 'mouse'
  } catch {
    /* Navigation remains usable without browser storage. */
  }
  return 'trackpad'
}

export function saveNavigationInput(value: NavigationInput): void {
  try {
    localStorage.setItem(preferenceKey, value)
  } catch {
    /* The current session still uses the user's selected input mode. */
  }
}
