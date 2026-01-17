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
import { useLink, useRouter } from 'solito/navigation'
import { z } from 'zod'
import { AuthFormContainer } from './auth-form-container'
import { GoogleSignInButton } from './google-sign-in-button'
import { supabase } from '../../utils/supabase'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const toast = useToastController()
  const router = useRouter()

  const signupLink = useLink({ href: '/signup' })

  const handleEmailSignIn = async () => {
    setErrors({})

    const result = loginSchema.safeParse({ email, password })

    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {}
      for (const error of result.error.errors) {
        if (error.path[0] === 'email') fieldErrors.email = error.message
        if (error.path[0] === 'password') fieldErrors.password = error.message
      }
      setErrors(fieldErrors)
      toast.show(result.error.errors[0].message, { type: 'error' })
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Login error:', error)
        throw error
      }

      toast.show('Welcome back!', { type: 'success' })
      router.push('/dashboard')
    } catch (error) {
      console.error('Login failed:', error)
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
            onChange={(e: any) => setEmail(e.target?.value ?? e.nativeEvent?.text ?? '')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            borderColor={errors.email ? '$red10' : undefined}
          />
          {errors.email && (
            <Text fontSize="$2" color="$red10">{errors.email}</Text>
          )}
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
            onChange={(e: any) => setPassword(e.target?.value ?? e.nativeEvent?.text ?? '')}
            secureTextEntry
            autoComplete="password"
            borderColor={errors.password ? '$red10' : undefined}
          />
          {errors.password && (
            <Text fontSize="$2" color="$red10">{errors.password}</Text>
          )}
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
