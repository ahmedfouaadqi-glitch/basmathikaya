import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "node:crypto";

const IdInput = z.object({ orderId: z.string().uuid() });
const TokenInput = z.object({ token: z.string().min(8).max(64) });

function makeToken(): string {
  return randomBytes(16).toString("base64url");
}

export const ensureShareToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data }): Promise<{ token: string; url: string }> => {
    const { requireUserSession } = await import("./user-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireUserSession();
    const userId = s.data.userId!;

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, share_token, status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order || order.user_id !== userId) throw new Error("NotFound");

    let token = order.share_token;
    if (!token) {
      token = makeToken();
      const { error: upErr } = await supabaseAdmin
        .from("orders")
        .update({ share_token: token })
        .eq("id", data.orderId);
      if (upErr) throw new Error(upErr.message);
    }
    return { token, url: `/s/${token}` };
  });

export type ShareCardMeta = {
  token: string;
  orderNumber: number;
  title: string | null;
  coverImagePath: string | null;
};

export const getShareCardMeta = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => TokenInput.parse(d))
  .handler(async ({ data }): Promise<ShareCardMeta | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, title, share_token, status")
      .eq("share_token", data.token)
      .maybeSingle();
    if (!order) return null;

    // Fetch first available page image for cover
    const { data: page } = await supabaseAdmin
      .from("story_pages")
      .select("image_path")
      .eq("order_id", order.id)
      .not("image_path", "is", null)
      .order("page_number", { ascending: true })
      .limit(1)
      .maybeSingle();

    return {
      token: order.share_token!,
      orderNumber: order.order_number,
      title: order.title,
      coverImagePath: page?.image_path ?? null,
    };
  });

/**
 * Server-only helper: returns a fresh signed URL for the share card's cover image.
 * Used by the /api/public/share-cards/$token.png route.
 */
export async function getShareCardSignedCoverUrl(
  token: string,
): Promise<{ url: string; expiresIn: number } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("share_token", token)
    .maybeSingle();
  if (!order) return null;

  const { data: page } = await supabaseAdmin
    .from("story_pages")
    .select("image_path")
    .eq("order_id", order.id)
    .not("image_path", "is", null)
    .order("page_number", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!page?.image_path) return null;

  const expiresIn = 60 * 60 * 24; // 24h
  const { data: signed, error } = await supabaseAdmin.storage
    .from("story-covers")
    .createSignedUrl(page.image_path, expiresIn);
  if (error || !signed) {
    // Try story-uploads bucket as fallback
    const { data: alt } = await supabaseAdmin.storage
      .from("story-uploads")
      .createSignedUrl(page.image_path, expiresIn);
    if (!alt) return null;
    return { url: alt.signedUrl, expiresIn };
  }
  return { url: signed.signedUrl, expiresIn };
}

// ============= Public story reader (used by /s/$token gallery links) =============

export type PublicStoryPage = { number: number; text: string; image_url: string | null };
export type PublicStory = {
  orderNumber: number;
  title: string | null;
  public_title: string | null;
  show_author: boolean;
  public_author_name: string | null;
  cover_url: string | null;
  pages: PublicStoryPage[];
};

/**
 * Returns full story pages for a public+delivered order.
 * Returns null when the order is not public or not delivered — the caller can
 * fall back to the marketing share card view.
 */
export const getPublicStory = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => TokenInput.parse(d))
  .handler(async ({ data }): Promise<PublicStory | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, title, public_title, is_public, status, show_author, public_author_name")
      .eq("share_token", data.token)
      .maybeSingle();
    if (!order) return null;
    const o = order as {
      id: string;
      order_number: number;
      title: string | null;
      public_title: string | null;
      is_public: boolean | null;
      status: string | null;
      show_author: boolean | null;
      public_author_name: string | null;
    };
    if (!o.is_public || o.status !== "delivered") return null;

    const { data: gen } = await supabaseAdmin
      .from("generations")
      .select("cover_image_path")
      .eq("order_id", o.id)
      .maybeSingle();
    const { data: pages } = await supabaseAdmin
      .from("story_pages")
      .select("page_number, text, image_path")
      .eq("order_id", o.id)
      .order("page_number");

    const expiresIn = 60 * 60 * 6;
    let cover_url: string | null = null;
    if (gen?.cover_image_path) {
      const s = await supabaseAdmin.storage
        .from("story-covers")
        .createSignedUrl(gen.cover_image_path, expiresIn);
      cover_url = s.data?.signedUrl ?? null;
    }
    const outPages: PublicStoryPage[] = await Promise.all(
      (pages ?? []).map(async (p) => {
        let url: string | null = null;
        if (p.image_path) {
          const s = await supabaseAdmin.storage
            .from("story-covers")
            .createSignedUrl(p.image_path, expiresIn);
          url = s.data?.signedUrl ?? null;
        }
        return { number: p.page_number as number, text: (p.text as string | null) ?? "", image_url: url };
      }),
    );

    return {
      orderNumber: o.order_number,
      title: o.title,
      public_title: o.public_title,
      show_author: !!o.show_author,
      public_author_name: o.public_author_name,
      cover_url,
      pages: outPages,
    };
  });

