-- Hidden Shopify credit product identifiers
-- Migration: 010_shopify_credit_product_columns
-- Adds: stores.shopify_product_id, stores.shopify_variant_id

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS shopify_product_id TEXT,
  ADD COLUMN IF NOT EXISTS shopify_variant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_stores_shopify_product_id ON public.stores(shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_stores_shopify_variant_id ON public.stores(shopify_variant_id);

COMMENT ON COLUMN public.stores.shopify_product_id IS 'Shopify product id for hidden Try-On Credit product';
COMMENT ON COLUMN public.stores.shopify_variant_id IS 'Shopify variant id used to build direct cart links';
