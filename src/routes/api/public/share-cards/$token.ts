import { createFileRoute } from "@tanstack/react-router";
import { getShareCardSignedCoverUrl } from "@/lib/share.functions";

export const Route = createFileRoute("/api/public/share-cards/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String(params.token || "").replace(/\.png$/i, "");
        if (!token || token.length < 8) {
          return new Response("Bad request", { status: 400 });
        }
        try {
          const signed = await getShareCardSignedCoverUrl(token);
          if (!signed) return new Response("Not found", { status: 404 });
          // Redirect to the signed URL. Social crawlers follow 302s for og:image.
          return new Response(null, {
            status: 302,
            headers: {
              Location: signed.url,
              "Cache-Control": "public, max-age=3600",
            },
          });
        } catch {
          return new Response("Error", { status: 500 });
        }
      },
    },
  },
});
