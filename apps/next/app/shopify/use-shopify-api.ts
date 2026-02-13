'use client'

import { useAppBridge } from '@shopify/app-bridge-react'
import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api/shopify/store',
  timeout: 15000,
})

export function useShopifyApi() {
  const shopify = useAppBridge()
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    async function fetchToken() {
      try {
        const sessionToken = await shopify.idToken()
        setToken(sessionToken)
      } catch {
        // App Bridge not ready yet
      }
    }
    fetchToken()
  }, [shopify])

  const authHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [token])

  const get = useCallback(
    async <T = unknown>(path: string): Promise<T> => {
      const freshToken = await shopify.idToken()
      const response = await apiClient.get(path, {
        headers: { Authorization: `Bearer ${freshToken}` },
      })
      return response.data as T
    },
    [shopify]
  )

  const post = useCallback(
    async <T = unknown>(path: string, data?: unknown): Promise<T> => {
      const freshToken = await shopify.idToken()
      const response = await apiClient.post(path, data, {
        headers: { Authorization: `Bearer ${freshToken}` },
      })
      return response.data as T
    },
    [shopify]
  )

  const patch = useCallback(
    async <T = unknown>(path: string, data?: unknown): Promise<T> => {
      const freshToken = await shopify.idToken()
      const response = await apiClient.patch(path, data, {
        headers: { Authorization: `Bearer ${freshToken}` },
      })
      return response.data as T
    },
    [shopify]
  )

  return { get, post, patch, token, authHeaders, isReady: !!token }
}
