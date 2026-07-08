// Server-only Story QA — runs after the story text is generated to catch
// duplication, weak coherence, mismatched page count, age-inappropriate
// language, or abrupt transitions. Cheap single call.
import { callChat, estimateTextCostUsd } from "./ai-gateway.server";
import { isFeatureEnabled } from "./feature-flags.server";
import { runTextTask } from "./ai/orchestrator.server";
import { getCached, setCached, hashKey } from "./ai/cache.server";

export type StoryQaReport = {
  ok: boolean;
  reasons: string[];
  failing_pages: number[];
  score: number; // 0..100
  language_fit: boolean;
  duration_ms: number;
  usage: { input_tokens?: number; output_tokens?: number };
  cost_usd: number;
};

type PlanLike = {
  title: string;
  pages: Array<{ text: string }>;
};

export async function runStoryQA(args: {
  plan: PlanLike;
  pageCount: number;
  language: "ar" | "en" | "ku";
  moods: string[];
  heroAge: number | null;
}): Promise<StoryQaReport> {
  const model = "google/gemini-3.1-flash-lite";
  const langName = args.language === "ar" ? "Arabic" : args.language === "ku" ? "Kurdish Sorani" : "English";
  const pagesJoined = args.plan.pages
    .map((p, i) => `[Page ${i + 1}] ${p.text}`)
    .join("\n\n");
  const sys = `You are a strict children's storybook editor. Return JSON ONLY.`;
  const user = `Language: ${langName}.
Expected pages: ${args.pageCount}. Actual pages: ${args.plan.pages.length}.
Moods requested: ${args.moods.join(", ") || "n/a"}.
Hero age hint: ${args.heroAge ?? "unknown"}.

Story title: ${args.plan.title}

${pagesJoined}

Evaluate the story on these axes (all mandatory):
- no_repetition: no repeated sentences, paragraphs, or beats across pages.
- coherence: pages connect logically, characters and setting are consistent.
- ending_matches_start: the ending pays off something introduced early.
- age_appropriate: vocabulary and situations suit the hero's age.
- smooth_transitions: no abrupt scene/time jumps without a bridge.
- page_count_ok: page count equals ${args.pageCount}.
- language_fit: EVERY page is written entirely in ${langName}.

Return JSON EXACTLY:
{
  "ok": <bool — true only if all axes pass>,
  "score": <int 0..100>,
  "reasons": [<short reason strings for any failing axis>],
  "failing_pages": [<page numbers with issues, may be empty>],
  "language_fit": <bool>
}`;

  try {
    // Cache lookup (feature-flagged).
    const cacheOn = await isFeatureEnabled("cache_story_qa");
    const cacheKey = cacheOn
      ? hashKey("story_qa", args.language, args.pageCount, args.plan.title, ...args.plan.pages.map((p) => p.text))
      : null;
    if (cacheKey) {
      const hit = await getCached<StoryQaReport>(cacheKey);
      if (hit) return { ...hit, duration_ms: 0, cost_usd: 0 };
    }
    // Try orchestrator when feature flag is enabled; falls back to legacy path on error.
    const useOrch = await isFeatureEnabled("use_orchestrator");
    let content: string;
    let meta: { duration_ms: number; usage: { input_tokens?: number; output_tokens?: number } };
    let modelUsed = model;
    if (useOrch) {
      try {
        const res = await runTextTask({ task: "story_qa" }, () => ({
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        }));
        content = res.result.content;
        meta = res.result.meta;
        modelUsed = res.model_used;
      } catch {
        const r = await callChat({
          model,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        });
        content = r.content;
        meta = r.meta;
      }
    } else {
      const r = await callChat({
        model,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      });
      content = r.content;
      meta = r.meta;
    }
    const cost = estimateTextCostUsd(modelUsed, meta.usage);
    let parsed: {
      ok?: boolean; score?: number; reasons?: unknown; failing_pages?: unknown; language_fit?: boolean;
    } = {};
    try { parsed = JSON.parse(content); } catch { /* ignore */ }
    const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.map(String).slice(0, 8) : [];
    const failing = Array.isArray(parsed.failing_pages)
      ? parsed.failing_pages.map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : [];
    return {
      ok: Boolean(parsed.ok),
      reasons,
      failing_pages: failing,
      score: Number.isFinite(parsed.score) ? Number(parsed.score) : 0,
      language_fit: Boolean(parsed.language_fit ?? parsed.ok),
      duration_ms: meta.duration_ms,
      usage: meta.usage,
      cost_usd: cost,
    };
  } catch {
    // Fail-open: never block story creation if QA itself errors.
    return {
      ok: true,
      reasons: ["qa_service_error"],
      failing_pages: [],
      score: 0,
      language_fit: true,
      duration_ms: 0,
      usage: {},
      cost_usd: 0,
    };
  }
}
