// Server-only: encrypted cookie session for end-users (separate from admin).
import { useSession, getRequest } from "@tanstack/react-start/server";

export type UserSession = { userId?: string; phone?: string; name?: string };

export function getUserSessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password) throw new Error("SESSION_SECRET is not configured");
  const request = getRequest();
  const host = request?.headers.get("host") ?? "";
  const proto =
    request?.headers.get("x-forwarded-proto") ??
    request?.headers.get("x-forwarded-protocol") ??
    (request?.headers.get("x-forwarded-ssl") === "on" ? "https" : undefined) ??
    new URL(request?.url ?? "http://localhost").protocol.replace(":", "");
  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const secure = !isLocalhost && (proto === "https" || host.includes("lovable"));
  return {
    password,
    name: "basma-user",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    cookie: {
      httpOnly: true,
      secure,
      sameSite: (secure ? "none" : "lax") as "none" | "lax",
      partitioned: secure,
      path: "/",
    },
  };
}

export async function readUserSession() {
  return useSession<UserSession>(getUserSessionConfig());
}

export async function requireUserSession() {
  const s = await readUserSession();
  if (!s.data.userId) {
    const err = new Error("AuthRequired");
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }
  return s;
}
