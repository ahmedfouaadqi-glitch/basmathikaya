import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type HomeContent = {
  tagline_ar: string; tagline_en: string;
  hero_lead_ar: string; hero_lead_en: string;
  cta_start_ar: string; cta_start_en: string;
  feat_1_t_ar: string; feat_1_t_en: string; feat_1_d_ar: string; feat_1_d_en: string;
  feat_2_t_ar: string; feat_2_t_en: string; feat_2_d_ar: string; feat_2_d_en: string;
  feat_3_t_ar: string; feat_3_t_en: string; feat_3_d_ar: string; feat_3_d_en: string;
  disclaimer_ar: string; disclaimer_en: string;
};

const DEFAULT_DISCLAIMER_AR =
  "تنويه: منصة «بصمة حكاية» أداة ذكاء اصطناعي مخصّصة لهذه الفكرة، ولا يوجد أي تدخل بشري في توليد النصوص أو الصور. المستخدم وحده مسؤول عن كل المُدخلات والنتائج بلا استثناء، ولا يتم استرجاع أي مبالغ تحت أي ظرف. تحتفظ الإدارة بحق قبول أو رفض أي طلب.";
const DEFAULT_DISCLAIMER_EN =
  "Disclaimer: Basma Hekaya is an AI tool built for this concept; there is no human involvement in generating the text or images. The user is solely responsible for all inputs and outputs without exception; no refunds are issued under any circumstances. The admin reserves the right to accept or reject any order.";

export const DEFAULT_HOME_CONTENT: HomeContent = {
  tagline_ar: "حكايتك أنت، لا تشبه أحداً",
  tagline_en: "Your one-of-a-kind story",
  hero_lead_ar: "اختر شخصياتك، حدد جوّك، أضف لمستك الخاصة، واحصل على حكاية فريدة. كل حكاية كبصمتك.",
  hero_lead_en: "Pick your characters, set the vibe, add your personal touch — get a story unique as your fingerprint.",
  cta_start_ar: "اصنع حكايتي الآن",
  cta_start_en: "Create my story now",
  feat_1_t_ar: "شخصيات متعددة", feat_1_t_en: "Many characters",
  feat_1_d_ar: "أضف العائلة والأصدقاء في نفس الحكاية", feat_1_d_en: "Add family and friends to the same tale",
  feat_2_t_ar: "نص يشبهك", feat_2_t_en: "A tale that fits you",
  feat_2_d_ar: "حكاية مصممة بأجواء واتجاه تختاره أنت", feat_2_d_en: "Story tuned to the vibes & direction you choose",
  feat_3_t_ar: "تسليم سريع", feat_3_t_en: "Quick delivery",
  feat_3_d_ar: "PDF فوري بعد الدفع أو نسخة مطبوعة للباب", feat_3_d_en: "Instant PDF after payment or printed to your door",
  disclaimer_ar: DEFAULT_DISCLAIMER_AR,
  disclaimer_en: DEFAULT_DISCLAIMER_EN,
};

export const getHomeContent = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("site_content").select("value").eq("key", "home").maybeSingle();
  const stored = (data?.value ?? {}) as Partial<HomeContent>;
  return { ...DEFAULT_HOME_CONTENT, ...stored } as HomeContent;
});

const HomeInput = z.object({
  tagline_ar: z.string().max(200), tagline_en: z.string().max(200),
  hero_lead_ar: z.string().max(800), hero_lead_en: z.string().max(800),
  cta_start_ar: z.string().max(120), cta_start_en: z.string().max(120),
  feat_1_t_ar: z.string().max(120), feat_1_t_en: z.string().max(120),
  feat_1_d_ar: z.string().max(400), feat_1_d_en: z.string().max(400),
  feat_2_t_ar: z.string().max(120), feat_2_t_en: z.string().max(120),
  feat_2_d_ar: z.string().max(400), feat_2_d_en: z.string().max(400),
  feat_3_t_ar: z.string().max(120), feat_3_t_en: z.string().max(120),
  feat_3_d_ar: z.string().max(400), feat_3_d_en: z.string().max(400),
  disclaimer_ar: z.string().max(1200).default(DEFAULT_DISCLAIMER_AR),
  disclaimer_en: z.string().max(1200).default(DEFAULT_DISCLAIMER_EN),
});

export const adminUpdateHomeContent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => HomeInput.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_content")
      .upsert({ key: "home", value: data }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
