export const isNumber = (val: string | number): boolean => isFinite(Number(val))

export const arrEqual = <T>(a: T[], b: T[]): boolean => {
  if (a.length !== b.length) return false
  return a.every((c, idx) => b[idx] === c)
}
