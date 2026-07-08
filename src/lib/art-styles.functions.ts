// Art styles — public read + admin CRUD server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function requireAdmin() {
  const { requireAdmin } = await import("./admin-session.server");
  return requireAdmin();
}

export type ArtStyle = {
  id: string;
  slug: string;
  category: "realistic" | "cartoon";
  name_ar: string;
  name_en: string;
  prompt_fragment: string;
  is_default: boolean;
  is_enabled: boolean;
  sort_order: number;
};

/** Public — used on /create. Returns enabled styles only. */
export const listPublicArtStyles = createServerFn({ method: "GET" }).handler(async (): Promise<ArtStyle[]> => {
  const s = await db();
  const { data, error } = await s
    .from("art_styles")
    .select("id, slug, category, name_ar, name_en, prompt_fragment, is_default, is_enabled, sort_order")
    .eq("is_enabled", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ArtStyle[];
});

/** Admin — list everything (including disabled). */
export const listAllArtStyles = createServerFn({ method: "GET" }).handler(async (): Promise<ArtStyle[]> => {
  await requireAdmin();
  const s = await db();
  const { data, error } = await s
    .from("art_styles")
    .select("id, slug, category, name_ar, name_en, prompt_fragment, is_default, is_enabled, sort_order")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ArtStyle[];
});

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, "slug must be lowercase kebab"),
  category: z.enum(["realistic", "cartoon"]),
  name_ar: z.string().trim().min(1).max(80),
  name_en: z.string().trim().min(1).max(80),
  prompt_fragment: z.string().trim().min(10).max(2000),
  is_enabled: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(9999).default(0),
});

export const upsertArtStyle = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const s = await db();
    if (data.id) {
      const { error } = await s.from("art_styles").update({
        slug: data.slug, category: data.category, name_ar: data.name_ar,
        name_en: data.name_en, prompt_fragment: data.prompt_fragment,
        is_enabled: data.is_enabled, sort_order: data.sort_order,
      } as never).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await s.from("art_styles").insert({
        slug: data.slug, category: data.category, name_ar: data.name_ar,
        name_en: data.name_en, prompt_fragment: data.prompt_fragment,
        is_enabled: data.is_enabled, sort_order: data.sort_order,
      } as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const deleteArtStyle = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const s = await db();
    const { data: row } = await s.from("art_styles").select("is_default").eq("id", data.id).maybeSingle();
    if ((row as { is_default?: boolean } | null)?.is_default) {
      throw new Error("لا يمكن حذف النمط الافتراضي — عيّن نمطاً افتراضياً آخر أولاً");
    }
    const { error } = await s.from("art_styles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setDefaultArtStyle = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const s = await db();
    const { data: row } = await s.from("art_styles").select("category").eq("id", data.id).maybeSingle();
    const category = (row as { category?: string } | null)?.category;
    if (!category) throw new Error("النمط غير موجود");
    // Clear the default flag for this category, then set on target.
    await s.from("art_styles").update({ is_default: false } as never).eq("category", category);
    const { error } = await s.from("art_styles").update({ is_default: true } as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
