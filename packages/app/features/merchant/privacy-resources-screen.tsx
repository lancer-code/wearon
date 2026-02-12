'use client'

import { useState, useEffect } from 'react'
import { YStack, XStack, Text, Card, PageHeader, PageContent, Button } from '@my/ui'
import { Copy, Check, FileText, Shield, Handshake, AlertCircle } from '@tamagui/lucide-icons'
import { trpc } from '../../utils/trpc'

// MEDIUM #5 FIX: Properly extract store name from Shopify domain
function extractStoreName(shopDomain: string | undefined): string | null {
  if (!shopDomain || typeof shopDomain !== 'string') {
    return null
  }

  // Validate it's a proper .myshopify.com domain
  if (!shopDomain.endsWith('.myshopify.com')) {
    return null
  }

  // Extract the subdomain part
  const parts = shopDomain.split('.')
  if (parts.length !== 3 || parts[1] !== 'myshopify' || parts[2] !== 'com') {
    return null
  }

  const storeName = parts[0]
  // Validate store name is not empty and contains valid characters
  if (!storeName || storeName.length === 0 || !/^[a-zA-Z0-9-]+$/.test(storeName)) {
    return null
  }

  return storeName
}

function TemplateCard({
  title,
  description,
  icon: Icon,
  content,
}: {
  title: string
  description: string
  icon: React.ElementType
  content: string
}) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card bordered padding="$4">
      <YStack gap="$3">
        <XStack alignItems="center" justifyContent="space-between">
          <XStack alignItems="center" gap="$2">
            <Icon size={20} color="$color10" />
            <Text fontSize="$5" fontWeight="600">
              {title}
            </Text>
          </XStack>
          <XStack gap="$2">
            <Button size="$2" variant="outlined" onPress={() => setExpanded(!expanded)}>
              {expanded ? 'Collapse' : 'Preview'}
            </Button>
            <Button size="$2" onPress={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </XStack>
        </XStack>
        <Text color="$color8" fontSize="$3">
          {description}
        </Text>
        {expanded && (
          <div
            style={{
              backgroundColor: '#18181b',
              borderRadius: 8,
              padding: 16,
              maxHeight: 400,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              fontSize: 13,
              lineHeight: 1.6,
              color: '#d4d4d8',
              border: '1px solid #27272a',
            }}
          >
            {content}
          </div>
        )}
      </YStack>
    </Card>
  )
}

export function PrivacyResourcesScreen() {
  const storeQuery = trpc.merchant.getMyStore.useQuery()

  // MEDIUM #5 FIX: Properly parse shopDomain instead of naive string replacement
  const storeName = extractStoreName(storeQuery.data?.shopDomain) || '{{STORE_NAME}}'

  // Import templates at render time with store name filled in
  const [templates, setTemplates] = useState<{
    gdpr: string
    ccpa: string
    dpa: string
  } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // MEDIUM #3 FIX + MEDIUM #4 FIX: Use useEffect to prevent race conditions and add error handling
  useEffect(() => {
    import('@my/api/src/templates/privacy-policy')
      .then((mod) => {
        setTemplates({
          gdpr: mod.getGdprTemplate(storeName),
          ccpa: mod.getCcpaTemplate(storeName),
          dpa: mod.getDpaTemplate(storeName),
        })
      })
      .catch((error) => {
        console.error('Failed to load privacy templates:', error)
        setLoadError('Failed to load privacy templates. Please refresh the page.')
      })
  }, [storeName])

  // MEDIUM #4 FIX: Show error UI if template loading failed
  if (loadError) {
    return (
      <YStack flex={1} padding="$6" gap="$6">
        <PageHeader
          title="Privacy Resources"
          subtitle="Ready-to-use privacy policy templates for your store's virtual try-on feature"
        />
        <Card bordered padding="$4" backgroundColor="$red2">
          <XStack gap="$3" alignItems="center">
            <AlertCircle size={24} color="$red10" />
            <YStack gap="$2" flex={1}>
              <Text fontSize="$4" fontWeight="600" color="$red10">
                Error Loading Templates
              </Text>
              <Text color="$color8" fontSize="$3">
                {loadError}
              </Text>
            </YStack>
          </XStack>
        </Card>
      </YStack>
    )
  }

  return (
    <YStack flex={1} padding="$6" gap="$6">
      <PageHeader
        title="Privacy Resources"
        subtitle="Ready-to-use privacy policy templates for your store's virtual try-on feature"
      />

      <PageContent>
        <YStack gap="$3">
          <Card bordered padding="$4" backgroundColor="$blue2">
            <YStack gap="$2">
              <Text fontSize="$4" fontWeight="600" color="$blue10">
                How to use these templates
              </Text>
              <Text color="$color8" fontSize="$3">
                1. Copy the template that applies to your customers' jurisdiction.{'\n'}
                2. Replace placeholder fields ([INSERT DATE], [INSERT CONTACT EMAIL], etc.).{'\n'}
                3. Add the policy to your store's privacy page or legal section.{'\n'}
                4. The DPA should be signed by both parties and kept on file.
              </Text>
            </YStack>
          </Card>
        </YStack>

        <YStack gap="$4">
          <TemplateCard
            title="GDPR Privacy Policy"
            description="For EU/EEA customers. Covers data collection, 6-hour deletion, third-party processing (OpenAI), and data subject rights."
            icon={Shield}
            content={templates?.gdpr || 'Loading...'}
          />

          <TemplateCard
            title="CCPA Privacy Disclosure"
            description="For California consumers. Covers biometric data, no-sale disclosure, right to delete, and right to opt-out."
            icon={FileText}
            content={templates?.ccpa || 'Loading...'}
          />

          <TemplateCard
            title="Data Processing Agreement (DPA)"
            description="3-party agreement: Store (Controller) → WearOn (Processor) → OpenAI (Sub-Processor). Covers data flow, security, and breach notification."
            icon={Handshake}
            content={templates?.dpa || 'Loading...'}
          />
        </YStack>
      </PageContent>
    </YStack>
  )
}
