// Server-only: shared password gate session for /admin
import { useSession } from "@tanstack/react-start/server";
import { getRequest } from "@tanstack/react-start/server";

export type AdminSession = { authenticated?: boolean };

export function getAdminSessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password) throw new Error("SESSION_SECRET is not configured");
  const request = getRequest();
  const host = request?.headers.get("host") ?? "";
  const proto = request?.headers.get("x-forwarded-proto") ?? new URL(request?.url ?? "http://localhost").protocol.replace(":", "");
  const secure = proto === "https" && !host.startsWith("localhost") && !host.startsWith("127.0.0.1");
  return {
    password,
    name: "basma-admin",
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      secure,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export async function readAdminSession() {
  return useSession<AdminSession>(getAdminSessionConfig());
}

export async function requireAdmin() {
  const s = await readAdminSession();
  if (!s.data.authenticated) {
    const err = new Error("Unauthorized");
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }
  return s;
}
