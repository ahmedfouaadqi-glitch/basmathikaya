import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://basmathikaya.lovable.app";

type Entry = { path: string; changefreq?: string; priority?: string };

const STATIC_ENTRIES: Entry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/gallery", changefreq: "daily", priority: "0.9" },
  { path: "/how-it-works", changefreq: "monthly", priority: "0.7" },
  { path: "/pricing", changefreq: "weekly", priority: "0.8" },
  { path: "/testimonials", changefreq: "weekly", priority: "0.6" },
  { path: "/faq", changefreq: "monthly", priority: "0.6" },
  { path: "/create", changefreq: "monthly", priority: "0.7" },
  { path: "/auth", changefreq: "yearly", priority: "0.3" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // Public shared stories (dynamic)
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: shared } = await supabaseAdmin
          .from("orders")
          .select("share_token, updated_at")
          .eq("is_public", true)
          .eq("status", "delivered")
          .not("share_token", "is", null)
          .order("updated_at", { ascending: false })
          .limit(500);

        const dynamic: Entry[] = (shared ?? []).map((s) => ({
          path: `/s/${s.share_token}`,
          changefreq: "monthly",
          priority: "0.5",
        }));

        const all = [...STATIC_ENTRIES, ...dynamic];
        const urls = all
          .map((e) =>
            [
              "  <url>",
              `    <loc>${BASE_URL}${e.path}</loc>`,
              e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
              e.priority ? `    <priority>${e.priority}</priority>` : null,
              "  </url>",
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n");

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          urls,
          "</urlset>",
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
