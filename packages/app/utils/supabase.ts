import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  Constants.expoConfig?.extra?.supabaseUrl ||
  'https://your-project.supabase.co'
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  'your-anon-key-here'

const isWeb = Platform.OS === 'web'

// Use cookie-based client for web (works with middleware), standard client for native
export const supabase = isWeb
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    })
