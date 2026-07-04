import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual, randomInt } from "node:crypto";
import { z } from "zod";

// Hard-coded whitelist of admin phones. Env var ADMIN_PHONE is also accepted
// so the working number can rotate without a code deploy.
const ADMIN_PHONES = ["07733570130", "07705828333"];

// Phone -> email map. Kept server-side. ADMIN_EMAIL env var (optional) applies
// to the first phone in the list.
const ADMIN_EMAILS: Record<string, string> = {
  "07733570130": "ahmedfouaad.qi@gmail.com",
  "07705828333": "ahmedfouaad.qi@gmail.com",
};

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
  return allowedPhones().some((p) => eq(phone, p));
}

function emailForPhone(phone: string): string | null {
  const envEmail = process.env.ADMIN_EMAIL?.trim();
  const envPhone = process.env.ADMIN_PHONE ? normalizePhone(process.env.ADMIN_PHONE) : null;
  if (envEmail && envPhone && eq(phone, envPhone)) return envEmail;
  return ADMIN_EMAILS[phone] ?? envEmail ?? null;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

function getClientIp(): string | null {
  const req = getRequest();
  if (!req) return null;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip");
}

function getBaseUrl(): string {
  const req = getRequest();
  const host = req?.headers.get("host") ?? "";
  const proto =
    req?.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Generates a uniformly-random 6-digit OTP using node:crypto (not sequential). */
function generateOtp(): string {
  const n = randomInt(0, 1_000_000); // 0..999999
  return n.toString().padStart(6, "0");
}

async function sendAdminOtpEmail(email: string, code: string): Promise<{ sent: boolean; dev: boolean }> {
  // Prefer the Lovable transactional email queue if it's scaffolded.
  // Falls back to a dev console log so the login flow still works before the
  // email domain is configured.
  const baseUrl = getBaseUrl();
  const lovableKey = process.env.LOVABLE_API_KEY;
  try {
    const res = await fetch(`${baseUrl}/lovable/email/transactional/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(lovableKey ? { Authorization: `Bearer ${lovableKey}` } : {}),
        "x-internal-caller": "admin-otp",
      },
      body: JSON.stringify({
        templateName: "admin-otp",
        recipientEmail: email,
        idempotencyKey: `admin-otp-${hashCode(code).slice(0, 24)}`,
        templateData: { code, expiresInMinutes: 5 },
      }),
    });
    if (res.ok) return { sent: true, dev: false };
  } catch {
    // fall through
  }
  // Dev fallback — do NOT log in production.
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(`[ADMIN OTP DEV] email=${email} code=${code}`);
    return { sent: true, dev: true };
  }
  return { sent: false, dev: false };
}

const RequestInput = z.object({ phone: z.string().trim().min(1).max(40) });
const VerifyInput = z.object({
  phone: z.string().trim().min(1).max(40),
  code: z.string().trim().regex(/^\d{6}$/, "الرمز يجب أن يتكون من 6 أرقام"),
});

/**
 * Step 1: user submits phone. If it matches an admin phone we generate a
 * random 6-digit OTP, store its SHA-256, and email it to the admin.
 * Response is intentionally identical regardless of match to prevent phone
 * enumeration.
 */
export const adminRequestOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RequestInput.parse(d))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    const ip = getClientIp();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Rate-limit: 3 requests / 15 min per phone; 10 / 15 min per IP.
    const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count: byPhone } = await supabaseAdmin
      .from("admin_otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", cutoff);
    if ((byPhone ?? 0) >= 3) return { ok: true as const };
    if (ip) {
      const { count: byIp } = await supabaseAdmin
        .from("admin_otp_codes")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("created_at", cutoff);
      if ((byIp ?? 0) >= 10) return { ok: true as const };
    }

    if (!isAdminPhone(phone)) return { ok: true as const };

    const email = emailForPhone(phone);
    if (!email) return { ok: true as const };

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    await supabaseAdmin.from("admin_otp_codes").insert({
      phone,
      code_hash: hashCode(code),
      expires_at: expiresAt,
      ip,
    });

    await sendAdminOtpEmail(email, code);
    return { ok: true as const };
  });

/**
 * Step 2: user submits phone + 6-digit code. On success we mark the row used
 * and open the admin session cookie.
 */
export const adminVerifyOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => VerifyInput.parse(d))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!isAdminPhone(phone)) return { ok: false as const, reason: "invalid" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("admin_otp_codes")
      .select("id, code_hash, expires_at, used_at, attempts")
      .eq("phone", phone)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const row = rows?.[0];
    if (!row) return { ok: false as const, reason: "invalid" };
    if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false as const, reason: "expired" };
    if ((row.attempts ?? 0) >= 5) return { ok: false as const, reason: "locked" };

    const submittedHash = hashCode(data.code);
    const a = Buffer.from(submittedHash, "hex");
    const b = Buffer.from(row.code_hash, "hex");
    const match = a.length === b.length && timingSafeEqual(a, b);

    if (!match) {
      await supabaseAdmin
        .from("admin_otp_codes")
        .update({ attempts: (row.attempts ?? 0) + 1 })
        .eq("id", row.id);
      return { ok: false as const, reason: "invalid" };
    }

    await supabaseAdmin
      .from("admin_otp_codes")
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
