import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// Hard-coded whitelist of admin phones. Env var ADMIN_PHONE is also accepted
// so the working number can rotate without a code deploy.
const ADMIN_PHONES = ["07733570130", "07705828333"];

function normalizePhone(p: string): string {
  return p.replace(/[\s\-()+]/g, "").replace(/^00964/, "0").replace(/^964/, "0");
}

function eqStr(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a, "utf8").digest();
  const bh = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ah, bh);
}

function allowedPhones(): string[] {
  const envPhone = process.env.ADMIN_PHONE ? normalizePhone(process.env.ADMIN_PHONE) : null;
  return envPhone ? Array.from(new Set([...ADMIN_PHONES, envPhone])) : ADMIN_PHONES;
}

function isAdminPhone(phone: string): boolean {
  return allowedPhones().some((p) => eqStr(phone, p));
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function getClientIp(): string | null {
  const req = getRequest();
  if (!req) return null;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip");
}

const LoginInput = z.object({
  phone: z.string().trim().min(1).max(40),
  code: z.string().trim().min(4).max(32),
});

/**
 * Single-step admin login: phone + static code.
 * The code is stored only as a SHA-256 hash in the ADMIN_CODE_HASH secret.
 * Rate-limited to 5 failed attempts per phone or IP in the last 15 minutes.
 */
export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LoginInput.parse(d))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    const ip = getClientIp();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Rate limit: 5 failed attempts / 15 min per phone or IP.
    const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count: byPhone } = await supabaseAdmin
      .from("admin_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .eq("success", false)
      .gte("created_at", cutoff);
    if ((byPhone ?? 0) >= 5) return { ok: false as const };
    if (ip) {
      const { count: byIp } = await supabaseAdmin
        .from("admin_login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .eq("success", false)
        .gte("created_at", cutoff);
      if ((byIp ?? 0) >= 5) return { ok: false as const };
    }

    const expectedHash = process.env.ADMIN_CODE_HASH?.trim().toLowerCase();
    if (!expectedHash || expectedHash.length !== 64) {
      // Misconfigured server: fail closed but do not leak reason.
      await supabaseAdmin.from("admin_login_attempts").insert({ phone, ip, success: false });
      return { ok: false as const };
    }

    const phoneOk = isAdminPhone(phone);
    const submittedHash = sha256Hex(data.code);
    let codeOk = false;
    try {
      const a = Buffer.from(submittedHash, "hex");
      const b = Buffer.from(expectedHash, "hex");
      codeOk = a.length === b.length && timingSafeEqual(a, b);
    } catch {
      codeOk = false;
    }

    if (!phoneOk || !codeOk) {
      await supabaseAdmin.from("admin_login_attempts").insert({ phone, ip, success: false });
      return { ok: false as const };
    }

    await supabaseAdmin.from("admin_login_attempts").insert({ phone, ip, success: true });

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
