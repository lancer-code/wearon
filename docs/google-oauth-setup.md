# Google OAuth Setup Guide

Complete guide to set up Google Sign-In for WearOn app.

## Generated SHA Keys

**Package Name:** `com.umperasofts.wearon`

**Debug SHA-1:** `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

**Debug SHA-256:** `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`

---

## Part 1: Google Cloud Console Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Project name: `WearOn` (or your preferred name)

### Step 2: Enable Google+ API

1. Go to **APIs & Services** > **Library**
2. Search for "Google+ API"
3. Click **Enable**

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type
3. Fill in required fields:
   - **App name:** WearOn
   - **User support email:** Your email
   - **Developer contact email:** Your email
4. Add scopes:
   - `./auth/userinfo.email`
   - `./auth/userinfo.profile`
   - `openid`
5. Save and continue

### Step 4: Create OAuth 2.0 Credentials

#### A. Web Client ID (for Supabase)

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Application type: **Web application**
4. Name: `WearOn Web Client`
5. **Authorized JavaScript origins:**
   ```
   https://ljilupbgmrizblkzokfa.supabase.co
   ```
6. **Authorized redirect URIs:**
   ```
   https://ljilupbgmrizblkzokfa.supabase.co/auth/v1/callback
   ```
7. Click **Create**
8. **Save the Client ID** - you'll need it for Supabase

#### B. Android Client ID

1. Click **Create Credentials** > **OAuth client ID**
2. Application type: **Android**
3. Name: `WearOn Android`
4. **Package name:** `com.umperasofts.wearon`
5. **SHA-1 certificate fingerprint:**
   ```
   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
   ```
6. Click **Create**

#### C. iOS Client ID (Optional - for future iOS app)

1. Click **Create Credentials** > **OAuth client ID**
2. Application type: **iOS**
3. Name: `WearOn iOS`
4. **Bundle ID:** `com.umperasofts.wearon`
5. Click **Create**

---

## Part 2: Supabase Configuration

### Step 1: Enable Google Provider

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `ljilupbgmrizblkzokfa`
3. Go to **Authentication** > **Providers**
4. Find **Google** and click to expand

### Step 2: Configure Google Provider

1. **Enable Google provider:** Toggle ON
2. **Client ID:** Paste the **Web Client ID** from Google Cloud Console
3. **Client Secret:** Paste the **Client Secret** from Google Cloud Console
4. **Authorized Client IDs** (for mobile):
   - Add your **Android Client ID** from Google Cloud Console
   - Add your **iOS Client ID** (if created)
5. Click **Save**

### Step 3: Add Redirect URL to Google Cloud

1. Go back to Google Cloud Console
2. Edit your **Web Client ID**
3. Add to **Authorized redirect URIs**:
   ```
   https://ljilupbgmrizblkzokfa.supabase.co/auth/v1/callback
   ```
4. Save

---

## Part 3: Mobile App Integration

### Install Google Sign-In Package

```bash
cd apps/expo
npx expo install @react-native-google-signin/google-signin
```

### Update app.json

Add to `apps/expo/app.json`:

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      "expo-font",
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.YOUR_IOS_CLIENT_ID"
        }
      ]
    ],
    "android": {
      "googleServicesFile": "./google-services.json",
      "package": "com.umperasofts.wearon"
    }
  }
}
```

### Create google-services.json (Android)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Add your Google Cloud project to Firebase
3. Add Android app with package name: `com.umperasofts.wearon`
4. Download `google-services.json`
5. Place it in `apps/expo/` folder

### Environment Variables

Add to `apps/expo/.env`:

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
```

---

## Part 4: Code Implementation

### Create Google Sign-In Hook

File: `packages/app/utils/useGoogleSignIn.ts`

```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { useSupabase } from '../provider/SupabaseProvider'
import { useState } from 'react'

export function useGoogleSignIn() {
  const { supabase } = useSupabase()
  const [loading, setLoading] = useState(false)

  const signInWithGoogle = async () => {
    try {
      setLoading(true)

      // Configure Google Sign-In
      GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      })

      // Check if device supports Google Play
      await GoogleSignin.hasPlayServices()

      // Get user info
      const userInfo = await GoogleSignin.signIn()

      // Get ID token
      const tokens = await GoogleSignin.getTokens()

      // Sign in to Supabase with Google ID token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: tokens.idToken,
      })

      if (error) {
        throw error
      }

      return { user: data.user, session: data.session }
    } catch (error) {
      console.error('Google Sign-In Error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      await GoogleSignin.signOut()
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Sign Out Error:', error)
    }
  }

  return {
    signInWithGoogle,
    signOut,
    loading,
  }
}
```

### Usage in Login Screen

```typescript
import { useGoogleSignIn } from '../utils/useGoogleSignIn'

export function LoginScreen() {
  const { signInWithGoogle, loading } = useGoogleSignIn()

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithGoogle()
      console.log('Signed in:', result.user)
      // Navigate to home screen
    } catch (error) {
      alert('Failed to sign in with Google')
    }
  }

  return (
    <Button onPress={handleGoogleSignIn} disabled={loading}>
      {loading ? 'Signing in...' : 'Sign in with Google'}
    </Button>
  )
}
```

---

## Part 5: Testing

### Debug Build Testing

1. Build the app:
   ```bash
   cd apps/expo
   eas build --profile development --platform android
   ```

2. Install on device or emulator

3. Test Google Sign-In flow

### Verify in Supabase

1. Go to **Authentication** > **Users** in Supabase dashboard
2. You should see the new user with Google provider

---

## Part 6: Production Setup

### Generate Production SHA Keys

For release builds, generate production SHA keys:

```bash
keytool -list -v \
  -keystore apps/expo/android/app/release.keystore \
  -alias your-key-alias \
  -storepass your-store-password \
  -keypass your-key-password
```

### Add Production SHA to Google Cloud

1. Go to Google Cloud Console
2. Edit your Android OAuth Client
3. Add the **production SHA-1** fingerprint
4. Save

### Update Supabase

Ensure production domain is added to Supabase redirect URLs if using web OAuth flow.

---

## Troubleshooting

### Common Issues

**"Developer Error" on sign-in:**
- Check package name matches: `com.umperasofts.wearon`
- Verify SHA-1 fingerprint is correct
- Ensure Android Client ID is added to Supabase "Authorized Client IDs"

**"Sign in failed" error:**
- Verify Google+ API is enabled
- Check Web Client ID in Supabase configuration
- Ensure redirect URL is correct

**"Play Services not available":**
- Test on a real device with Google Play Services
- Or use an emulator with Google APIs

---

## Quick Reference

**Package Name:** `com.umperasofts.wearon`

**Debug SHA-1:** `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

**Supabase Project:** `ljilupbgmrizblkzokfa`

**Redirect URL:** `https://ljilupbgmrizblkzokfa.supabase.co/auth/v1/callback`

---

## Resources

- [Google Cloud Console](https://console.cloud.google.com/)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [React Native Google Sign-In](https://github.com/react-native-google-signin/google-signin)
- [Expo Google Sign-In Guide](https://docs.expo.dev/guides/authentication/#google)
