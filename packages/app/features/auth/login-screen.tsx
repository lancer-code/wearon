'use client'

import { useState } from 'react'
import {
  Button,
  Input,
  YStack,
  XStack,
  Text,
  Separator,
  Spinner,
  Anchor,
  useToastController,
} from '@my/ui'
import { useLink } from 'solito/navigation'
import { AuthFormContainer } from './auth-form-container'
import { GoogleSignInButton } from './google-sign-in-button'
import { supabase } from '../../utils/supabase'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToastController()

  const signupLink = useLink({ href: '/signup' })

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      toast.show('Please fill in all fields', { type: 'error' })
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      toast.show('Welcome back!', { type: 'success' })
      // Redirect will happen via auth state change listener
    } catch (error) {
      toast.show((error as Error).message, { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleError = (error: Error) => {
    toast.show(error.message || 'Failed to sign in with Google', { type: 'error' })
  }

  return (
    <AuthFormContainer>
      {/* Header */}
      <YStack gap="$2" marginBottom="$2">
        <Text fontSize="$8" fontWeight="700" color="$color12" textAlign="center">
          Welcome back
        </Text>
        <Text fontSize="$4" color="$color10" textAlign="center">
          Sign in to continue to WearOn
        </Text>
      </YStack>

      {/* Google Sign In */}
      <GoogleSignInButton mode="signin" onError={handleGoogleError} />

      {/* Divider */}
      <XStack items="center" gap="$4">
        <Separator flex={1} />
        <Text fontSize="$3" color="$color10">
          or continue with email
        </Text>
        <Separator flex={1} />
      </XStack>

      {/* Email Form */}
      <YStack gap="$4">
        <YStack gap="$2">
          <Text fontSize="$3" fontWeight="500" color="$color11">
            Email
          </Text>
          <Input
            size="$5"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.nativeEvent.text)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </YStack>

        <YStack gap="$2">
          <XStack justify="space-between" items="center">
            <Text fontSize="$3" fontWeight="500" color="$color11">
              Password
            </Text>
            <Anchor
              fontSize="$2"
              color="$blue10"
              href="/forgot-password"
            >
              Forgot password?
            </Anchor>
          </XStack>
          <Input
            size="$5"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.nativeEvent.text)}
            secureTextEntry
            autoComplete="password"
          />
        </YStack>

        <Button
          size="$5"
          theme="blue"
          onPress={handleEmailSignIn}
          disabled={loading}
        >
          {loading ? <Spinner size="small" color="$color" /> : 'Sign In'}
        </Button>
      </YStack>

      {/* Sign Up Link */}
      <XStack justify="center" gap="$2">
        <Text fontSize="$3" color="$color10">
          Don't have an account?
        </Text>
        <Text
          fontSize="$3"
          color="$blue10"
          fontWeight="500"
          cursor="pointer"
          {...signupLink}
        >
          Sign up
        </Text>
      </XStack>
    </AuthFormContainer>
  )
}
