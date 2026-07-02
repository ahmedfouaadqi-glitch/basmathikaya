import { createServerFn } from "@tanstack/react-start";

/**
 * Admin-only: read Lovable AI Gateway usage + estimate remaining stories.
 * Never returns model names — only rough "stories left" numbers per quality tier,
 * using the actual average cost of the last 30 days when available, falling back
 * to admin-configurable estimates otherwise.
 */
export const getAICreditBalance = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { available: false as const };

  // Try to fetch usage from Lovable AI gateway.
  let remainingCredits = 0;
  let gatewayOk = false;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/credits", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (r.ok) {
      const j = (await r.json()) as { available?: number; balance?: number; remaining?: number };
      remainingCredits = Number(j.available ?? j.balance ?? j.remaining ?? 0);
      gatewayOk = true;
    }
  } catch { /* ignore */ }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: pricing } = await supabaseAdmin
    .from("pricing_settings")
    .select("ai_cost_estimate_standard, ai_cost_estimate_premium, usd_per_credit, iqd_per_usd")
    .eq("id", 1)
    .maybeSingle();

  const usdPerCredit = Number(pricing?.usd_per_credit ?? 0.1);
  const iqdPerUsd = Number(pricing?.iqd_per_usd ?? 1500);
  const balanceUsd = remainingCredits * usdPerCredit;
  const configStd = Number(pricing?.ai_cost_estimate_standard ?? 0.05);
  const configPrem = Number(pricing?.ai_cost_estimate_premium ?? 0.15);

  // Compute actual average cost per order (last 30 days) per quality tier.
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
    const q = qualityById.get(oid) ?? "standard";
    if (q === "premium") { premSum += total; premN++; } else { stdSum += total; stdN++; }
  }
  const avgStd = stdN > 0 ? stdSum / stdN : configStd;
  const avgPrem = premN > 0 ? premSum / premN : configPrem;

  return {
    available: true as const,
    gateway_ok: gatewayOk,
    credits_remaining: remainingCredits,
    balance_usd: +balanceUsd.toFixed(2),
    balance_iqd: Math.round(balanceUsd * iqdPerUsd),
    usd_per_credit: usdPerCredit,
    avg_cost_usd_standard: +avgStd.toFixed(4),
    avg_cost_usd_premium: +avgPrem.toFixed(4),
    stories_sampled_standard: stdN,
    stories_sampled_premium: premN,
    stories_left_standard: avgStd > 0 ? Math.floor(balanceUsd / avgStd) : null,
    stories_left_premium: avgPrem > 0 ? Math.floor(balanceUsd / avgPrem) : null,
    source_standard: stdN > 0 ? ("actual" as const) : ("estimate" as const),
    source_premium: premN > 0 ? ("actual" as const) : ("estimate" as const),
  };
});
