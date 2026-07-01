import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PromoVideo = {
  id: string;
  url: string;
  title: string | null;
  sort_order: number;
  enabled: boolean;
  muted_default: boolean;
};

async function gate() {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
}

/** Public list — only enabled videos, ordered. */
export const listPromoVideos = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("promo_videos")
    .select("id, url, title, sort_order, enabled, muted_default")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as PromoVideo[];
});

export const adminListPromoVideos = createServerFn({ method: "GET" }).handler(async () => {
  await gate();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("promo_videos")
    .select("id, url, title, sort_order, enabled, muted_default")
    .order("sort_order", { ascending: true });
  return (data ?? []) as PromoVideo[];
});

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  url: z.string().trim().min(1).max(1000),
  title: z.string().trim().max(200).optional().nullable(),
  sort_order: z.coerce.number().int().default(0),
  enabled: z.boolean().default(true),
  muted_default: z.boolean().default(true),
});

export const adminUpsertPromoVideo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await supabaseAdmin.from("promo_videos").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: data.id };
    }
    const { id: _ignore, ...insert } = data;
    void _ignore;
    const { data: row, error } = await supabaseAdmin
      .from("promo_videos")
      .insert(insert)
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message || "Failed");
    return { ok: true as const, id: row.id as string };
  });

export const adminDeletePromoVideo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("promo_videos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
