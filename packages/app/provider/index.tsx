import { useColorScheme } from 'react-native'
import {
  CustomToast,
  TamaguiProvider,
  type TamaguiProviderProps,
  ToastProvider,
  config,
  isWeb,
} from '@my/ui'
import { ToastViewport } from './ToastViewport'
import { SupabaseProvider } from './SupabaseProvider'
import { TRPCProvider } from './TRPCProvider'

export function Provider({
  children,
  defaultTheme = 'light',
  ...rest
}: Omit<TamaguiProviderProps, 'config'> & { defaultTheme?: string }) {
  const colorScheme = useColorScheme()
  const theme = defaultTheme || (colorScheme === 'dark' ? 'dark' : 'light')

  return (
    <SupabaseProvider>
      <TRPCProvider>
        <TamaguiProvider config={config} defaultTheme={theme} {...rest}>
          <ToastProvider
            swipeDirection="horizontal"
            duration={6000}
            native={isWeb ? [] : ['mobile']}
          >
            {children}
            <CustomToast />
            <ToastViewport />
          </ToastProvider>
        </TamaguiProvider>
      </TRPCProvider>
    </SupabaseProvider>
  )
}
