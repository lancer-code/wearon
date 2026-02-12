function keyToSnakeCase(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
}

function keyToCamelCase(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase())
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
}

export function toSnakeCase<T>(obj: T): T {
  if (!isPlainObject(obj)) {
    if (Array.isArray(obj)) {
      return obj.map((item) => toSnakeCase(item)) as T
    }
    return obj
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[keyToSnakeCase(key)] = toSnakeCase(value)
  }
  return result as T
}

export function toCamelCase<T>(obj: T): T {
  if (!isPlainObject(obj)) {
    if (Array.isArray(obj)) {
      return obj.map((item) => toCamelCase(item)) as T
    }
    return obj
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[keyToCamelCase(key)] = toCamelCase(value)
  }
  return result as T
}
