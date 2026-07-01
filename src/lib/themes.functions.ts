import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ThemeInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  start_date: z.string().trim().optional().nullable(),
  end_date: z.string().trim().optional().nullable(),
  accent_color: z.string().trim().max(40).optional().nullable(),
  banner_text_ar: z.string().trim().max(200).optional().nullable(),
  banner_text_en: z.string().trim().max(200).optional().nullable(),
  banner_url: z.string().trim().max(500).optional().nullable(),
  meaning_ar: z.string().trim().max(1000).optional().nullable(),
  meaning_en: z.string().trim().max(1000).optional().nullable(),
  palette: z.array(z.string().trim().max(40)).max(6).optional().nullable(),
  frame_style: z.enum(["classic", "arabesque", "ribbon", "stars", "floral", "geometric", "none"]).optional().nullable(),
  motifs: z.array(z.string().trim().max(40)).max(8).optional().nullable(),
  header_title_ar: z.string().trim().max(160).optional().nullable(),
  header_title_en: z.string().trim().max(160).optional().nullable(),
  header_size: z.enum(["sm", "md", "lg", "xl"]).optional().nullable(),
  active: z.boolean().default(false),
});

async function gate() {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
}

export const getActiveTheme = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from("seasonal_themes")
    .select("*")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(20);
  const matched = (data ?? []).find((t) => {
    const okStart = !t.start_date || t.start_date <= today;
    const okEnd = !t.end_date || t.end_date >= today;
    return okStart && okEnd;
  });
  return matched ?? null;
});

export const adminListThemes = createServerFn({ method: "GET" }).handler(async () => {
  await gate();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("seasonal_themes")
    .select("*")
    .order("updated_at", { ascending: false });
  return data ?? [];
});

export const adminUpsertTheme = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ThemeInput.parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await supabaseAdmin.from("seasonal_themes").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: data.id };
    }
    const { id: _ignore, ...insert } = data;
    void _ignore;
    const { data: row, error } = await supabaseAdmin
      .from("seasonal_themes")
      .insert(insert)
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message || "Failed to create theme");
    return { ok: true as const, id: row.id as string };
  });

export const adminDeleteTheme = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("seasonal_themes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
