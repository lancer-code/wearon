import { describe, expect, test } from 'vitest'
import {
  CONFIDENCE_THRESHOLD,
  getSizeRecommendationPresentation,
  SIZE_REC_DISCLAIMER,
} from '../../features/size-rec/size-recommendation-presentation'

describe('size recommendation presentation (B2C)', () => {
  test('high confidence renders definitive size text', () => {
    const result = getSizeRecommendationPresentation({
      recommendedSize: 'M',
      confidence: 0.88,
      sizeRange: { lower: 'M', upper: 'L' },
    })

    expect(CONFIDENCE_THRESHOLD).toBe(0.8)
    expect(result.primaryText).toBe('Recommended: M')
    expect(result.secondaryText).toBeNull()
    expect(result.isDefinitive).toBe(true)
  })

  test('low confidence renders range + percentage text', () => {
    const result = getSizeRecommendationPresentation({
      recommendedSize: 'M',
      confidence: 0.67,
      sizeRange: { lower: 'M', upper: 'L' },
    })

    expect(result.primaryText).toBe('Between M and L')
    expect(result.secondaryText).toBe('Confidence: 67%')
    expect(result.isDefinitive).toBe(false)
  })

  test('disclaimer is always visible', () => {
    const result = getSizeRecommendationPresentation({
      recommendedSize: 'S',
      confidence: 0.95,
    })

    expect(result.disclaimer).toBe(SIZE_REC_DISCLAIMER)
  })
})
