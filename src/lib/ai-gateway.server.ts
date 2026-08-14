// Server-only AI gateway. OmniRoute is primary; Lovable is a technical fallback.
export type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cost?: number;
};

type ProviderName = "lovable";
type ProviderResult = { response: Response; provider: ProviderName; duration_ms: number };

class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly technical: boolean,
  ) {
    super(message);
  }
}

const LOVABLE_BASE = "https://ai.gateway.lovable.dev/v1";

const TEXT_PRICING_PER_1M: Record<string, { input: number; output: number }> = {
  "google/gemini-3-flash-preview": { input: 0.075, output: 0.3 },
  "google/gemini-2.5-flash": { input: 0.075, output: 0.3 },
  "google/gemini-2.5-pro": { input: 1.25, output: 5 },
  "google/gemini-3.5-flash": { input: 0.1, output: 0.4 },
};
const IMAGE_PRICING_PER_IMAGE: Record<string, number> = {
  "openai/gpt-image-2": 0.011,
  "openai/gpt-image-1-mini": 0.005,
  "google/gemini-3.1-flash-image": 0.039,
  "google/gemini-2.5-flash-image": 0.039,
  "google/gemini-3-pro-image": 0.08,
};

export function estimateTextCostUsd(model: string, usage: Usage): number {
  if (typeof usage.cost === "number") return usage.cost;
  const p = TEXT_PRICING_PER_1M[model] ?? { input: 0.1, output: 0.4 };
  return ((usage.input_tokens ?? 0) * p.input + (usage.output_tokens ?? 0) * p.output) / 1_000_000;
}

export function estimateImageCostUsd(model: string, images: number): number {
  return (IMAGE_PRICING_PER_IMAGE[model] ?? 0.05) * Math.max(1, images);
}

export type GatewayMeta = {
  provider: ProviderName;
  log_id: string | null;
  run_id: string | null;
  usage: Usage;
  duration_ms: number;
  finish_reason?: string | null;
  fallback_reason?: string;
};

export type ContentBlock =
  { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type Message = {
  role: "system" | "user" | "assistant";
  content: string | ContentBlock[];
};

function lovableKey(): string {
  const value = process.env.LOVABLE_API_KEY;
  if (!value) throw new Error("LOVABLE_API_KEY missing");
  return value;
}

function safeErrorBody(body: string): string {
  return body.replace(/[\r\n\t]+/g, " ").slice(0, 240);
}

async function requestProvider(args: {
  path: string;
  body: unknown;
  timeoutMs?: number;
}): Promise<ProviderResult> {
  const timeoutMs = args.timeoutMs ?? 120_000;
  const providers: Array<{ name: ProviderName; base: string; apiKey: string }> = [
    { name: "lovable", base: LOVABLE_BASE, apiKey: lovableKey() },
  ];
  for (const provider of providers) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${provider.base}${args.path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(args.body),
        signal: controller.signal,
      });
      const duration_ms = Date.now() - started;
      if (response.ok) return { response, provider: provider.name, duration_ms };
      const details = safeErrorBody(await response.text().catch(() => ""));
      const error = new ProviderHttpError(
        `${provider.name} ${args.path} error ${response.status}: ${details}`,
        response.status,
        true,
      );
      throw error;
    } catch (error) {
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Lovable AI provider request failed");
}

function providerMeta(
  result: ProviderResult,
  response: Response,
  usage: Usage,
  finish_reason?: string | null,
): GatewayMeta {
  return {
    provider: result.provider,
    log_id: response.headers.get(
      result.provider === "lovable" ? "X-Lovable-AIG-Log-ID" : "X-OmniRoute-Id",
    ),
    run_id: response.headers.get(
      result.provider === "lovable" ? "X-Lovable-AIG-Run-ID" : "X-Request-Id",
    ),
    usage,
    duration_ms: result.duration_ms,
    finish_reason,
  };
}

export async function callChat(args: {
  model: string;
  messages: Message[];
  response_format?: unknown;
}): Promise<{ content: string; meta: GatewayMeta }> {
  const result = await requestProvider({
    path: "/chat/completions",
    body: {
      model: args.model,
      messages: args.messages,
      ...(args.response_format ? { response_format: args.response_format } : {}),
    },
  });
  const body = (await result.response.json()) as {
    choices?: Array<{
      message?: { content?: string };
      finish_reason?: string;
      native_finish_reason?: string;
    }>;
    usage?: Usage;
  };
  const choice = body.choices?.[0];
  const content = choice?.message?.content ?? "";
  if (!content) throw new Error(`${result.provider} returned an empty chat response`);
  return {
    content,
    meta: providerMeta(
      result,
      result.response,
      body.usage ?? {},
      choice?.native_finish_reason ?? choice?.finish_reason ?? null,
    ),
  };
}

export async function callImage(args: {
  model: string;
  prompt: string;
  referenceImages?: string[];
}): Promise<{ b64: string; meta: GatewayMeta }> {
  const refs = args.referenceImages?.filter(Boolean) ?? [];
  const isVisionStyleModel = args.model.startsWith("google/");
  const body: unknown = isVisionStyleModel
    ? {
        model: args.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: args.prompt },
              ...refs.map((url) => ({ type: "image_url", image_url: { url } })),
            ],
          },
        ],
        modalities: ["image", "text"],
      }
    : { model: args.model, prompt: args.prompt, size: "1024x1024", quality: "low", n: 1 };
  const result = await requestProvider({ path: "/images/generations", body });
  const json = (await result.response.json()) as {
    data?: Array<{ b64_json?: string }>;
    usage?: Usage;
    choices?: Array<{
      message?: { content?: string };
      finish_reason?: string;
      native_finish_reason?: string;
    }>;
  };
  const b64 = json.data?.[0]?.b64_json ?? "";
  if (!b64) {
    const why =
      json.choices?.[0]?.message?.content?.trim() ||
      json.choices?.[0]?.native_finish_reason ||
      json.choices?.[0]?.finish_reason ||
      "";
    throw new Error(
      `${result.provider} returned empty image${why ? `: ${String(why).slice(0, 220)}` : ""}`,
    );
  }
  return { b64, meta: providerMeta(result, result.response, json.usage ?? {}) };
}
