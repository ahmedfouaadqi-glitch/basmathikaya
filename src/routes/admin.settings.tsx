import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
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
  print_cost_iqd: number; shipping_cost_iqd: number;
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
        print_cost_iqd: q.data.print_cost_iqd,
        shipping_cost_iqd: q.data.shipping_cost_iqd,
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
        <div className="grid gap-4 md:grid-cols-3">
          <Row label="PDF (د.ع)" type="number" value={form.tier_pdf_iqd} onChange={(v) => set("tier_pdf_iqd", v)} />
          <Row label="Printed (د.ع)" type="number" value={form.tier_printed_iqd} onChange={(v) => set("tier_printed_iqd", v)} />
          <Row label="Video (د.ع)" type="number" value={form.tier_video_iqd} onChange={(v) => set("tier_video_iqd", v)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Row label="تكلفة الطباعة (د.ع)" type="number" value={form.print_cost_iqd} onChange={(v) => set("print_cost_iqd", v)} />
          <Row label="تكلفة الشحن (د.ع)" type="number" value={form.shipping_cost_iqd} onChange={(v) => set("shipping_cost_iqd", v)} />
        </div>
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
