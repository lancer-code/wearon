import { NextTamaguiProvider } from 'app/provider/NextTamaguiProvider'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <NextTamaguiProvider>{children}</NextTamaguiProvider>
}
