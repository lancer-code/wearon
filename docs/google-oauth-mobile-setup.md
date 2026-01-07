# Google OAuth Mobile Setup - Quick Guide

This guide shows how to use Google Sign-In in your WearOn mobile app.

## Prerequisites

You must have completed the Google Cloud Console setup from [google-oauth-setup.md](google-oauth-setup.md) first.

## Required Client IDs

You need THREE OAuth Client IDs from Google Cloud Console:

1. **Web Client ID** - For Supabase backend
2. **Android Client ID** - For Android app
3. **iOS Client ID** - For iOS app (optional for now)

## Setup Steps

### 1. Update Environment Variables

Edit `apps/expo/.env` and add your Google Client IDs:

```env
# Get these from: https://console.cloud.google.com/apis/credentials
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-abc123.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=123456789-android.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789-ios.apps.googleusercontent.com
```

### 2. Configure Supabase

In your Supabase Dashboard:

1. Go to **Authentication** → **Providers** → **Google**
2. Enable Google provider
3. **Client ID**: Paste your **Web Client ID**
4. **Client Secret**: Paste your **Web Client Secret**
5. **Authorized Client IDs**: Add your **Android Client ID** (one per line)
6. Click **Save**

### 3. Rebuild Native Project

```bash
cd apps/expo
npx expo prebuild --clean
```

This generates the native Android/iOS projects with Google Sign-In configured.

## Usage in Your App

### Basic Usage

```typescript
import { GoogleSignInButton } from '@my/app/components/GoogleSignInButton'

export function LoginScreen() {
  return (
    <GoogleSignInButton
      onSuccess={() => {
        console.log('Signed in successfully!')
        // Navigate to home screen
      }}
      onError={(error) => {
        console.error('Sign in failed:', error)
      }}
    />
  )
}
```

### Advanced Usage with Hook

```typescript
import { useGoogleSignIn } from '@my/app/utils/useGoogleSignIn'

export function CustomLoginScreen() {
  const { signInWithGoogle, loading, error } = useGoogleSignIn()

  const handleSignIn = async () => {
    try {
      const result = await signInWithGoogle()
      console.log('User:', result.user)
      console.log('Session:', result.session)
    } catch (err) {
      console.error('Failed:', err)
    }
  }

  return (
    <Button onPress={handleSignIn} disabled={loading}>
      {loading ? 'Signing in...' : 'Sign in with Google'}
    </Button>
  )
}
```

## Testing

### Android Testing

1. Build the app:
   ```bash
   cd apps/expo
   npx expo run:android
   ```

2. Tap "Continue with Google"
3. Select your Google account
4. Grant permissions
5. You should be signed in!

### iOS Testing

1. Build the app:
   ```bash
   cd apps/expo
   npx expo run:ios
   ```

2. Follow the same steps as Android

## Troubleshooting

### "Developer Error" on Sign-In

**Cause**: SHA-1 fingerprint mismatch or package name incorrect

**Fix**:
1. Get your SHA-1: `cd apps/expo && ./get-sha-keys.sh`
2. Verify it matches in Google Cloud Console
3. Verify package name is `com.umperasofts.wearon`

### "Sign in cancelled" Error

**Cause**: User cancelled or Google Play Services issue

**Fix**:
- Make sure Google Play Services is installed on device/emulator
- Try on a real device

### "No ID token received"

**Cause**: Web Client ID not configured correctly

**Fix**:
1. Verify `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env`
2. Make sure you're using the **Web Client ID**, not Android Client ID
3. Rebuild: `npx expo prebuild --clean`

### Module Not Found Error

**Cause**: Native modules not linked properly

**Fix**:
```bash
cd apps/expo
rm -rf android ios node_modules
yarn install
npx expo prebuild --clean
```

## Files Created

- `packages/app/utils/useGoogleSignIn.ts` - Google Sign-In hook
- `packages/app/components/GoogleSignInButton.tsx` - Ready-to-use button component
- `apps/expo/.env` - Environment variables with Client IDs

## API Reference

### `useGoogleSignIn()` Hook

Returns:
- `signInWithGoogle()` - Async function to sign in
- `signOut()` - Async function to sign out
- `getCurrentUser()` - Get current Google user info
- `loading` - Boolean, true during sign-in
- `error` - String or null, error message if sign-in fails

### `<GoogleSignInButton />` Component

Props:
- `onSuccess?: () => void` - Called after successful sign-in
- `onError?: (error: string) => void` - Called on sign-in error

## Next Steps

1. Get your Google Client IDs from Google Cloud Console
2. Update `apps/expo/.env` with the Client IDs
3. Configure Supabase Google provider
4. Rebuild the app: `npx expo prebuild --clean`
5. Test on device or emulator

## SHA Keys Reference

**Package:** `com.umperasofts.wearon`

**Debug SHA-1:** `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

To regenerate: `./apps/expo/get-sha-keys.sh`

## Resources

- [React Native Google Sign-In Docs](https://react-native-google-signin.github.io/docs/)
- [Supabase Google Auth Guide](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
