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
  quality_premium_multiplier?: number | string;
  video_tier_enabled?: boolean;
  free_moods_count?: number | string;
  mood_extra_iqd?: number | string;
  redownload_iqd_pdf?: number | string;
  redownload_iqd_printed?: number | string;
  redownload_iqd_video?: number | string;
};

/** Returns per-unit multiplier applied when the user picks premium quality. */
export function qualityMultiplier(p: PricingLike, q: QualityTier): number {
  if (q !== "premium") return 1;
  const m = Number(p.quality_premium_multiplier ?? 2);
  return Number.isFinite(m) && m > 0 ? m : 2;
}

export function qualityExtra(p: PricingLike, q: QualityTier): number {
  return q === "premium"
    ? Number(p.image_tier_premium_extra_iqd ?? 0)
    : Number(p.image_tier_standard_extra_iqd ?? 0);
}

export function moodExtraIqd(p: PricingLike, moodCount: number): number {
  const free = Math.max(0, Number(p.free_moods_count ?? 1));
  const per = Math.max(0, Number(p.mood_extra_iqd ?? 0));
  return Math.max(0, moodCount - free) * per;
}

/**
 * Total = (base + extraPages*perPage + extraChars*perChar) * qualityMultiplier + flatExtra + moodExtra
 * The multiplier scales the whole per-unit tally (base, per-page, per-character)
 * so higher quality raises the price of each image, each page and each character.
 * Extra moods (beyond the free count) are billed separately per mood.
 */
export function computeTierAmount(
  tier: Tier,
  pageCount: number,
  p: PricingLike,
  characterCount: number = 1,
  quality: QualityTier = "standard",
  moodCount: number = 1,
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
  const mult = qualityMultiplier(p, quality);
  const perUnit = base + extraPages * perPage + extraChars * perChar;
  return Math.round(perUnit * mult + qualityExtra(p, quality) + moodExtraIqd(p, moodCount));
}

export function redownloadPrice(p: PricingLike, tier: Tier | string | null): number {
  if (tier === "printed") return Number(p.redownload_iqd_printed ?? 3000);
  if (tier === "video") return Number(p.redownload_iqd_video ?? 5000);
  return Number(p.redownload_iqd_pdf ?? 1500);
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
  image_tier_premium_extra_iqd: 0,
  quality_premium_multiplier: 2,
  video_tier_enabled: false,
  free_moods_count: 1,
  mood_extra_iqd: 0,
  redownload_iqd_pdf: 1500,
  redownload_iqd_printed: 3000,
  redownload_iqd_video: 5000,
};
