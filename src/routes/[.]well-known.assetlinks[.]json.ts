import { createFileRoute } from "@tanstack/react-router";

const DEFAULT_PACKAGE = "space.urstory.app";

function parseFingerprints(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
}

export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: async () => {
        const packageName = process.env["ANDROID_PACKAGE_NAME"] || DEFAULT_PACKAGE;
        const fingerprints = parseFingerprints(process.env["ANDROID_SHA256_FINGERPRINTS"]);

        const body =
          fingerprints.length === 0
            ? []
            : [
                {
                  relation: ["delegate_permission/common.handle_all_urls"],
                  target: {
                    namespace: "android_app",
                    package_name: packageName,
                    sha256_cert_fingerprints: fingerprints,
                  },
                },
              ];

        return new Response(JSON.stringify(body, null, 2), {
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=300",
            "access-control-allow-origin": "*",
          },
        });
      },
    },
  },
});
