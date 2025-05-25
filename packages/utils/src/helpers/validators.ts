export const isNumber = (val: string | number): boolean => isFinite(Number(val))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const arrEqual = (a: any[], b: any[]) => {
  if (a.length !== b.length) return false
  return a.every((c, idx) => b[idx] === c)
}
