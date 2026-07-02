import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { adminGetPricing, adminUpdatePricing } from "../lib/orders.functions";
import { useT } from "../lib/i18n";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

type Form = {
  usd_per_credit: number; iqd_per_usd: number;
  tier_pdf_iqd: number; tier_printed_iqd: number; tier_video_iqd: number;
  per_page_iqd_pdf: number; per_page_iqd_printed: number; per_page_iqd_video: number;
  per_character_iqd_pdf: number; per_character_iqd_printed: number; per_character_iqd_video: number;
  max_characters: number;
  print_cost_iqd: number; shipping_cost_iqd: number;
  image_tier_standard_extra_iqd: number; image_tier_premium_extra_iqd: number;
  quality_premium_multiplier: number;
  video_tier_enabled: boolean;
  free_moods_count: number;
  mood_extra_iqd: number;
  redownload_iqd_pdf: number;
  redownload_iqd_printed: number;
  redownload_iqd_video: number;
};

function SettingsPage() {
  const { t } = useT();
  const getFn = useServerFn(adminGetPricing);
  const setFn = useServerFn(adminUpdatePricing);
  const q = useQuery({ queryKey: ["admin-pricing"], queryFn: () => getFn() });
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data && !form) {
      setForm({
        usd_per_credit: Number(q.data.usd_per_credit),
        iqd_per_usd: Number(q.data.iqd_per_usd),
        tier_pdf_iqd: q.data.tier_pdf_iqd,
        tier_printed_iqd: q.data.tier_printed_iqd,
        tier_video_iqd: q.data.tier_video_iqd,
        per_page_iqd_pdf: q.data.per_page_iqd_pdf ?? 400,
        per_page_iqd_printed: q.data.per_page_iqd_printed ?? 1200,
        per_page_iqd_video: q.data.per_page_iqd_video ?? 2500,
        per_character_iqd_pdf: (q.data as { per_character_iqd_pdf?: number }).per_character_iqd_pdf ?? 1500,
        per_character_iqd_printed: (q.data as { per_character_iqd_printed?: number }).per_character_iqd_printed ?? 3000,
        per_character_iqd_video: (q.data as { per_character_iqd_video?: number }).per_character_iqd_video ?? 6000,
        max_characters: (q.data as { max_characters?: number }).max_characters ?? 5,
        print_cost_iqd: q.data.print_cost_iqd,
        shipping_cost_iqd: q.data.shipping_cost_iqd,
        image_tier_standard_extra_iqd: (q.data as { image_tier_standard_extra_iqd?: number }).image_tier_standard_extra_iqd ?? 0,
        image_tier_premium_extra_iqd: (q.data as { image_tier_premium_extra_iqd?: number }).image_tier_premium_extra_iqd ?? 0,
        quality_premium_multiplier: Number((q.data as { quality_premium_multiplier?: number | string }).quality_premium_multiplier ?? 2),
        video_tier_enabled: Boolean((q.data as { video_tier_enabled?: boolean }).video_tier_enabled ?? false),
      });
    }
  }, [q.data, form]);

  if (!form) return <div className="py-10 text-center">…</div>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      await setFn({ data: form });
      toast.success(t("saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">{t("settings_pricing")}</h1>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-6">
        <Row label="USD per credit (سعر الكريدت بالدولار)" type="number" step="0.001" value={form.usd_per_credit} onChange={(v) => set("usd_per_credit", v)} />
        <Row label="IQD per USD (سعر صرف الدولار)" type="number" value={form.iqd_per_usd} onChange={(v) => set("iqd_per_usd", v)} />
        <div className="text-xs font-semibold text-muted-foreground mt-2">السعر الأساسي (لـ 5 صفحات)</div>
        <div className="grid gap-4 md:grid-cols-3">
          <Row label="PDF (د.ع)" type="number" value={form.tier_pdf_iqd} onChange={(v) => set("tier_pdf_iqd", v)} />
          <Row label="Printed (د.ع)" type="number" value={form.tier_printed_iqd} onChange={(v) => set("tier_printed_iqd", v)} />
          <Row label="Video (د.ع)" type="number" value={form.tier_video_iqd} onChange={(v) => set("tier_video_iqd", v)} />
        </div>
        <div className="text-xs font-semibold text-muted-foreground mt-2">سعر كل صفحة إضافية فوق 5</div>
        <div className="grid gap-4 md:grid-cols-3">
          <Row label="PDF / صفحة" type="number" value={form.per_page_iqd_pdf} onChange={(v) => set("per_page_iqd_pdf", v)} />
          <Row label="Printed / صفحة" type="number" value={form.per_page_iqd_printed} onChange={(v) => set("per_page_iqd_printed", v)} />
          <Row label="Video / صفحة" type="number" value={form.per_page_iqd_video} onChange={(v) => set("per_page_iqd_video", v)} />
        </div>
        <div className="text-xs font-semibold text-muted-foreground mt-2">سعر كل شخصية إضافية (فوق الشخصية الأولى)</div>
        <div className="grid gap-4 md:grid-cols-3">
          <Row label="PDF / شخصية" type="number" value={form.per_character_iqd_pdf} onChange={(v) => set("per_character_iqd_pdf", v)} />
          <Row label="Printed / شخصية" type="number" value={form.per_character_iqd_printed} onChange={(v) => set("per_character_iqd_printed", v)} />
          <Row label="Video / شخصية" type="number" value={form.per_character_iqd_video} onChange={(v) => set("per_character_iqd_video", v)} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Row label="الحد الأقصى لعدد الشخصيات" type="number" value={form.max_characters} onChange={(v) => set("max_characters", v)} />
          <Row label="تكلفة الطباعة (د.ع)" type="number" value={form.print_cost_iqd} onChange={(v) => set("print_cost_iqd", v)} />
          <Row label="تكلفة الشحن (د.ع)" type="number" value={form.shipping_cost_iqd} onChange={(v) => set("shipping_cost_iqd", v)} />
        </div>
        <div className="text-xs font-semibold text-muted-foreground mt-2">إعدادات مستوى الجودة</div>
        <div className="grid gap-4 md:grid-cols-3">
          <Row label="مضاعِف الجودة الاحترافية (لكل صفحة/شخصية/أساسي)" type="number" step="0.1" value={form.quality_premium_multiplier} onChange={(v) => set("quality_premium_multiplier", v)} />
          <Row label="فارق سعر ثابت — قياسي (د.ع)" type="number" value={form.image_tier_standard_extra_iqd} onChange={(v) => set("image_tier_standard_extra_iqd", v)} />
          <Row label="فارق سعر ثابت — احترافي (د.ع)" type="number" value={form.image_tier_premium_extra_iqd} onChange={(v) => set("image_tier_premium_extra_iqd", v)} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          المضاعِف يُطبَّق على مجموع (السعر الأساسي + كل الصفحات الإضافية + كل الشخصيات الإضافية)، ثم يُضاف الفارق الثابت.
          مثال: مضاعِف 2.0 يعني أن الجودة الاحترافية تُضاعف تكلفة الصور والنصوص والصفحات معاً.
        </p>
        <label className="flex items-center gap-2 text-sm pt-2">
          <input type="checkbox" checked={form.video_tier_enabled} onChange={(e) => set("video_tier_enabled", e.target.checked)} />
          تفعيل مستوى الفيديو (إن أُلغيَ سيظل السعر ظاهراً ولكن لا يمكن اختياره)
        </label>
        <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-3 font-bold text-primary-foreground disabled:opacity-60">
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t("save")}
        </button>
      </form>
    </div>
  );
}

function Row({
  label, value, onChange, type = "text", step,
}: { label: string; value: number; onChange: (v: number) => void; type?: string; step?: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
      />
    </label>
  );
}
