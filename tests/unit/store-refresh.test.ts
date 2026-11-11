/// <reference types="bun-types" />

import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import type { BootstrapData } from '../../src/lib/store'

const originalFetch = globalThis.fetch
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const storedValues = new Map<string, string>()

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storedValues.get(key) ?? null,
    setItem: (key: string, value: string) => storedValues.set(key, value),
    removeItem: (key: string) => storedValues.delete(key),
    clear: () => storedValues.clear(),
    key: (index: number) => Array.from(storedValues.keys())[index] ?? null,
    get length() {
      return storedValues.size
    },
  },
})

const { useApp } = await import('../../src/lib/store')

function replaceFetch(
  implementation: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>
) {
  globalThis.fetch = Object.assign(implementation, {
    preconnect: originalFetch.preconnect,
  })
}

afterEach(() => {
  globalThis.fetch = originalFetch
  storedValues.clear()
  useApp.setState({
    data: null,
    loading: false,
    refreshError: null,
    role: 'creator',
    userName: 'Signed-in user',
  })
})

afterAll(() => {
  if (originalStorage) {
    Object.defineProperty(globalThis, 'localStorage', originalStorage)
  } else {
    Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

describe('workspace refresh', () => {
  test('deduplicates concurrent requests and stores the latest workspace snapshot', async () => {
    let requestCount = 0
    const data: BootstrapData = {
      vault: [],
      drafts: [],
      audits: {},
      events: [],
    }

    replaceFetch(async () => {
      requestCount++
      await new Promise((resolve) => setTimeout(resolve, 10))
      return Response.json(data)
    })

    await Promise.all([useApp.getState().refresh(), useApp.getState().refresh()])

    expect(requestCount).toBe(1)
    expect(useApp.getState().data).toEqual(data)
    expect(useApp.getState().refreshError).toBeNull()
    expect(useApp.getState().loading).toBe(false)
  })

  test('surfaces HTTP failures and always clears the loading state', async () => {
    replaceFetch(async () => new Response(null, { status: 503 }))

    await useApp.getState().refresh()

    expect(useApp.getState().refreshError).toContain('HTTP 503')
    expect(useApp.getState().loading).toBe(false)
  })

  test('keeps the previous snapshot visible when the network is unavailable', async () => {
    const previousData: BootstrapData = {
      vault: [],
      drafts: [],
      audits: {},
      events: [],
    }
    useApp.setState({ data: previousData })
    replaceFetch(async () => {
      throw new Error('Network unavailable')
    })

    await useApp.getState().refresh()

    expect(useApp.getState().data).toBe(previousData)
    expect(useApp.getState().refreshError).toBe('Network unavailable')
    expect(useApp.getState().loading).toBe(false)
  })
})
