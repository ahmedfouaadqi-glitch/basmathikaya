import { createServerFn } from "@tanstack/react-start";

/**
 * Admin-only: report the active AI provider and local generation estimates.
 * OpenRouter does not expose a Lovable-style credit balance endpoint here, so
 * the page reports provider readiness and historical local estimates instead.
 */
export const getAICreditBalance = createServerFn({ method: "GET" }).handler(async () => {
  const providerConfigured = Boolean(process.env.OPENROUTER_API_KEY);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: pricing } = await supabaseAdmin
    .from("pricing_settings")
    .select("ai_cost_estimate_standard, ai_cost_estimate_premium, iqd_per_usd")
    .eq("id", 1)
    .maybeSingle();

  const iqdPerUsd = Number(pricing?.iqd_per_usd ?? 1500);
  const configStd = Number(pricing?.ai_cost_estimate_standard ?? 0.05);
  const configPrem = Number(pricing?.ai_cost_estimate_premium ?? 0.15);
  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await supabaseAdmin
    .from("generation_events")
    .select("order_id, cost_usd, status, created_at")
    .gte("created_at", sinceIso)
    .eq("status", "success");

  const orderIds = Array.from(new Set((events ?? []).map((e) => e.order_id).filter(Boolean))) as string[];
  const { data: orders } = orderIds.length
    ? await supabaseAdmin.from("orders").select("id, image_quality_tier").in("id", orderIds)
    : { data: [] };
  const qualityById = new Map<string, string>();
  for (const o of orders ?? []) qualityById.set(o.id, (o as { image_quality_tier?: string | null }).image_quality_tier ?? "standard");

  const perOrder = new Map<string, number>();
  for (const e of events ?? []) {
    if (!e.order_id) continue;
    perOrder.set(e.order_id, (perOrder.get(e.order_id) ?? 0) + Number(e.cost_usd ?? 0));
  }
  let stdSum = 0, stdN = 0, premSum = 0, premN = 0;
  for (const [oid, total] of perOrder) {
    if (qualityById.get(oid) === "premium") { premSum += total; premN++; }
    else { stdSum += total; stdN++; }
  }
  const avgStd = stdN > 0 ? stdSum / stdN : configStd;
  const avgPrem = premN > 0 ? premSum / premN : configPrem;

  return {
    available: providerConfigured,
    provider: "openrouter" as const,
    gateway_ok: providerConfigured,
    credits_remaining: null,
    balance_usd: null,
    balance_iqd: null,
    usd_per_credit: null,
    avg_cost_usd_standard: +avgStd.toFixed(4),
    avg_cost_usd_premium: +avgPrem.toFixed(4),
    stories_sampled_standard: stdN,
    stories_sampled_premium: premN,
    stories_left_standard: null,
    stories_left_premium: null,
    source_standard: stdN > 0 ? ("actual" as const) : ("estimate" as const),
    source_premium: premN > 0 ? ("actual" as const) : ("estimate" as const),
    note: "OpenRouter balance is managed in its dashboard; these are local estimates.",
    iqd_per_usd: iqdPerUsd,
  };
});
