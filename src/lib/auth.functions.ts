import { createServerFn } from "@tanstack/react-start";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const RequestOtpInput = z.object({
  full_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(5).max(40),
});

const VerifyOtpInput = z.object({
  phone: z.string().trim().min(5).max(40),
  code: z.string().trim().length(6),
  full_name: z.string().trim().min(2).max(80),
});

function hashCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export const requestOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RequestOtpInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizePhone, sendOtp } = await import("./sms.server");
    const phone = normalizePhone(data.phone);

    // Block banned phones before anything else.
    const { data: banned } = await supabaseAdmin
      .from("phone_bans").select("reason").eq("phone", phone).maybeSingle();
    if (banned) throw new Error(`رقم الهاتف محظور${banned.reason ? ` — ${banned.reason}` : ""}`);

    // Rate limit: max 3 codes per hour per phone
    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: recent } = await supabaseAdmin
      .from("otp_codes")
      .select("id")
      .eq("phone", phone)
      .gte("created_at", sinceIso);
    if ((recent?.length ?? 0) >= 3) {
      throw new Error("تم تجاوز عدد المحاولات. حاول بعد ساعة.");
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabaseAdmin.from("otp_codes").insert({
      phone,
      code_hash: hashCode(code),
      expires_at: expiresAt,
    });

    const send = await sendOtp(phone, code, "ar");
    return { ok: true as const, phone, via: send.via, dev_code: send.via === "dev" ? code : null };
  });

export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => VerifyOtpInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readUserSession } = await import("./user-session.server");
    const { normalizePhone } = await import("./sms.server");
    const phone = normalizePhone(data.phone);

    const { data: rows } = await supabaseAdmin
      .from("otp_codes")
      .select("id, code_hash, expires_at, attempts, consumed_at")
      .eq("phone", phone)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = rows?.[0];
    if (!row) throw new Error("لا يوجد رمز فعّال — اطلب رمزاً جديداً.");
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new Error("انتهت صلاحية الرمز.");
    }
    if (row.attempts >= 5) throw new Error("تم تجاوز عدد المحاولات.");

    const ok = (() => {
      const a = Buffer.from(row.code_hash, "hex");
      const b = Buffer.from(hashCode(data.code), "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    })();

    if (!ok) {
      await supabaseAdmin.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      throw new Error("رمز غير صحيح.");
    }

    await supabaseAdmin
      .from("otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);

    // Upsert user
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id, full_name")
      .eq("phone", phone)
      .maybeSingle();

    let userId: string;
    if (existing) {
      userId = existing.id;
      await supabaseAdmin
        .from("users")
        .update({ full_name: data.full_name, last_login_at: new Date().toISOString() })
        .eq("id", userId);
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("users")
        .insert({ full_name: data.full_name, phone, last_login_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message || "فشل إنشاء المستخدم");
      userId = created.id;
    }

    const s = await readUserSession();
    await s.update({ userId, phone, name: data.full_name });
    return { ok: true as const, userId };
  });

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const { readUserSession } = await import("./user-session.server");
  const s = await readUserSession();
  if (!s.data.userId) return null;
  return { id: s.data.userId, phone: s.data.phone ?? "", name: s.data.name ?? "" };
});

export const userLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { readUserSession } = await import("./user-session.server");
  const s = await readUserSession();
  await s.clear();
  return { ok: true as const };
});

/* ---------------------------------------------------------------------------
 * Email login (alternative to phone OTP). Same one-time-code flow.
 * ------------------------------------------------------------------------- */

const RequestEmailOtpInput = z.object({
  full_name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(200),
});

const VerifyEmailOtpInput = z.object({
  email: z.string().trim().email().max(200),
  code: z.string().trim().length(6),
  full_name: z.string().trim().min(2).max(80),
});

export const requestEmailOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RequestEmailOtpInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeEmail, sendLoginCodeEmail } = await import("./email.server");
    const email = normalizeEmail(data.email);

    // Rate limit: max 3 codes per hour per email
    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("email_otp_codes")
      .select("id")
      .eq("email", email)
      .gte("created_at", sinceIso);
    if ((recent?.length ?? 0) >= 3) {
      throw new Error("تم تجاوز عدد المحاولات. حاول بعد ساعة.");
    }

    const code = String(randomInt(100000, 1000000));
    await supabaseAdmin.from("email_otp_codes").insert({
      email,
      code_hash: hashCode(code),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    const send = await sendLoginCodeEmail(email, code);
    if (!send.ok) throw new Error("تعذّر إرسال الرمز إلى بريدك. حاول لاحقاً.");
    return { ok: true as const, email, via: send.via, dev_code: send.via === "dev" ? code : null };
  });

export const verifyEmailOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => VerifyEmailOtpInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readUserSession } = await import("./user-session.server");
    const { normalizeEmail } = await import("./email.server");
    const email = normalizeEmail(data.email);

    const { data: rows } = await supabaseAdmin
      .from("email_otp_codes")
      .select("id, code_hash, expires_at, attempts, consumed_at")
      .eq("email", email)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = rows?.[0];
    if (!row) throw new Error("لا يوجد رمز فعّال — اطلب رمزاً جديداً.");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("انتهت صلاحية الرمز.");
    if (row.attempts >= 5) throw new Error("تم تجاوز عدد المحاولات.");

    const ok = (() => {
      const a = Buffer.from(row.code_hash, "hex");
      const b = Buffer.from(hashCode(data.code), "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    })();
    if (!ok) {
      await supabaseAdmin.from("email_otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      throw new Error("رمز غير صحيح.");
    }

    await supabaseAdmin
      .from("email_otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);

    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id, phone")
      .ilike("email", email)
      .maybeSingle();

    let userId: string;
    let phone = "";
    if (existing) {
      userId = existing.id;
      phone = existing.phone ?? "";
      await supabaseAdmin
        .from("users")
        .update({ full_name: data.full_name, last_login_at: new Date().toISOString() })
        .eq("id", userId);
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("users")
        .insert({ full_name: data.full_name, email, last_login_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message || "فشل إنشاء المستخدم");
      userId = created.id;
    }

    const s = await readUserSession();
    await s.update({ userId, phone, name: data.full_name });
    return { ok: true as const, userId };
  });
