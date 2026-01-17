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
  useToastController,
} from '@my/ui'
import { useLink } from 'solito/navigation'
import { AuthFormContainer } from './auth-form-container'
import { GoogleSignInButton } from './google-sign-in-button'
import { supabase } from '../../utils/supabase'

export function SignupScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToastController()

  const loginLink = useLink({ href: '/login' })

  const handleEmailSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      toast.show('Please fill in all fields', { type: 'error' })
      return
    }

    if (password !== confirmPassword) {
      toast.show('Passwords do not match', { type: 'error' })
      return
    }

    if (password.length < 6) {
      toast.show('Password must be at least 6 characters', { type: 'error' })
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        throw error
      }

      toast.show('Check your email to confirm your account', { type: 'success' })
    } catch (error) {
      toast.show((error as Error).message, { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleError = (error: Error) => {
    toast.show(error.message || 'Failed to sign up with Google', { type: 'error' })
  }

  return (
    <AuthFormContainer>
      {/* Header */}
      <YStack gap="$2" marginBottom="$2">
        <Text fontSize="$8" fontWeight="700" color="$color12" textAlign="center">
          Create account
        </Text>
        <Text fontSize="$4" color="$color10" textAlign="center">
          Sign up to get started with WearOn
        </Text>
      </YStack>

      {/* Google Sign Up */}
      <GoogleSignInButton mode="signup" onError={handleGoogleError} />

      {/* Divider */}
      <XStack items="center" gap="$4">
        <Separator flex={1} />
        <Text fontSize="$3" color="$color10">
          or sign up with email
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
          <Text fontSize="$3" fontWeight="500" color="$color11">
            Password
          </Text>
          <Input
            size="$5"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.nativeEvent.text)}
            secureTextEntry
            autoComplete="new-password"
          />
        </YStack>

        <YStack gap="$2">
          <Text fontSize="$3" fontWeight="500" color="$color11">
            Confirm Password
          </Text>
          <Input
            size="$5"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.nativeEvent.text)}
            secureTextEntry
            autoComplete="new-password"
          />
        </YStack>

        <Button
          size="$5"
          theme="blue"
          onPress={handleEmailSignUp}
          disabled={loading}
        >
          {loading ? <Spinner size="small" color="$color" /> : 'Create Account'}
        </Button>
      </YStack>

      {/* Sign In Link */}
      <XStack justify="center" gap="$2">
        <Text fontSize="$3" color="$color10">
          Already have an account?
        </Text>
        <Text
          fontSize="$3"
          color="$blue10"
          fontWeight="500"
          cursor="pointer"
          {...loginLink}
        >
          Sign in
        </Text>
      </XStack>
    </AuthFormContainer>
  )
}
