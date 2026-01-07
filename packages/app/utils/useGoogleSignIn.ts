import { useState } from 'react'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { useSupabase } from '../provider/SupabaseProvider'

export function useGoogleSignIn() {
  const { supabase } = useSupabase()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signInWithGoogle = async () => {
    try {
      setLoading(true)
      setError(null)

      // Configure Google Sign-In
      GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        offlineAccess: true,
      })

      // Check if device supports Google Play Services
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })

      // Sign in with Google
      const userInfo = await GoogleSignin.signIn()

      // Get ID token
      const tokens = await GoogleSignin.getTokens()

      if (!tokens.idToken) {
        throw new Error('No ID token received from Google')
      }

      // Sign in to Supabase with Google ID token
      const { data, error: supabaseError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: tokens.idToken,
      })

      if (supabaseError) {
        throw supabaseError
      }

      return {
        user: data.user,
        session: data.session,
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err)

      let errorMessage = 'Failed to sign in with Google'

      if (err.code === 'SIGN_IN_CANCELLED') {
        errorMessage = 'Sign in cancelled'
      } else if (err.code === 'IN_PROGRESS') {
        errorMessage = 'Sign in already in progress'
      } else if (err.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        errorMessage = 'Google Play Services not available'
      } else if (err.message) {
        errorMessage = err.message
      }

      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      setError(null)

      // Sign out from Google
      await GoogleSignin.signOut()

      // Sign out from Supabase
      await supabase.auth.signOut()
    } catch (err: any) {
      console.error('Sign Out Error:', err)
      setError(err.message || 'Failed to sign out')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const getCurrentUser = async () => {
    try {
      const isSignedIn = await GoogleSignin.isSignedIn()
      if (isSignedIn) {
        return await GoogleSignin.getCurrentUser()
      }
      return null
    } catch (err) {
      console.error('Get Current User Error:', err)
      return null
    }
  }

  return {
    signInWithGoogle,
    signOut,
    getCurrentUser,
    loading,
    error,
  }
}
