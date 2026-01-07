import { Button, Spinner, XStack, Text } from '@my/ui'
import { useGoogleSignIn } from '../utils/useGoogleSignIn'
import { useRouter } from 'solito/router'

interface GoogleSignInButtonProps {
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function GoogleSignInButton({ onSuccess, onError }: GoogleSignInButtonProps) {
  const { signInWithGoogle, loading, error } = useGoogleSignIn()
  const router = useRouter()

  const handlePress = async () => {
    try {
      const result = await signInWithGoogle()
      console.log('Google Sign-In Success:', result.user?.email)

      if (onSuccess) {
        onSuccess()
      } else {
        // Navigate to home screen by default
        router.push('/')
      }
    } catch (err: any) {
      console.error('Google Sign-In Failed:', err.message)
      if (onError) {
        onError(err.message)
      }
    }
  }

  return (
    <XStack gap="$2" alignItems="center">
      <Button
        onPress={handlePress}
        disabled={loading}
        size="$4"
        theme="blue"
        icon={loading ? <Spinner /> : undefined}
        width="100%"
      >
        {loading ? 'Signing in...' : 'Continue with Google'}
      </Button>
      {error && (
        <Text color="$red10" fontSize="$2">
          {error}
        </Text>
      )}
    </XStack>
  )
}
