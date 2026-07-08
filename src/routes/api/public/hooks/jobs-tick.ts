import { createFileRoute } from "@tanstack/react-router";
import { runPending } from "@/lib/jobs/queue.server";

// Cron endpoint: called by pg_cron every minute.
// No secret needed — /api/public/* bypasses auth on published sites;
// the endpoint just drains the queue and cannot leak data.
export const Route = createFileRoute("/api/public/hooks/jobs-tick")({
  server: {
    handlers: {
      POST: async () => {
        // Ensure runners are registered (import for side effects).
        await import("@/lib/jobs/runners.server");
        const result = await runPending({ maxJobs: 10, maxMs: 25_000 });
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => {
        await import("@/lib/jobs/runners.server");
        const result = await runPending({ maxJobs: 10, maxMs: 25_000 });
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
