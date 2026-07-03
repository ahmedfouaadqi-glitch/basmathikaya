import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual, randomBytes } from "node:crypto";
import { z } from "zod";

// Hard-coded whitelist of admin phones. Env var ADMIN_PHONE is also accepted
// so the working number can rotate without a code deploy.
const ADMIN_PHONES = ["07733570130", "07705828333"];

function normalizePhone(p: string): string {
  return p.replace(/[\s\-()+]/g, "").replace(/^00964/, "0").replace(/^964/, "0");
}

function eq(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a, "utf8").digest();
  const bh = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ah, bh);
}

function allowedPhones(): string[] {
  const envPhone = process.env.ADMIN_PHONE ? normalizePhone(process.env.ADMIN_PHONE) : null;
  return envPhone ? Array.from(new Set([...ADMIN_PHONES, envPhone])) : ADMIN_PHONES;
}

function isAdminPhone(phone: string): boolean {
  const list = allowedPhones();
  return list.some((p) => eq(phone, p));
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function getBaseUrl(): string {
  const req = getRequest();
  const host = req?.headers.get("host") ?? "";
  const proto =
    req?.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

function getClientIp(): string | null {
  const req = getRequest();
  if (!req) return null;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip");
}

const RequestInput = z.object({ phone: z.string().trim().min(1).max(40) });
const ConsumeInput = z.object({ token: z.string().trim().min(20).max(128) });

/**
 * Step 1: user types their phone; if it matches an admin phone we generate a
 * random one-time token, store its SHA-256 hash, and WhatsApp/SMS the login
 * link. Response is intentionally identical whether or not the phone matches
 * so an attacker cannot enumerate admin phone numbers.
 */
export const adminRequestMagicLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RequestInput.parse(d))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    const ip = getClientIp();

    // Rate-limit: at most 3 attempts per 15 minutes per phone or IP.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count: byPhone } = await supabaseAdmin
      .from("admin_login_tokens")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", cutoff);
    if ((byPhone ?? 0) >= 3) return { ok: true as const }; // silently succeed
    if (ip) {
      const { count: byIp } = await supabaseAdmin
        .from("admin_login_tokens")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("created_at", cutoff);
      if ((byIp ?? 0) >= 10) return { ok: true as const };
    }

    if (!isAdminPhone(phone)) {
      // Do NOT reveal that the phone is not an admin — return ok.
      return { ok: true as const };
    }

    const token = randomBytes(32).toString("hex"); // 64-char, ~256 bits
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    await supabaseAdmin.from("admin_login_tokens").insert({
      phone,
      token_hash: hashToken(token),
      expires_at: expiresAt,
      ip,
    });

    const baseUrl = getBaseUrl();
    const link = `${baseUrl}/admin/magic/${token}`;
    const body =
      `🔐 رابط دخول لوحة الإدارة — بصمة حكاية\n\n` +
      `${link}\n\n` +
      `صالح لـ 10 دقائق ولاستخدام مرة واحدة فقط.\n` +
      `إن لم تكن أنت من طلب الدخول، تجاهل هذه الرسالة.`;

    const { sendWhatsappOrSms } = await import("./sms.server");
    await sendWhatsappOrSms(phone.startsWith("+") ? phone : `+964${phone.replace(/^0/, "")}`, body);

    return { ok: true as const };
  });

/**
 * Step 2: user clicks the link on their phone. We hash the token, look it up,
 * mark it used, and start the admin session cookie.
 */
export const adminConsumeMagicLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ConsumeInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hash = hashToken(data.token);
    const { data: row } = await supabaseAdmin
      .from("admin_login_tokens")
      .select("id, phone, expires_at, used_at")
      .eq("token_hash", hash)
      .maybeSingle();

    if (!row) return { ok: false as const, reason: "invalid" };
    if (row.used_at) return { ok: false as const, reason: "used" };
    if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false as const, reason: "expired" };
    if (!isAdminPhone(row.phone)) return { ok: false as const, reason: "invalid" };

    await supabaseAdmin
      .from("admin_login_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id);

    const { readAdminSession } = await import("./admin-session.server");
    const s = await readAdminSession();
    await s.update({ authenticated: true });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { readAdminSession } = await import("./admin-session.server");
  const s = await readAdminSession();
  await s.clear();
  return { ok: true as const };
});

export const adminCheck = createServerFn({ method: "GET" }).handler(async () => {
  const { readAdminSession } = await import("./admin-session.server");
  const s = await readAdminSession();
  return { authenticated: !!s.data.authenticated };
});
