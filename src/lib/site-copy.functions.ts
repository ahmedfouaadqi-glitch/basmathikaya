import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const SITE_COPY_KEYS = [
  "create.adult_notice",
  "policy.intro",
  "policy.safe",
  "policy.review",
  "policy.rejected",
  "policy.privacy",
] as const;

export type SiteCopyRow = {
  key: string;
  title: string | null;
  body_md: string;
  updated_at: string;
  updated_by: string | null;
};

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const getSiteCopy = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ key: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await publicClient();
    const { data: row } = await sb
      .from("site_copy")
      .select("key,title,body_md,updated_at,updated_by")
      .eq("key", data.key)
      .maybeSingle();
    return (row as SiteCopyRow | null) ?? { key: data.key, title: null, body_md: "", updated_at: "", updated_by: null };
  });

export const getSiteCopyBulk = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ keys: z.array(z.string().min(1).max(120)).min(1).max(50) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await publicClient();
    const { data: rows } = await sb
      .from("site_copy")
      .select("key,title,body_md,updated_at,updated_by")
      .in("key", data.keys);
    const map: Record<string, SiteCopyRow> = {};
    for (const r of (rows as SiteCopyRow[] | null) ?? []) map[r.key] = r;
    return map;
  });

export const adminListSiteCopy = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("site_copy")
    .select("key,title,body_md,updated_at,updated_by")
    .order("key");
  return (data as SiteCopyRow[] | null) ?? [];
});

export const adminUpsertSiteCopy = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        key: z.string().min(1).max(120),
        title: z.string().max(200).nullable().optional(),
        body_md: z.string().max(20000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_copy").upsert({
      key: data.key,
      title: data.title ?? null,
      body_md: data.body_md,
      updated_by: "admin",
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      actor_type: "admin",
      actor_id: "admin",
      action: "site_copy_update",
      target_type: "site_copy",
      target_id: data.key,
      after: { title: data.title ?? null, len: data.body_md.length } as never,
    });
    return { ok: true };
  });
