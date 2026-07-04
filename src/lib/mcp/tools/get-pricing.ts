import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";

export default defineTool({
  name: "get_pricing",
  title: "Get story pricing",
  description:
    "Returns the current public pricing settings for بصمة حكاية story tiers (PDF, printed, video) in IQD.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase
      .from("pricing_settings")
      .select(
        "tier_pdf_iqd, tier_printed_iqd, tier_video_iqd, per_page_iqd_pdf, per_page_iqd_printed, per_page_iqd_video, print_cost_iqd, shipping_cost_iqd, video_tier_enabled",
      )
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [
        { type: "text", text: data ? JSON.stringify(data, null, 2) : "No pricing configured." },
      ],
      structuredContent: { pricing: data },
    };
  },
});
