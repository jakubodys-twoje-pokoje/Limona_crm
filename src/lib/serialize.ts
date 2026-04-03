/**
 * Recursively convert Prisma Decimal fields to numbers and Date to ISO strings
 * for JSON serialization in API responses.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') {
    return obj.toNumber()
  }
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serialize(value)
    }
    return result
  }
  return obj
}
