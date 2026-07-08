import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CodeInput = z.object({ code: z.string().trim().min(4).max(20) });

export type ReferralStats = {
  code: string;
  totalReferrals: number;
  completedReferrals: number;
  totalRewardIqd: number;
  availableCreditIqd: number;
  recent: Array<{
    id: string;
    status: string;
    reward_amount_iqd: number;
    created_at: string;
    completed_at: string | null;
  }>;
};

/**
 * Get or create the current user's referral code, plus stats and history.
 */
export const getMyReferralStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<ReferralStats> => {
    const { requireUserSession } = await import("./user-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireUserSession();
    const userId = s.data.userId!;

    const { data: u } = await supabaseAdmin
      .from("users")
      .select("referral_code, referral_credit_iqd")
      .eq("id", userId)
      .maybeSingle();

    let code = u?.referral_code ?? null;
    if (!code) {
      const { data: rpc } = await supabaseAdmin.rpc("generate_referral_code");
      code = (rpc as unknown as string) ?? Math.random().toString(36).slice(2, 10).toUpperCase();
      await supabaseAdmin.from("users").update({ referral_code: code }).eq("id", userId);
    }

    const { data: refs } = await supabaseAdmin
      .from("referrals")
      .select("id, status, reward_amount_iqd, created_at, completed_at")
      .eq("referrer_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const list = refs ?? [];
    const completed = list.filter((r) => r.status === "completed" || r.status === "rewarded");
    const totalReward = list.reduce((a, r) => a + (r.reward_amount_iqd ?? 0), 0);

    return {
      code: code!,
      totalReferrals: list.length,
      completedReferrals: completed.length,
      totalRewardIqd: totalReward,
      availableCreditIqd: u?.referral_credit_iqd ?? 0,
      recent: list.slice(0, 20),
    };
  },
);

/**
 * Redeem a referral code on the current logged-in user (called right after signup).
 * Idempotent: only sets referred_by once, and creates one pending referral row.
 */
export const redeemReferralCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CodeInput.parse(d))
  .handler(async ({ data }) => {
    const { requireUserSession } = await import("./user-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireUserSession();
    const userId = s.data.userId!;

    const code = data.code.trim().toUpperCase();

    const { data: me } = await supabaseAdmin
      .from("users")
      .select("id, referred_by_user_id, referral_code")
      .eq("id", userId)
      .maybeSingle();
    if (!me) return { ok: false as const, reason: "no_user" };
    if (me.referred_by_user_id) return { ok: false as const, reason: "already_redeemed" };
    if (me.referral_code === code) return { ok: false as const, reason: "self" };

    const { data: referrer } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (!referrer) return { ok: false as const, reason: "not_found" };

    await supabaseAdmin.from("users").update({ referred_by_user_id: referrer.id }).eq("id", userId);

    // Insert referral row if not already present
    const { data: existing } = await supabaseAdmin
      .from("referrals")
      .select("id")
      .eq("referred_user_id", userId)
      .maybeSingle();
    if (!existing) {
      await supabaseAdmin.from("referrals").insert({
        referrer_user_id: referrer.id,
        referred_user_id: userId,
        code,
        status: "pending",
      });
    }
    return { ok: true as const };
  });

/**
 * Called after an order is delivered/paid to complete the referral and grant reward.
 * Reward = 5000 IQD credit to referrer (configurable via env REFERRAL_REWARD_IQD).
 */
export const completeReferralForOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const reward = Number(process.env.REFERRAL_REWARD_IQD ?? 5000);

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || !order.user_id) return { ok: false as const, reason: "no_order" };

    const { data: ref } = await supabaseAdmin
      .from("referrals")
      .select("id, referrer_user_id, status")
      .eq("referred_user_id", order.user_id)
      .maybeSingle();
    if (!ref) return { ok: false as const, reason: "no_referral" };
    if (ref.status === "completed" || ref.status === "rewarded") {
      return { ok: false as const, reason: "already_completed" };
    }

    await supabaseAdmin
      .from("referrals")
      .update({
        status: "rewarded",
        first_order_id: data.orderId,
        completed_at: new Date().toISOString(),
        rewarded_at: new Date().toISOString(),
        reward_amount_iqd: reward,
      })
      .eq("id", ref.id);

    await supabaseAdmin.from("referral_rewards").insert({
      user_id: ref.referrer_user_id,
      referral_id: ref.id,
      amount_iqd: reward,
      reason: "referral_first_order",
      applied_order_id: data.orderId,
    });

    // Increment referrer credit
    const { data: refUser } = await supabaseAdmin
      .from("users")
      .select("referral_credit_iqd")
      .eq("id", ref.referrer_user_id)
      .maybeSingle();
    const current = refUser?.referral_credit_iqd ?? 0;
    await supabaseAdmin
      .from("users")
      .update({ referral_credit_iqd: current + reward })
      .eq("id", ref.referrer_user_id);

    // Notify referrer
    await supabaseAdmin.from("notifications").insert({
      user_id: ref.referrer_user_id,
      title: "مكافأة إحالة!",
      body: `حصلت على ${reward.toLocaleString()} دينار رصيداً بعد إتمام أول طلب لصديقك.`,
      kind: "referral_reward",
    });

    return { ok: true as const, reward };
  });
