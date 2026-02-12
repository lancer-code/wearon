'use client'

import { useState } from 'react'
import { YStack, XStack, Text, Card, PageHeader, PageContent, Button } from '@my/ui'
import { Copy, Check, FileText, Shield, Handshake } from '@tamagui/lucide-icons'
import { trpc } from '../../utils/trpc'

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
  const storeName = storeQuery.data?.shopDomain?.replace('.myshopify.com', '') || '{{STORE_NAME}}'

  // Import templates at render time with store name filled in
  const [templates, setTemplates] = useState<{
    gdpr: string
    ccpa: string
    dpa: string
  } | null>(null)

  // Load templates dynamically
  if (!templates) {
    import('@my/api/src/templates/privacy-policy').then((mod) => {
      setTemplates({
        gdpr: mod.getGdprTemplate(storeName),
        ccpa: mod.getCcpaTemplate(storeName),
        dpa: mod.getDpaTemplate(storeName),
      })
    })
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
