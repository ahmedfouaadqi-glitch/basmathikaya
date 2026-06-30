import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useT } from "../lib/i18n";
import { adminListThemes, adminUpsertTheme, adminDeleteTheme } from "../lib/themes.functions";

export const Route = createFileRoute("/admin/themes")({
  component: ThemesPage,
});

type ThemeRow = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  accent_color: string | null;
  banner_text_ar: string | null;
  banner_text_en: string | null;
  banner_url: string | null;
  active: boolean;
};

const PRESETS = [
  { name: "محرم الحرام", color: "oklch(0.42 0.06 270)", banner_ar: "أيام محرم — مواعظ من كربلاء" },
  { name: "صفر الخير", color: "oklch(0.50 0.07 60)", banner_ar: "شهر صفر — احفظ نفسك بالذكر" },
  { name: "ربيع الأول — المولد النبوي", color: "oklch(0.70 0.13 145)", banner_ar: "ذكرى المولد النبوي الشريف" },
  { name: "ربيع الآخر", color: "oklch(0.65 0.11 160)", banner_ar: "ربيع الآخر — تأمل وذكر" },
  { name: "جمادى الأولى", color: "oklch(0.60 0.10 200)", banner_ar: "جمادى الأولى" },
  { name: "جمادى الآخرة", color: "oklch(0.58 0.10 220)", banner_ar: "جمادى الآخرة" },
  { name: "رجب الأصب", color: "oklch(0.63 0.12 250)", banner_ar: "رجب — شهر الله الأصب" },
  { name: "شعبان المعظم", color: "oklch(0.68 0.13 290)", banner_ar: "شعبان — ليلة النصف المباركة" },
  { name: "رمضان المبارك", color: "oklch(0.62 0.13 195)", banner_ar: "رمضان كريم — قصص الإيمان للأطفال" },
  { name: "شوال — عيد الفطر", color: "oklch(0.78 0.16 80)", banner_ar: "عيد فطر مبارك" },
  { name: "ذو القعدة", color: "oklch(0.55 0.09 30)", banner_ar: "ذو القعدة — شهر حرام" },
  { name: "ذو الحجة — عيد الأضحى", color: "oklch(0.72 0.15 50)", banner_ar: "عيد أضحى مبارك — حجاج بيت الله" },
  { name: "زيارة الأربعين", color: "oklch(0.38 0.06 25)", banner_ar: "أربعينية الإمام الحسين (ع)" },
  { name: "المبعث النبوي", color: "oklch(0.68 0.13 130)", banner_ar: "ذكرى المبعث الشريف" },
  { name: "الإسراء والمعراج", color: "oklch(0.55 0.13 280)", banner_ar: "ذكرى الإسراء والمعراج" },
  { name: "ليلة القدر", color: "oklch(0.45 0.15 285)", banner_ar: "ليلة خير من ألف شهر" },
  { name: "عيد الغدير", color: "oklch(0.70 0.15 100)", banner_ar: "عيد الغدير الأغر" },
  { name: "اليوم الوطني العراقي", color: "oklch(0.55 0.18 25)", banner_ar: "كل عام والعراق بخير" },
  { name: "رأس السنة الهجرية", color: "oklch(0.50 0.10 250)", banner_ar: "عام هجري جديد" },
  { name: "بداية العام الدراسي", color: "oklch(0.65 0.14 220)", banner_ar: "موسم العودة للمدارس" },
];

function ThemesPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListThemes);
  const upsertFn = useServerFn(adminUpsertTheme);
  const deleteFn = useServerFn(adminDeleteTheme);
  const q = useQuery({ queryKey: ["admin-themes"], queryFn: () => listFn() });
  const themes = (q.data ?? []) as ThemeRow[];

  const empty: ThemeRow = {
    id: "",
    name: "",
    start_date: null,
    end_date: null,
    accent_color: null,
    banner_text_ar: null,
    banner_text_en: null,
    banner_url: null,
    active: false,
  };
  const [draft, setDraft] = useState<ThemeRow>(empty);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await upsertFn({ data: { ...draft, id: draft.id || undefined } });
      toast.success(t("saved"));
      setDraft(empty);
      qc.invalidateQueries({ queryKey: ["admin-themes"] });
      qc.invalidateQueries({ queryKey: ["active-theme"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(row: ThemeRow) {
    await upsertFn({ data: { ...row, active: !row.active, id: row.id } });
    qc.invalidateQueries({ queryKey: ["admin-themes"] });
    qc.invalidateQueries({ queryKey: ["active-theme"] });
  }

  async function remove(id: string) {
    if (!confirm("حذف الثيم؟")) return;
    await deleteFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-themes"] });
    qc.invalidateQueries({ queryKey: ["active-theme"] });
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t("admin_themes")}</h1>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Existing themes */}
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-start">{t("theme_name")}</th>
                <th className="px-3 py-2.5 text-start">{t("theme_dates")}</th>
                <th className="px-3 py-2.5 text-start">{t("theme_banner_ar")}</th>
                <th className="px-3 py-2.5 text-center">{t("theme_active")}</th>
                <th className="px-3 py-2.5 text-center">—</th>
              </tr>
            </thead>
            <tbody>
              {themes.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">—</td></tr>
              )}
              {themes.map((th) => (
                <tr key={th.id} className="border-t">
                  <td className="px-3 py-2 font-medium">
                    <span className="inline-block size-3 rounded-full me-2 align-middle" style={{ background: th.accent_color ?? "transparent" }} />
                    {th.name}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{th.start_date ?? "—"} → {th.end_date ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{th.banner_text_ar ?? "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => toggle(th)}
                      className={`rounded-full px-3 py-0.5 text-xs font-medium ${th.active ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}
                    >
                      {th.active ? t("theme_on") : t("theme_off")}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="inline-flex gap-1">
                      <button onClick={() => setDraft(th)} className="rounded-md border px-2 py-0.5 text-xs hover:bg-secondary">{t("edit")}</button>
                      <button onClick={() => remove(th.id)} className="rounded-md border border-destructive/40 px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10">
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Editor */}
        <div className="rounded-2xl border bg-card p-4 space-y-3 h-fit">
          <div className="text-sm font-bold">{draft.id ? t("edit") : t("theme_new")}</div>

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, name: p.name, accent_color: p.color, banner_text_ar: p.banner_ar }))}
                className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-secondary"
              >
                {p.name}
              </button>
            ))}
          </div>

          <Field label={t("theme_name")}>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="input" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("theme_start")}>
              <input type="date" value={draft.start_date ?? ""} onChange={(e) => setDraft({ ...draft, start_date: e.target.value || null })} className="input" />
            </Field>
            <Field label={t("theme_end")}>
              <input type="date" value={draft.end_date ?? ""} onChange={(e) => setDraft({ ...draft, end_date: e.target.value || null })} className="input" />
            </Field>
          </div>
          <Field label={t("theme_accent")}>
            <input value={draft.accent_color ?? ""} onChange={(e) => setDraft({ ...draft, accent_color: e.target.value || null })} placeholder="oklch(0.7 0.13 145)" className="input font-mono text-xs" />
          </Field>
          <Field label={t("theme_banner_ar")}>
            <input value={draft.banner_text_ar ?? ""} onChange={(e) => setDraft({ ...draft, banner_text_ar: e.target.value || null })} className="input" />
          </Field>
          <Field label={t("theme_banner_en")}>
            <input value={draft.banner_text_en ?? ""} onChange={(e) => setDraft({ ...draft, banner_text_en: e.target.value || null })} className="input" />
          </Field>
          <Field label={t("theme_banner_url")}>
            <input value={draft.banner_url ?? ""} onChange={(e) => setDraft({ ...draft, banner_url: e.target.value || null })} className="input font-mono text-xs" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            {t("theme_active")}
          </label>

          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={saving || !draft.name.trim()} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {t("save")}
            </button>
            {draft.id && (
              <button onClick={() => setDraft(empty)} className="rounded-xl border px-3 py-2 text-sm hover:bg-secondary">{t("cancel")}</button>
            )}
          </div>
        </div>
      </div>

      <style>{`.input{width:100%;border-radius:0.5rem;border:1px solid var(--color-border);background:var(--color-background);padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{box-shadow:0 0 0 2px var(--color-primary)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
