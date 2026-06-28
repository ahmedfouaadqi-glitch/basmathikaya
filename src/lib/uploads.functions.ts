import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB per photo

const UploadCharacterPhotoInput = z.object({
  draftId: z.string().min(8).max(64),
  characterIndex: z.coerce.number().int().min(0).max(20),
  // data URL: "data:image/jpeg;base64,..."
  dataUrl: z.string().startsWith("data:image/").max(8 * 1024 * 1024),
});

/**
 * Uploads a character reference photo for a draft (pre-order).
 * Stored at story-uploads/drafts/{draftId}/char-{idx}.{ext}
 * The path is returned to the client and later submitted with createOrderDraft.
 */
export const uploadCharacterPhoto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UploadCharacterPhotoInput.parse(d))
  .handler(async ({ data }) => {
    const { requireUserSession } = await import("./user-session.server");
    await requireUserSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const m = data.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) throw new Error("صيغة الصورة غير مدعومة");
    const mime = m[1];
    const b64 = m[2];
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const buf = Buffer.from(b64, "base64");
    if (buf.byteLength > MAX_BYTES) throw new Error("حجم الصورة كبير جداً (الحد 4MB)");

    const path = `drafts/${data.draftId}/char-${data.characterIndex}.${ext}`;
    const up = await supabaseAdmin.storage
      .from("story-uploads")
      .upload(path, buf, { contentType: mime, upsert: true });
    if (up.error) throw new Error(up.error.message);

    const signed = await supabaseAdmin.storage
      .from("story-uploads")
      .createSignedUrl(path, 60 * 60);
    return { path, previewUrl: signed.data?.signedUrl ?? null };
  });
