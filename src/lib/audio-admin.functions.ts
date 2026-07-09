// Admin CRUD for the audio library. Requires admin session.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function requireAdminSession() {
  const { requireAdmin } = await import("./admin-session.server");
  return requireAdmin();
}
async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function audit(action: string, target_id: string | null, after?: unknown) {
  try {
    const s = await db();
    await s.from("audit_log").insert({
      actor_type: "admin", actor_id: "admin",
      action, target_type: "audio_library", target_id,
      before: null as never, after: (after ?? null) as never,
    });
  } catch { /* ignore */ }
}

/** List everything, active or not. */
export const adminListAudio = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const s = await db();
  const { data, error } = await s.from("audio_library").select("*").order("kind").order("display_order").order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
});

/** Return a short-lived signed URL for an admin to preview a file. */
export const adminSignAudio = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ filePath: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    if (data.filePath.startsWith("http")) return { url: data.filePath };
    const s = await db();
    const { data: signed, error } = await s.storage.from("audio-library")
      .createSignedUrl(data.filePath, 60 * 30);
    if (error || !signed) throw new Error(error?.message ?? "sign failed");
    return { url: signed.signedUrl };
  });

/** Upload a new audio file (base64) and create a library row. */
export const adminUploadAudio = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    kind: z.enum(["music", "sfx"]),
    slot: z.enum(["click", "success", "error", "notify", "nav"]).nullable().optional(),
    title_ar: z.string().min(1).max(120),
    filename: z.string().min(1).max(200),
    mime_type: z.string().default("audio/mpeg"),
    base64: z.string().min(1),
    duration_sec: z.number().min(0).max(600).optional(),
    volume_default: z.number().min(0).max(1).default(0.6),
  }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    if (data.kind === "sfx" && !data.slot) throw new Error("slot is required for sfx items");
    const s = await db();

    // If replacing an existing sfx slot, deactivate the old row so the unique
    // partial index (slot WHERE kind='sfx' AND is_active) stays satisfied.
    if (data.kind === "sfx" && data.slot) {
      await s.from("audio_library").update({ is_active: false } as never)
        .eq("kind", "sfx").eq("slot", data.slot).eq("is_active", true);
    }

    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${data.kind}/${Date.now()}-${safeName}`;
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));

    const up = await s.storage.from("audio-library").upload(storagePath, bytes, {
      contentType: data.mime_type,
      upsert: false,
    });
    if (up.error) throw new Error(up.error.message);

    const { data: inserted, error } = await s.from("audio_library").insert({
      kind: data.kind,
      slot: data.slot ?? null,
      title_ar: data.title_ar,
      file_path: storagePath,
      mime_type: data.mime_type,
      duration_sec: data.duration_sec ?? null,
      volume_default: data.volume_default,
      is_active: true,
      display_order: 0,
    } as never).select("*").single();
    if (error) throw new Error(error.message);

    await audit("audio.upload", inserted.id, { kind: data.kind, slot: data.slot, title: data.title_ar });
    return inserted;
  });

export const adminUpdateAudio = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    title_ar: z.string().max(120).optional(),
    is_active: z.boolean().optional(),
    display_order: z.number().int().optional(),
    volume_default: z.number().min(0).max(1).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const patch: Record<string, unknown> = {};
    if (data.title_ar !== undefined) patch.title_ar = data.title_ar;
    if (data.is_active !== undefined) patch.is_active = data.is_active;
    if (data.display_order !== undefined) patch.display_order = data.display_order;
    if (data.volume_default !== undefined) patch.volume_default = data.volume_default;
    const s = await db();
    const { error } = await s.from("audio_library").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("audio.update", data.id, patch);
    return { ok: true as const };
  });

export const adminDeleteAudio = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    const { data: row } = await s.from("audio_library").select("file_path").eq("id", data.id).maybeSingle();
    if (row?.file_path && !row.file_path.startsWith("http")) {
      await s.storage.from("audio-library").remove([row.file_path]);
    }
    const { error } = await s.from("audio_library").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("audio.delete", data.id, null);
    return { ok: true as const };
  });
