// Shared pricing helpers — safe for client & server.

export type Tier = "pdf" | "printed" | "video";

export const DEFAULT_BASE_PAGES = 5;
export const MIN_PAGES = 4;
export const MAX_PAGES = 16;

export type PricingLike = {
  tier_pdf_iqd: number | string;
  tier_printed_iqd: number | string;
  tier_video_iqd: number | string;
  per_page_iqd_pdf: number | string;
  per_page_iqd_printed: number | string;
  per_page_iqd_video: number | string;
  print_cost_iqd?: number | string;
  shipping_cost_iqd?: number | string;
};

export function computeTierAmount(tier: Tier, pageCount: number, p: PricingLike): number {
  const extra = Math.max(0, pageCount - DEFAULT_BASE_PAGES);
  const base = Number(
    tier === "pdf" ? p.tier_pdf_iqd : tier === "printed" ? p.tier_printed_iqd : p.tier_video_iqd,
  );
  const perPage = Number(
    tier === "pdf" ? p.per_page_iqd_pdf : tier === "printed" ? p.per_page_iqd_printed : p.per_page_iqd_video,
  );
  return Math.round(base + extra * perPage);
}

export const DEFAULT_PRICING: PricingLike = {
  tier_pdf_iqd: 3000,
  tier_printed_iqd: 10000,
  tier_video_iqd: 25000,
  per_page_iqd_pdf: 400,
  per_page_iqd_printed: 1200,
  per_page_iqd_video: 2500,
  print_cost_iqd: 0,
  shipping_cost_iqd: 0,
};
