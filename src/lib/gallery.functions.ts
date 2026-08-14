import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type GalleryItem = {
  id: string;
  order_number: number;
  title: string | null;
  public_title: string | null;
  share_token: string | null;
  cover_signed_url: string | null;
  created_at: string;
  featured: boolean;
  show_author: boolean;
  public_author_name: string | null;
  gallery_category: "kids" | "adults" | "general";
};

const ListInput = z.object({
  limit: z.number().int().min(1).max(60).optional(),
  featuredOnly: z.boolean().optional(),
  category: z.enum(["kids", "adults", "general"]).default("kids"),
  adultConfirmed: z.boolean().default(false),
});

async function signCoverForOrder(orderId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: page } = await supabaseAdmin
    .from("story_pages")
    .select("image_path")
    .eq("order_id", orderId)
    .not("image_path", "is", null)
    .order("page_number", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!page?.image_path) return null;
  const expiresIn = 60 * 60 * 6;
  const { data: signed } = await supabaseAdmin.storage
    .from("story-covers")
    .createSignedUrl(page.image_path, expiresIn);
  if (signed?.signedUrl) return signed.signedUrl;
  const { data: alt } = await supabaseAdmin.storage
    .from("story-uploads")
    .createSignedUrl(page.image_path, expiresIn);
  return alt?.signedUrl ?? null;
}

/**
 * Public gallery — no auth. Returns orders marked is_public + delivered.
 */
export const listPublicGallery = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data }): Promise<GalleryItem[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limit = data.limit ?? 24;
    if (data.category === "adults" && !data.adultConfirmed) {
      throw new Error("تأكيد أن المستخدم بالغ مطلوب لعرض هذا المعرض");
    }

    let q = supabaseAdmin
      .from("orders")
      .select("id, order_number, title, public_title, share_token, created_at, gallery_featured, show_author, public_author_name, gallery_category")
      .eq("is_public", true)
      .eq("status", "delivered")
      .eq("gallery_category", data.category)
      .order("gallery_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (data.featuredOnly) q = q.eq("gallery_featured", true);

    const { data: rows } = await q;
    const list = (rows ?? []) as Array<{
      id: string;
      order_number: number;
      title: string | null;
      public_title: string | null;
      share_token: string | null;
      created_at: string;
      gallery_featured: boolean | null;
      show_author: boolean | null;
      public_author_name: string | null;
      gallery_category: "kids" | "adults" | "general";
    }>;
    const items = await Promise.all(
      list.map(async (r) => ({
        id: r.id,
        order_number: r.order_number,
        title: r.title,
        public_title: r.public_title,
        share_token: r.share_token,
        cover_signed_url: await signCoverForOrder(r.id),
        created_at: r.created_at,
        featured: !!r.gallery_featured,
        show_author: !!r.show_author,
        public_author_name: r.public_author_name,
        gallery_category: r.gallery_category,
      })),
    );
    return items;
  });

const ToggleInput = z.object({
  orderId: z.string().uuid(),
  isPublic: z.boolean(),
  publicTitle: z.string().max(120).optional(),
  showAuthor: z.boolean().optional(),
  publicAuthorName: z.string().max(80).optional().nullable(),
});

export const setOrderPublic = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ToggleInput.parse(d))
  .handler(async ({ data }) => {
    const { requireUserSession } = await import("./user-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireUserSession();
    const userId = s.data.userId!;

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.user_id !== userId) throw new Error("NotFound");
    if (order.status !== "delivered") throw new Error("قصص مسلّمة فقط تُعرض");

    const patch: {
      is_public: boolean;
      public_title?: string | null;
      show_author?: boolean;
      public_author_name?: string | null;
    } = { is_public: data.isPublic };
    if (data.publicTitle !== undefined) patch.public_title = data.publicTitle || null;
    if (data.showAuthor !== undefined) {
      patch.show_author = data.showAuthor;
      if (data.showAuthor) {
        // If asked to show author but no explicit name provided, fall back to the user's full_name.
        let name = (data.publicAuthorName ?? "").trim();
        if (!name) {
          const { data: u } = await supabaseAdmin
            .from("users")
            .select("full_name")
            .eq("id", userId)
            .maybeSingle();
          name = ((u?.full_name as string | null) ?? "").trim();
        }
        patch.public_author_name = name || null;
      } else {
        patch.public_author_name = null;
      }
    } else if (data.publicAuthorName !== undefined) {
      patch.public_author_name = (data.publicAuthorName ?? "") || null;
    }

    const { error } = await supabaseAdmin.from("orders").update(patch).eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
