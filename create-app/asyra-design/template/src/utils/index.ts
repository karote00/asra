/**
 * Converts a given number to the corresponding Tailwind CSS size.
 * @param size
 * @returns The calculated size in pixels
 * @throws If the input is invalid or less than 0, an error is thrown.
 */
export const realSize = (size: number): number => {
  if (typeof size !== 'number' || size < 0) {
    throw new Error('Invalid size: must be a non-negative number.')
  }

  return size * 4
}
