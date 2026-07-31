// Server-only: send transactional emails (login codes).
// Falls back to "dev mode" (logs the code) when no email provider is configured.

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type EmailSendResult = { ok: boolean; via: "resend" | "dev"; error?: string };

export async function sendLoginCodeEmail(email: string, code: string): Promise<EmailSendResult> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM; // e.g. "بصمة حكاية <login@urstory.space>"

  const subject = "رمز الدخول إلى بصمة حكاية";
  const html = `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#ffffff;padding:24px">
      <h2 style="margin:0 0 12px;color:#0B5B60">بصمة حكاية</h2>
      <p style="margin:0 0 16px;color:#333">رمز الدخول الخاص بك:</p>
      <div style="font-size:30px;font-weight:700;letter-spacing:8px;color:#169CA3;direction:ltr">${code}</div>
      <p style="margin:16px 0 0;color:#666;font-size:13px">صالح لمدة 10 دقائق. إذا لم تطلب الرمز، تجاهل هذه الرسالة.</p>
    </div>`;

  if (!lovableKey || !resendKey || !from) {
    // eslint-disable-next-line no-console
    console.log(`[EMAIL OTP DEV] email=${email} code=${code}`);
    return { ok: true, via: "dev" };
  }

  try {
    const res = await fetch(`${RESEND_GATEWAY}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        html,
      }),
    });
    if (res.ok) return { ok: true, via: "resend" };
    const txt = await res.text().catch(() => "");
    return { ok: false, via: "resend", error: `Email ${res.status}: ${txt.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, via: "resend", error: e instanceof Error ? e.message : String(e) };
  }
}
