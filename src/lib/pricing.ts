// Shared pricing helpers — safe for client & server.

export type Tier = "pdf" | "printed" | "video";
export type QualityTier = "standard" | "premium";

export const DEFAULT_BASE_PAGES = 5;
export const MIN_PAGES = 4;
export const MAX_PAGES = 16;
export const MIN_CHARACTERS = 1;
export const MAX_CHARACTERS = 5;

export type PricingLike = {
  tier_pdf_iqd: number | string;
  tier_printed_iqd: number | string;
  tier_video_iqd: number | string;
  per_page_iqd_pdf: number | string;
  per_page_iqd_printed: number | string;
  per_page_iqd_video: number | string;
  per_character_iqd_pdf?: number | string;
  per_character_iqd_printed?: number | string;
  per_character_iqd_video?: number | string;
  max_characters?: number | string;
  print_cost_iqd?: number | string;
  shipping_cost_iqd?: number | string;
  image_tier_standard_extra_iqd?: number | string;
  image_tier_premium_extra_iqd?: number | string;
  video_tier_enabled?: boolean;
};

export function qualityExtra(p: PricingLike, q: QualityTier): number {
  return q === "premium"
    ? Number(p.image_tier_premium_extra_iqd ?? 2000)
    : Number(p.image_tier_standard_extra_iqd ?? 0);
}

export function computeTierAmount(
  tier: Tier,
  pageCount: number,
  p: PricingLike,
  characterCount: number = 1,
  quality: QualityTier = "standard",
): number {
  const extraPages = Math.max(0, pageCount - DEFAULT_BASE_PAGES);
  const extraChars = Math.max(0, characterCount - 1);
  const base = Number(
    tier === "pdf" ? p.tier_pdf_iqd : tier === "printed" ? p.tier_printed_iqd : p.tier_video_iqd,
  );
  const perPage = Number(
    tier === "pdf" ? p.per_page_iqd_pdf : tier === "printed" ? p.per_page_iqd_printed : p.per_page_iqd_video,
  );
  const perChar = Number(
    tier === "pdf"
      ? p.per_character_iqd_pdf ?? 1500
      : tier === "printed"
        ? p.per_character_iqd_printed ?? 3000
        : p.per_character_iqd_video ?? 6000,
  );
  return Math.round(base + extraPages * perPage + extraChars * perChar + qualityExtra(p, quality));
}

export const DEFAULT_PRICING: PricingLike = {
  tier_pdf_iqd: 3000,
  tier_printed_iqd: 10000,
  tier_video_iqd: 25000,
  per_page_iqd_pdf: 400,
  per_page_iqd_printed: 1200,
  per_page_iqd_video: 2500,
  per_character_iqd_pdf: 1500,
  per_character_iqd_printed: 3000,
  per_character_iqd_video: 6000,
  max_characters: 5,
  print_cost_iqd: 0,
  shipping_cost_iqd: 0,
  image_tier_standard_extra_iqd: 0,
  image_tier_premium_extra_iqd: 2000,
  video_tier_enabled: false,
};
