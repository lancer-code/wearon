'use client'

import { Button, YStack, XStack, Text, Card } from '@my/ui'
import { useRouter } from 'solito/navigation'
import { supabase } from '../../utils/supabase'

export function DashboardScreen() {
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <YStack flex={1} padding="$6" bg="$background">
      <XStack justify="space-between" items="center" marginBottom="$6">
        <Text fontSize="$8" fontWeight="700" color="$color12">
          Dashboard
        </Text>
        <Button size="$3" theme="red" onPress={handleSignOut}>
          Sign Out
        </Button>
      </XStack>

      <Card padding="$6" bordered>
        <YStack gap="$4">
          <Text fontSize="$6" fontWeight="600" color="$color12">
            Welcome to WearOn
          </Text>
          <Text fontSize="$4" color="$color10">
            This is a placeholder dashboard. Your virtual try-on features will appear here.
          </Text>
        </YStack>
      </Card>
    </YStack>
  )
}
