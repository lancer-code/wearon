export const CONFIDENCE_THRESHOLD = 0.8
export const SIZE_REC_DISCLAIMER =
  'This is a suggestion based on your measurements, not a guarantee'

export type SizeRange = {
  lower: string
  upper: string
}

export type SizeRecommendationInput = {
  recommendedSize: string
  confidence: number
  sizeRange?: SizeRange
}

export type SizeRecommendationPresentation = {
  primaryText: string
  secondaryText: string | null
  disclaimer: string
  isDefinitive: boolean
}

const FALLBACK_RANGE: SizeRange = {
  lower: 'M',
  upper: 'L',
}

export function getSizeRecommendationPresentation(
  input: SizeRecommendationInput
): SizeRecommendationPresentation {
  const normalizedConfidence = Math.max(0, Math.min(1, Number(input.confidence ?? 0)))

  // Guard against partial sizeRange objects
  const hasValidRange = input.sizeRange?.lower && input.sizeRange?.upper
  const normalizedRange = hasValidRange ? input.sizeRange : FALLBACK_RANGE

  if (normalizedConfidence >= CONFIDENCE_THRESHOLD) {
    return {
      primaryText: `Recommended: ${input.recommendedSize}`,
      secondaryText: null,
      disclaimer: SIZE_REC_DISCLAIMER,
      isDefinitive: true,
    }
  }

  return {
    primaryText: `Between ${normalizedRange.lower} and ${normalizedRange.upper}`,
    secondaryText: `Confidence: ${Math.round(normalizedConfidence * 100)}%`,
    disclaimer: SIZE_REC_DISCLAIMER,
    isDefinitive: false,
  }
}
