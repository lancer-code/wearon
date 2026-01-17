'use client'

import { XStack, YStack, Image } from '@my/ui'
import type { ReactNode } from 'react'
import { Platform } from 'react-native'

interface AuthFormContainerProps {
  children: ReactNode
}

export function AuthFormContainer({ children }: AuthFormContainerProps) {
  return (
    <XStack flex={1} minHeight="100vh" bg="$background">
      {/* Left: Form Section */}
      <YStack
        flex={1}
        padding="$6"
        justify="center"
        items="center"
      >
        <YStack width="100%" maxWidth={400} gap="$6">
          {/* Logo */}
          <YStack items="center" marginBottom="$4">
            {Platform.OS === 'web' ? (
              <img
                src="/logo.png"
                alt="WearOn"
                style={{ width: 140, height: 'auto' }}
              />
            ) : (
              <Image
                source={{ uri: '/logo.png' }}
                width={140}
                height={50}
                resizeMode="contain"
              />
            )}
          </YStack>

          {children}
        </YStack>
      </YStack>

      {/* Right: Fashion Illustration (hidden on mobile/tablet via CSS) */}
      {Platform.OS === 'web' && (
        <div
          className="auth-illustration-panel"
          style={{
            flex: 1,
            overflow: 'hidden',
            backgroundColor: 'var(--blue2)',
          }}
        >
          <style>{`
            .auth-illustration-panel {
              display: none;
            }
            @media (min-width: 900px) {
              .auth-illustration-panel {
                display: flex;
              }
            }
          `}</style>
          <img
            src="/auth-illustration.png"
            alt="Fashion illustration"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>
      )}
    </XStack>
  )
}
