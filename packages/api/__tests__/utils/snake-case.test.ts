import { describe, expect, it } from 'vitest'
import { toCamelCase, toSnakeCase } from '../../src/utils/snake-case'

describe('toSnakeCase', () => {
  it('converts flat camelCase object keys', () => {
    const input = { storeId: 'abc', createdAt: '2026-01-01' }
    const result = toSnakeCase(input)
    expect(result).toEqual({ store_id: 'abc', created_at: '2026-01-01' })
  })

  it('converts nested objects', () => {
    const input = { userData: { firstName: 'John', lastName: 'Doe' } }
    const result = toSnakeCase(input)
    expect(result).toEqual({ user_data: { first_name: 'John', last_name: 'Doe' } })
  })

  it('converts arrays of objects', () => {
    const input = { items: [{ itemName: 'a' }, { itemName: 'b' }] }
    const result = toSnakeCase(input)
    expect(result).toEqual({ items: [{ item_name: 'a' }, { item_name: 'b' }] })
  })

  it('handles consecutive capitals (apiURL → api_url)', () => {
    const input = { apiURL: 'https://example.com' }
    const result = toSnakeCase(input)
    expect(result).toEqual({ api_url: 'https://example.com' })
  })

  it('passes through primitives', () => {
    expect(toSnakeCase('hello')).toBe('hello')
    expect(toSnakeCase(42)).toBe(42)
    expect(toSnakeCase(true)).toBe(true)
  })

  it('passes through null and undefined', () => {
    expect(toSnakeCase(null)).toBe(null)
    expect(toSnakeCase(undefined)).toBe(undefined)
  })

  it('handles empty objects', () => {
    expect(toSnakeCase({})).toEqual({})
  })

  it('handles arrays at top level', () => {
    const input = [{ storeId: 'a' }, { storeId: 'b' }]
    const result = toSnakeCase(input)
    expect(result).toEqual([{ store_id: 'a' }, { store_id: 'b' }])
  })

  it('does NOT convert values, only keys', () => {
    const input = { myKey: 'myValue', anotherKey: 'camelCaseValue' }
    const result = toSnakeCase(input)
    expect(result).toEqual({ my_key: 'myValue', another_key: 'camelCaseValue' })
  })

  it('handles already-snake_case keys (passthrough)', () => {
    const input = { store_id: 'abc', created_at: '2026-01-01' }
    const result = toSnakeCase(input)
    expect(result).toEqual({ store_id: 'abc', created_at: '2026-01-01' })
  })
})

describe('toCamelCase', () => {
  it('converts flat snake_case object keys', () => {
    const input = { store_id: 'abc', created_at: '2026-01-01' }
    const result = toCamelCase(input)
    expect(result).toEqual({ storeId: 'abc', createdAt: '2026-01-01' })
  })

  it('converts nested objects', () => {
    const input = { user_data: { first_name: 'John', last_name: 'Doe' } }
    const result = toCamelCase(input)
    expect(result).toEqual({ userData: { firstName: 'John', lastName: 'Doe' } })
  })

  it('converts arrays of objects', () => {
    const input = { items: [{ item_name: 'a' }, { item_name: 'b' }] }
    const result = toCamelCase(input)
    expect(result).toEqual({ items: [{ itemName: 'a' }, { itemName: 'b' }] })
  })

  it('passes through primitives', () => {
    expect(toCamelCase('hello')).toBe('hello')
    expect(toCamelCase(42)).toBe(42)
  })

  it('passes through null and undefined', () => {
    expect(toCamelCase(null)).toBe(null)
    expect(toCamelCase(undefined)).toBe(undefined)
  })

  it('handles empty objects', () => {
    expect(toCamelCase({})).toEqual({})
  })

  it('handles already-camelCase keys (passthrough)', () => {
    const input = { storeId: 'abc', createdAt: '2026-01-01' }
    const result = toCamelCase(input)
    expect(result).toEqual({ storeId: 'abc', createdAt: '2026-01-01' })
  })
})

describe('roundtrip conversion', () => {
  it('toCamelCase(toSnakeCase(obj)) equals original for standard keys', () => {
    const original = {
      storeId: 'abc',
      createdAt: '2026-01-01',
      creditBalance: 100,
      nested: {
        firstName: 'John',
        lastName: 'Doe',
      },
    }
    const result = toCamelCase(toSnakeCase(original))
    expect(result).toEqual(original)
  })

  it('toSnakeCase(toCamelCase(obj)) equals original for standard keys', () => {
    const original = {
      store_id: 'abc',
      created_at: '2026-01-01',
      credit_balance: 100,
      nested: {
        first_name: 'John',
        last_name: 'Doe',
      },
    }
    const result = toSnakeCase(toCamelCase(original))
    expect(result).toEqual(original)
  })
})
