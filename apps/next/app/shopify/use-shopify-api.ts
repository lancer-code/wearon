'use client'

import { useAppBridge } from '@shopify/app-bridge-react'
import { useCallback, useMemo } from 'react'
import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api/shopify/store',
  timeout: 15000,
})

export function useShopifyApi() {
  const shopify = useAppBridge()

  const get = useCallback(
    async <T = unknown>(path: string): Promise<T> => {
      const token = await shopify.idToken()
      const response = await apiClient.get(path, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data as T
    },
    [shopify]
  )

  const post = useCallback(
    async <T = unknown>(path: string, data?: unknown): Promise<T> => {
      const token = await shopify.idToken()
      const response = await apiClient.post(path, data, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data as T
    },
    [shopify]
  )

  const patch = useCallback(
    async <T = unknown>(path: string, data?: unknown): Promise<T> => {
      const token = await shopify.idToken()
      const response = await apiClient.patch(path, data, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data as T
    },
    [shopify]
  )

  return useMemo(() => ({ get, post, patch }), [get, post, patch])
}
