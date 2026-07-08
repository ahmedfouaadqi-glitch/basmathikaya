// Server-only Image QA — vision check after each generated illustration.
// Catches character drift, deformed hands, text bleed, photo-in-photo, and
// scene/text mismatch. Fail-open on any error to never block delivery.
import { callChat, estimateTextCostUsd } from "./ai-gateway.server";

export type ImageQaReport = {
  ok: boolean;
  score: number;
  issues: string[];
  duration_ms: number;
  usage: { input_tokens?: number; output_tokens?: number };
  cost_usd: number;
};

async function pathToDataUrl(imagePath: string, bucket: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dl = await supabaseAdmin.storage.from(bucket).download(imagePath);
    if (dl.error || !dl.data) return null;
    const buf = Buffer.from(await dl.data.arrayBuffer());
    if (buf.byteLength > 2_500_000) return null;
    const mime = dl.data.type || "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function runImageQA(args: {
  imagePath: string;
  bucket?: string;
  expectedScene: string;
  characterDna: string;
  language: "ar" | "en" | "ku";
}): Promise<ImageQaReport> {
  const model = "google/gemini-3.1-flash-lite";
  const bucket = args.bucket ?? "story-covers";
  const dataUrl = await pathToDataUrl(args.imagePath, bucket);
  if (!dataUrl) {
    return { ok: true, score: 0, issues: ["download_failed"], duration_ms: 0, usage: {}, cost_usd: 0 };
  }
  const sys = `You are a strict children's storybook art director. Return JSON ONLY.`;
  const user = `Evaluate this illustration against the brief.

Character DNA (must match): ${args.characterDna || "n/a"}
Scene the illustration must depict: ${args.expectedScene || "n/a"}

Axes (ALL mandatory):
- character_consistent: gender/age/skin tone/hair color/hair style/eye color/outfit match the DNA.
- anatomy_ok: no deformed hands/fingers, no extra/missing limbs, no fused faces.
- no_embedded_text: no letters, captions, watermarks, or signatures inside the illustration.
- no_image_in_image: no photograph, polaroid, reference sheet, thumbnail, inset frame, or split screen.
- no_character_crop: main character is fully in the frame, not cut off at head/feet.
- scene_matches_text: the depicted moment matches the intended scene.

Return JSON EXACTLY:
{
  "ok": <bool — true only if ALL axes pass>,
  "score": <int 0..100>,
  "issues": [<short strings naming failing axes>]
}`;

  try {
    const r = await callChat({
      model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: [
          { type: "text", text: user },
          { type: "image_url", image_url: { url: dataUrl } },
        ] },
      ],
      response_format: { type: "json_object" },
    });
    const cost = estimateTextCostUsd(model, r.meta.usage);
    let parsed: { ok?: boolean; score?: number; issues?: unknown } = {};
    try { parsed = JSON.parse(r.content); } catch { /* ignore */ }
    const issues = Array.isArray(parsed.issues) ? parsed.issues.map(String).slice(0, 8) : [];
    return {
      ok: Boolean(parsed.ok),
      score: Number.isFinite(parsed.score) ? Number(parsed.score) : 0,
      issues,
      duration_ms: r.meta.duration_ms,
      usage: r.meta.usage,
      cost_usd: cost,
    };
  } catch {
    return { ok: true, score: 0, issues: ["qa_service_error"], duration_ms: 0, usage: {}, cost_usd: 0 };
  }
}
