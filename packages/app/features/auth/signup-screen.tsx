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
import { useLink, useRouter } from 'solito/navigation'
import { z } from 'zod'
import { AuthFormContainer } from './auth-form-container'
import { GoogleSignInButton } from './google-sign-in-button'
import { supabase } from '../../utils/supabase'

const signupSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type SignupErrors = {
  email?: string
  password?: string
  confirmPassword?: string
}

export function SignupScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<SignupErrors>({})
  const toast = useToastController()
  const router = useRouter()

  const loginLink = useLink({ href: '/login' })

  const handleEmailSignUp = async () => {
    setErrors({})

    const result = signupSchema.safeParse({ email, password, confirmPassword })

    if (!result.success) {
      const fieldErrors: SignupErrors = {}
      for (const error of result.error.errors) {
        const field = error.path[0] as keyof SignupErrors
        if (field) fieldErrors[field] = error.message
      }
      setErrors(fieldErrors)
      toast.show(result.error.errors[0].message, { type: 'error' })
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        console.error('Signup error:', error)
        throw error
      }

      toast.show('Account created successfully!', { type: 'success' })
      router.push('/dashboard')
    } catch (error) {
      console.error('Signup failed:', error)
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
          <Text fontSize="$3" fontWeight="500" color="$color11">
            Password
          </Text>
          <Input
            size="$5"
            placeholder="Create a password"
            value={password}
            onChange={(e: any) => setPassword(e.target?.value ?? e.nativeEvent?.text ?? '')}
            secureTextEntry
            autoComplete="new-password"
            borderColor={errors.password ? '$red10' : undefined}
          />
          {errors.password && (
            <Text fontSize="$2" color="$red10">{errors.password}</Text>
          )}
        </YStack>

        <YStack gap="$2">
          <Text fontSize="$3" fontWeight="500" color="$color11">
            Confirm Password
          </Text>
          <Input
            size="$5"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e: any) => setConfirmPassword(e.target?.value ?? e.nativeEvent?.text ?? '')}
            secureTextEntry
            autoComplete="new-password"
            borderColor={errors.confirmPassword ? '$red10' : undefined}
          />
          {errors.confirmPassword && (
            <Text fontSize="$2" color="$red10">{errors.confirmPassword}</Text>
          )}
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
