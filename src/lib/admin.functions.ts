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

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LoginInput.parse(d))
  .handler(async ({ data }) => {
    const expectedPhone = process.env.ADMIN_PHONE;
    const expectedCode = process.env.ADMIN_CODE;
    if (!expectedPhone || !expectedCode) {
      throw new Error("Admin credentials not configured");
    }
    const ok = eq(data.phone, expectedPhone) && eq(data.code, expectedCode);
    if (!ok) return { ok: false as const };
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
