import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** List current user's notifications (most recent first). */
export const listMyNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUserSession } = await import("./user-session.server");
  const s = await requireUserSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("notifications")
    .select("id, title, body, kind, read_at, created_at, order_id")
    .eq("user_id", s.data.userId!)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
});

export const markNotificationRead = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireUserSession } = await import("./user-session.server");
    const s = await requireUserSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", s.data.userId!);
    return { ok: true as const };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" }).handler(async () => {
  const { requireUserSession } = await import("./user-session.server");
  const s = await requireUserSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .eq("user_id", s.data.userId!);
  return { ok: true as const };
});
