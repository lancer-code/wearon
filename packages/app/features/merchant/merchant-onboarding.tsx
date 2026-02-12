'use client'

import { useState } from 'react'
import { useSearchParams } from 'solito/navigation'
import { YStack, XStack, H2, H3, Text, Card, Button, Separator } from '@my/ui'
import { Check, Copy, ChevronRight } from '@tamagui/lucide-icons'
import { trpc } from '../../utils/trpc'

type OnboardingStep = 1 | 2 | 3

function StepIndicator({ step, currentStep }: { step: number; currentStep: number }) {
  const isCompleted = currentStep > step
  const isActive = currentStep === step

  return (
    <XStack alignItems="center" gap="$2">
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isCompleted ? '#22c55e' : isActive ? '#3b82f6' : '#27272a',
          color: '#fafafa',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {isCompleted ? <Check size={16} /> : step}
      </div>
      <Text
        color={isActive ? '$color12' : '$color10'}
        fontWeight={isActive ? '600' : '400'}
        fontSize="$3"
      >
        {step === 1 ? 'Store Details' : step === 2 ? 'Payment' : 'Review'}
      </Text>
    </XStack>
  )
}

export function MerchantOnboarding() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1)
  const [apiKeyCopied, setApiKeyCopied] = useState(false)
  const searchParams = useSearchParams()

  // API key from OAuth redirect (one-time display)
  const initialApiKey = searchParams?.get('api_key') ?? null
  const storeId = searchParams?.get('store_id') ?? null

  const storeQuery = trpc.merchant.getMyStore.useQuery()
  const completeOnboarding = trpc.merchant.completeOnboarding.useMutation()

  const store = storeQuery.data

  const handleCopyApiKey = async () => {
    if (initialApiKey) {
      await navigator.clipboard.writeText(initialApiKey)
      setApiKeyCopied(true)
      setTimeout(() => setApiKeyCopied(false), 2000)
    }
  }

  const handleComplete = async () => {
    await completeOnboarding.mutateAsync()
    window.location.href = '/merchant/dashboard'
  }

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((currentStep + 1) as OnboardingStep)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as OnboardingStep)
    }
  }

  return (
    <YStack flex={1} padding="$6" gap="$6" style={{ overflowY: 'auto' }}>
      <YStack gap="$2">
        <H2>Welcome to WearOn</H2>
        <Text color="$color10">Complete these steps to set up your store integration.</Text>
      </YStack>

      {/* Step Indicators */}
      <XStack gap="$6" justifyContent="center">
        <StepIndicator step={1} currentStep={currentStep} />
        <ChevronRight size={16} color="$color8" />
        <StepIndicator step={2} currentStep={currentStep} />
        <ChevronRight size={16} color="$color8" />
        <StepIndicator step={3} currentStep={currentStep} />
      </XStack>

      <Separator />

      {/* Step Content */}
      {currentStep === 1 && (
        <Card padding="$5">
          <YStack gap="$4">
            <H3>Confirm Store Details</H3>
            <Text color="$color10">
              Verify your store information below. This was imported from your Shopify account.
            </Text>

            <YStack gap="$3" paddingTop="$2">
              <XStack justifyContent="space-between" paddingVertical="$2">
                <Text color="$color10" fontWeight="500">Shop Domain</Text>
                <Text>{store?.shopDomain ?? '--'}</Text>
              </XStack>
              <Separator />
              <XStack justifyContent="space-between" paddingVertical="$2">
                <Text color="$color10" fontWeight="500">Status</Text>
                <Text>{store?.status === 'active' ? 'Active' : '--'}</Text>
              </XStack>
              <Separator />
              <XStack justifyContent="space-between" paddingVertical="$2">
                <Text color="$color10" fontWeight="500">Billing Mode</Text>
                <Text>
                  {store?.billingMode === 'absorb_mode' ? 'Absorb (merchant pays)' : 'Resell (shopper pays)'}
                </Text>
              </XStack>
            </YStack>
          </YStack>
        </Card>
      )}

      {currentStep === 2 && (
        <Card padding="$5">
          <YStack gap="$4">
            <H3>Payment Method</H3>
            <Text color="$color10">
              Set up your payment method to purchase credits for the virtual try-on service.
            </Text>

            <Card
              padding="$4"
              backgroundColor="$color3"
              borderColor="$color6"
              borderWidth={1}
            >
              <YStack gap="$2" alignItems="center">
                <Text color="$color10" fontSize="$4" textAlign="center">
                  Payment setup is handled by Paddle. You can finish this from the Billing page.
                </Text>
                <Text color="$color8" fontSize="$2" textAlign="center">
                  You can skip this step for now and configure billing later from merchant billing.
                </Text>
              </YStack>
            </Card>
          </YStack>
        </Card>
      )}

      {currentStep === 3 && (
        <Card padding="$5">
          <YStack gap="$4">
            <H3>Review & Complete</H3>
            <Text color="$color10">
              Your store is ready. Review your API key and installation details below.
            </Text>

            {/* API Key Display (one-time full key from OAuth) */}
            {initialApiKey && (
              <Card padding="$4" backgroundColor="$color3" borderColor="$color6" borderWidth={1}>
                <YStack gap="$3">
                  <Text fontWeight="600" color="$color12">
                    Your API Key (save this now!)
                  </Text>
                  <Text color="$color9" fontSize="$2">
                    This is the only time your full API key will be shown. Copy and store it securely.
                  </Text>
                  <XStack gap="$2" alignItems="center">
                    <div
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        backgroundColor: '#18181b',
                        borderRadius: 6,
                        border: '1px solid #27272a',
                        fontFamily: 'monospace',
                        fontSize: 14,
                        color: '#fafafa',
                        wordBreak: 'break-all',
                      }}
                    >
                      {initialApiKey}
                    </div>
                    <button
                      onClick={handleCopyApiKey}
                      type="button"
                      style={{
                        padding: '10px',
                        borderRadius: 6,
                        border: '1px solid #27272a',
                        backgroundColor: 'transparent',
                        color: apiKeyCopied ? '#22c55e' : '#a1a1aa',
                        cursor: 'pointer',
                      }}
                      title="Copy API key"
                    >
                      <Copy size={16} />
                    </button>
                  </XStack>
                </YStack>
              </Card>
            )}

            {/* Installation Instructions */}
            <YStack gap="$3">
              <Text fontWeight="600">Plugin Installation</Text>
              <Text color="$color10" fontSize="$3">
                1. Install the WearOn plugin from the Shopify App Store
              </Text>
              <Text color="$color10" fontSize="$3">
                2. Enter your API key in the plugin settings
              </Text>
              <Text color="$color10" fontSize="$3">
                3. Configure product pages to show the virtual try-on button
              </Text>
            </YStack>
          </YStack>
        </Card>
      )}

      {/* Navigation Buttons */}
      <XStack justifyContent="space-between" paddingTop="$2">
        <Button
          onPress={handleBack}
          disabled={currentStep === 1}
          opacity={currentStep === 1 ? 0.5 : 1}
          variant="outlined"
        >
          Back
        </Button>

        {currentStep < 3 ? (
          <Button onPress={handleNext} theme="blue">
            Continue
          </Button>
        ) : (
          <Button
            onPress={handleComplete}
            theme="green"
            disabled={completeOnboarding.isPending}
          >
            {completeOnboarding.isPending ? 'Completing...' : 'Complete Setup'}
          </Button>
        )}
      </XStack>
    </YStack>
  )
}
