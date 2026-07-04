import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";

export default defineTool({
  name: "get_active_theme",
  title: "Get active seasonal theme",
  description:
    "Returns the currently active seasonal theme for بصمة حكاية (name, colors, banner text, frame style, motifs).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("seasonal_themes")
      .select("*")
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const match = (data ?? []).find((t) => {
      const okStart = !t.start_date || t.start_date <= today;
      const okEnd = !t.end_date || t.end_date >= today;
      return okStart && okEnd;
    }) ?? null;
    return {
      content: [{ type: "text", text: match ? JSON.stringify(match, null, 2) : "No active theme." }],
      structuredContent: { theme: match },
    };
  },
});
