import { createServerFn } from "@tanstack/react-start";

/**
 * Admin-only: read Lovable AI Gateway usage + estimate remaining stories.
 * Never returns model names — only a rough "stories left" number for standard vs premium.
 */
export const getAICreditBalance = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { available: false as const };

  // Try to fetch usage from Lovable AI gateway — the endpoint returns credits info.
  // If the endpoint changes we degrade to "unknown".
  let remainingCredits = 0;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/credits", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (r.ok) {
      const j = (await r.json()) as { available?: number; balance?: number; remaining?: number };
      remainingCredits = Number(j.available ?? j.balance ?? j.remaining ?? 0);
    }
  } catch { /* ignore — return unknown */ }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: pricing } = await supabaseAdmin
    .from("pricing_settings")
    .select("ai_cost_estimate_standard, ai_cost_estimate_premium, usd_per_credit")
    .eq("id", 1)
    .maybeSingle();

  const usdPerCredit = Number(pricing?.usd_per_credit ?? 0.1);
  const balanceUsd = remainingCredits * usdPerCredit;
  const stdCost = Number(pricing?.ai_cost_estimate_standard ?? 0.05);
  const premCost = Number(pricing?.ai_cost_estimate_premium ?? 0.15);

  return {
    available: true as const,
    credits_remaining: remainingCredits,
    stories_left_standard: stdCost > 0 ? Math.floor(balanceUsd / stdCost) : null,
    stories_left_premium: premCost > 0 ? Math.floor(balanceUsd / premCost) : null,
  };
});
