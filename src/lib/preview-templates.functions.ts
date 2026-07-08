// Admin-managed free preview templates. NO AI cost — everything is
// pre-baked images + text stored in the DB. Public list is filtered by
// language/moods and by the seasonal window (via RLS + explicit filter).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PreviewTemplate = {
  id: string;
  name: string;
  language: "ar" | "en" | "ku";
  story_type: string | null;
  moods: string[];
  cover_image_path: string | null;
  page_images: string[];
  title: string;
  pages: Array<{ text: string }>;
  reflective_question: string | null;
  page_count: number;
  orientation: "portrait" | "landscape";
  frame_style: string | null;
  palette: string[] | null;
  active: boolean;
  hidden: boolean;
  seasonal_start: string | null;
  seasonal_end: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
  // client-visible signed URLs added on the way out
  cover_url?: string | null;
  page_urls?: string[];
};

const BUCKET = "story-covers";
const SIGN_TTL = 60 * 60; // 1h

async function signMany(paths: (string | null | undefined)[]): Promise<(string | null)[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return Promise.all(
    paths.map(async (p) => {
      if (!p) return null;
      const s = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(p, SIGN_TTL);
      return s.data?.signedUrl ?? null;
    }),
  );
}

async function withUrls(row: PreviewTemplate): Promise<PreviewTemplate> {
  const [cover, ...pages] = await signMany([row.cover_image_path, ...(row.page_images ?? [])]);
  return { ...row, cover_url: cover, page_urls: pages.map((u) => u ?? "") };
}

// -------- Public list (used from /create — free, no AI) --------
const PublicListInput = z.object({
  language: z.enum(["ar", "en", "ku"]).default("ar"),
  moods: z.array(z.string()).optional().default([]),
  storyType: z.string().optional().nullable(),
});

export const listPublicPreviewTemplates = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PublicListInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);
    const { data: rows } = await supabaseAdmin
      .from("preview_templates")
      .select("*")
      .eq("active", true)
      .eq("hidden", false)
      .eq("language", data.language)
      .or(`seasonal_start.is.null,seasonal_start.lte.${today}`)
      .or(`seasonal_end.is.null,seasonal_end.gte.${today}`)
      .order("priority", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(24);

    let list = (rows ?? []) as unknown as PreviewTemplate[];
    // Rank: matching moods first, then matching story_type.
    if (data.moods.length || data.storyType) {
      const wantMoods = new Set(data.moods);
      list = [...list].sort((a, b) => {
        const ma = (a.moods ?? []).filter((m) => wantMoods.has(m)).length;
        const mb = (b.moods ?? []).filter((m) => wantMoods.has(m)).length;
        if (mb !== ma) return mb - ma;
        const ta = a.story_type === data.storyType ? 1 : 0;
        const tb = b.story_type === data.storyType ? 1 : 0;
        return tb - ta;
      });
    }
    // Sign URLs only for the top 6 to keep it cheap.
    const top = list.slice(0, 6);
    const signed = await Promise.all(top.map(withUrls));
    return signed;
  });

// -------- Admin: list all (including hidden/out-of-season) --------
async function gate() {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
}

export const adminListPreviewTemplates = createServerFn({ method: "GET" })
  .handler(async () => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("preview_templates")
      .select("*")
      .order("priority", { ascending: false })
      .order("updated_at", { ascending: false });
    const rows = (data ?? []) as PreviewTemplate[];
    return Promise.all(rows.map(withUrls));
  });

// -------- Admin: create/update/delete/toggle --------
const PageInput = z.object({ text: z.string().max(2000) });
const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  language: z.enum(["ar", "en", "ku"]),
  story_type: z.string().max(60).optional().nullable(),
  moods: z.array(z.string().max(40)).max(10).default([]),
  title: z.string().min(1).max(200),
  reflective_question: z.string().max(500).optional().nullable(),
  page_count: z.coerce.number().int().min(1).max(20),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  frame_style: z.string().max(40).optional().nullable(),
  palette: z.array(z.string().max(24)).max(8).optional().nullable(),
  pages: z.array(PageInput).max(20).default([]),
  cover_image_path: z.string().max(500).optional().nullable(),
  page_images: z.array(z.string().max(500)).max(20).default([]),
  active: z.boolean().default(true),
  hidden: z.boolean().default(false),
  seasonal_start: z.string().length(10).optional().nullable(),
  seasonal_end: z.string().length(10).optional().nullable(),
  priority: z.coerce.number().int().default(0),
});

export const adminUpsertPreviewTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = { ...data, pages: data.pages as any };
    const table = supabaseAdmin.from("preview_templates");
    const { data: out, error } = data.id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? await table.update(row as any).eq("id", data.id).select("id").single()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : await table.insert(row as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: out?.id as string };
  });

export const adminDeletePreviewTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("preview_templates").delete().eq("id", data.id);
    return { ok: true as const };
  });

export const adminSetPreviewTemplateFlag = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      active: z.boolean().optional(),
      hidden: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { active?: boolean; hidden?: boolean } = {};
    if (data.active !== undefined) patch.active = data.active;
    if (data.hidden !== undefined) patch.hidden = data.hidden;
    await supabaseAdmin.from("preview_templates").update(patch).eq("id", data.id);
    return { ok: true as const };
  });

// -------- Admin: upload template image (cover or page) --------
const UploadInput = z.object({
  templateId: z.string().min(1).max(64),
  kind: z.enum(["cover", "page"]),
  pageIndex: z.coerce.number().int().min(0).max(20).optional().default(0),
  dataUrl: z.string().startsWith("data:image/").max(8 * 1024 * 1024),
});

export const adminUploadTemplateImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UploadInput.parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const m = data.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) throw new Error("صيغة الصورة غير مدعومة");
    const mime = m[1];
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const buf = Buffer.from(m[2], "base64");
    if (buf.byteLength > 4 * 1024 * 1024) throw new Error("حجم الصورة كبير جداً (الحد 4MB)");
    const name = data.kind === "cover" ? "cover" : `p${data.pageIndex}`;
    const path = `templates/${data.templateId}/${name}.${ext}`;
    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, {
      contentType: mime, upsert: true,
    });
    if (up.error) throw new Error(up.error.message);
    const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, SIGN_TTL);
    return { path, previewUrl: signed.data?.signedUrl ?? null };
  });
