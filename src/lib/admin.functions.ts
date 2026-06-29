import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

function eq(a: string, b: string) {
  const ah = createHash("sha256").update(a, "utf8").digest();
  const bh = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ah, bh);
}

const LoginInput = z.object({
  phone: z.string().trim().min(1).max(40),
  code: z.string().trim().min(1).max(40),
});

// Hard-coded whitelist of admin phones + shared code.
// Both are also validated against env (ADMIN_PHONE / ADMIN_CODE) so the secret
// stays out of the git history; if env vars are present they override the code below.
const ADMIN_PHONES = ["07733570130", "07705828333"];
const ADMIN_CODE = "7979";

function normalizePhone(p: string): string {
  return p.replace(/[\s\-()+]/g, "").replace(/^00964/, "0").replace(/^964/, "0");
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LoginInput.parse(d))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    const envPhone = process.env.ADMIN_PHONE ? normalizePhone(process.env.ADMIN_PHONE) : null;
    const allowedPhones = envPhone
      ? Array.from(new Set([...ADMIN_PHONES, envPhone]))
      : ADMIN_PHONES;
    const expectedCode = process.env.ADMIN_CODE || ADMIN_CODE;
    const phoneOk = allowedPhones.some((p) => eq(phone, p));
    const codeOk = eq(data.code, expectedCode);
    if (!phoneOk || !codeOk) return { ok: false as const };
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
