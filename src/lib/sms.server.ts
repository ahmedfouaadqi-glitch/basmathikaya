// Server-only: send WhatsApp/SMS via Twilio Connector Gateway.
// Falls back to "dev mode" (logs the code) when Twilio isn't connected.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

function normalizeIraqiPhone(raw: string): string {
  // Accept 07XXXXXXXX or +9647XXXXXXXX or 9647XXXXXXXX, normalize to E.164 with +.
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return "+" + digits.slice(2);
  if (digits.startsWith("964")) return "+" + digits;
  if (digits.startsWith("0")) return "+964" + digits.slice(1);
  return "+" + digits;
}

export function normalizePhone(raw: string): string {
  return normalizeIraqiPhone(raw.trim());
}

type SendResult = { ok: boolean; via: "whatsapp" | "sms" | "dev"; error?: string };

export async function sendOtp(phoneE164: string, code: string, lang: "ar" | "en" = "ar"): Promise<SendResult> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  const fromWhatsapp = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"
  const fromSms = process.env.TWILIO_SMS_FROM;

  const body = lang === "ar"
    ? `رمز الدخول إلى بصمة حكاية: ${code}\nصالح لـ 10 دقائق.`
    : `Your Basma Hekaya login code: ${code}\nValid for 10 minutes.`;

  // Dev fallback when Twilio not configured
  if (!lovableKey || !twilioKey || (!fromWhatsapp && !fromSms)) {
    // eslint-disable-next-line no-console
    console.log(`[OTP DEV] phone=${phoneE164} code=${code}`);
    return { ok: true, via: "dev" };
  }

  async function postForm(params: Record<string, string>): Promise<Response> {
    return fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey!,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    });
  }

  // Try WhatsApp first
  if (fromWhatsapp) {
    try {
      const res = await postForm({
        To: `whatsapp:${phoneE164}`,
        From: fromWhatsapp,
        Body: body,
      });
      if (res.ok) return { ok: true, via: "whatsapp" };
    } catch (e) {
      console.error("WhatsApp send failed", e);
    }
  }

  if (fromSms) {
    try {
      const res = await postForm({ To: phoneE164, From: fromSms, Body: body });
      if (res.ok) return { ok: true, via: "sms" };
      const txt = await res.text().catch(() => "");
      return { ok: false, via: "sms", error: `Twilio ${res.status}: ${txt.slice(0, 200)}` };
    } catch (e) {
      return { ok: false, via: "sms", error: e instanceof Error ? e.message : String(e) };
    }
  }

  return { ok: false, via: "dev", error: "No SMS/WhatsApp sender configured" };
}
