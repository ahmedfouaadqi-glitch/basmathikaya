// Server-only: shared password gate session for /admin
export type AdminSession = { authenticated?: boolean };

export async function getAdminSessionConfig() {
  const { getRequest } = await import("@tanstack/react-start/server");
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
    name: "basma-admin",
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      secure,
      sameSite: (secure ? "none" : "lax") as "none" | "lax",
      partitioned: secure,
      path: "/",
    },
  };
}

export async function readAdminSession() {
  const { useSession } = await import("@tanstack/react-start/server");
  return useSession<AdminSession>(await getAdminSessionConfig());
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
