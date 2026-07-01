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
  meaning_ar: string | null;
  meaning_en: string | null;
  palette: string[] | null;
  frame_style: string | null;
  motifs: string[] | null;
  header_title_ar: string | null;
  header_title_en: string | null;
  header_size: string | null;
  active: boolean;
};

type Preset = {
  name: string;
  color: string;
  banner_ar: string;
  meaning_ar: string;
  palette: string[];
  frame: string;
  motifs: string[];
  header_ar: string;
  size: "md" | "lg" | "xl";
};

// Comprehensive Hijri months + Iraqi occasions, each with meaning, palette, frame & motifs.
const PRESETS: Preset[] = [
  { name: "محرم الحرام", color: "#4a3466", banner_ar: "أيام محرم — مواعظ من كربلاء", meaning_ar: "شهر الحزن والفداء وذكرى ملحمة الطف؛ للأطفال دروس في الشجاعة والوفاء.", palette: ["#1a1030", "#4a3466", "#7a4a55", "#c9a86b"], frame: "arabesque", motifs: ["راية", "سراج", "نخلة"], header_ar: "شهر الحسين ﷺ", size: "lg" },
  { name: "صفر الخير", color: "#8a5a2b", banner_ar: "شهر صفر — احفظ نفسك بالذكر", meaning_ar: "شهر عزّز الذكر واستقبل الأربعين؛ رحلة الحب والوفاء.", palette: ["#2c1a0b", "#8a5a2b", "#c8935a", "#f0c987"], frame: "classic", motifs: ["مصباح", "درب"], header_ar: "صفر — أربعينية الحسين", size: "lg" },
  { name: "ربيع الأول — المولد النبوي", color: "#1a8a6b", banner_ar: "ذكرى المولد النبوي الشريف", meaning_ar: "ذكرى ميلاد سيد الخلق ﷺ — بشرى ونور ومحبة.", palette: ["#0a3a2a", "#1a8a6b", "#7ed6b0", "#d4a537"], frame: "floral", motifs: ["زهور", "نجمة", "قبة"], header_ar: "مولد النور المحمدي ﷺ", size: "xl" },
  { name: "ربيع الآخر", color: "#0f8a95", banner_ar: "ربيع الآخر — تأمل وذكر", meaning_ar: "شهر التأمل وامتداد فرحة المولد.", palette: ["#0a3a3d", "#0f8a95", "#8ed1d8", "#f2e6a8"], frame: "geometric", motifs: ["ورقة", "قوس"], header_ar: "ربيع الآخر", size: "md" },
  { name: "جمادى الأولى", color: "#0f5a95", banner_ar: "جمادى الأولى", meaning_ar: "شهر الأمومة — ذكرى ولادة السيدة الزهراء عليها السلام.", palette: ["#0a2a4a", "#0f5a95", "#7fb3d5", "#f4d47c"], frame: "classic", motifs: ["زهرة", "قلب"], header_ar: "جمادى الأولى — ذكرى الزهراء ﷵ", size: "lg" },
  { name: "جمادى الآخرة", color: "#4a0f8a", banner_ar: "جمادى الآخرة", meaning_ar: "شهر المعرفة والإرث الطاهر.", palette: ["#1a054a", "#4a0f8a", "#a878d1", "#e8d17c"], frame: "arabesque", motifs: ["نجمة", "شعاع"], header_ar: "جمادى الآخرة", size: "md" },
  { name: "رجب الأصب", color: "#2a4ac9", banner_ar: "رجب — شهر الله الأصب", meaning_ar: "شهر الله الحرام — الدعاء والاستغفار والمبعث الشريف.", palette: ["#0d1a4a", "#2a4ac9", "#7d9be8", "#f0c95c"], frame: "stars", motifs: ["هلال", "نجم"], header_ar: "رجب — شهر الله الأصب", size: "xl" },
  { name: "شعبان المعظم", color: "#6a2ac9", banner_ar: "شعبان — ليلة النصف المباركة", meaning_ar: "شهر النبي ﷺ ومولد صاحب الزمان ﷵ وليلة النصف المباركة.", palette: ["#2a0d5a", "#6a2ac9", "#b18be8", "#f5d67c"], frame: "stars", motifs: ["نجمة", "هلال", "مصباح"], header_ar: "شعبان — بشرى المهدي ﷵ", size: "xl" },
  { name: "رمضان المبارك", color: "#0f8a7c", banner_ar: "رمضان كريم — قصص الإيمان للأطفال", meaning_ar: "شهر القرآن والصيام والقربى — عبادة وفرح.", palette: ["#0a3a3a", "#0f8a7c", "#7ed6c8", "#f5c443"], frame: "arabesque", motifs: ["فانوس", "هلال", "نجمة", "مسجد"], header_ar: "رمضان كريم — شهر القرآن", size: "xl" },
  { name: "شوال — عيد الفطر", color: "#e88a2a", banner_ar: "عيد فطر مبارك", meaning_ar: "بهجة العيد بعد صيام الشهر — فرح وكسوة وحلوى وتراحم.", palette: ["#7a3a0d", "#e88a2a", "#f5c67c", "#fff2cc"], frame: "ribbon", motifs: ["زخارف", "بالون", "حلوى"], header_ar: "عيد فطر مبارك", size: "xl" },
  { name: "ذو القعدة", color: "#8a2a2a", banner_ar: "ذو القعدة — شهر حرام", meaning_ar: "أحد الأشهر الحرم — سكينة وامتناع عن القتال.", palette: ["#3a0a0a", "#8a2a2a", "#d17878", "#f2d9a8"], frame: "classic", motifs: ["نخلة", "درب"], header_ar: "ذو القعدة", size: "md" },
  { name: "ذو الحجة — عيد الأضحى", color: "#c9962a", banner_ar: "عيد أضحى مبارك — حجاج بيت الله", meaning_ar: "موسم الحج والأضحية والغدير وعرفة.", palette: ["#5a3a0a", "#c9962a", "#f5d67c", "#fff5d6"], frame: "geometric", motifs: ["كعبة", "نخلة", "خيمة", "هدهد"], header_ar: "عيد أضحى مبارك", size: "xl" },
  { name: "زيارة الأربعين", color: "#3a0a12", banner_ar: "أربعينية الإمام الحسين (ع)", meaning_ar: "رحلة المشي والإخلاص — أعظم مسيرة سلمية في العالم.", palette: ["#1a0207", "#3a0a12", "#8a3a4a", "#c99a5a"], frame: "arabesque", motifs: ["راية", "سراج", "درب"], header_ar: "أربعينية الحسين (ع)", size: "xl" },
  { name: "المبعث النبوي", color: "#1aa87c", banner_ar: "ذكرى المبعث الشريف", meaning_ar: "يوم بُعث النبي ﷺ بالرسالة الخاتمة.", palette: ["#0a4a3a", "#1aa87c", "#7ed6b8", "#f5d67c"], frame: "floral", motifs: ["جبل", "غار", "نور"], header_ar: "المبعث النبوي الشريف", size: "lg" },
  { name: "الإسراء والمعراج", color: "#4a2ac9", banner_ar: "ذكرى الإسراء والمعراج", meaning_ar: "رحلة السماء — عروج النبي ﷺ ولقاؤه بربه.", palette: ["#0d0a4a", "#4a2ac9", "#a08be8", "#f5c95c"], frame: "stars", motifs: ["براق", "قبة", "نجم"], header_ar: "الإسراء والمعراج", size: "lg" },
  { name: "ليلة القدر", color: "#3a1a8a", banner_ar: "ليلة خير من ألف شهر", meaning_ar: "ليلة نزول القرآن — رحمة وسلام حتى الفجر.", palette: ["#0a054a", "#3a1a8a", "#9078e0", "#f5c443"], frame: "stars", motifs: ["نجمة", "هلال", "مصباح", "قرآن"], header_ar: "ليلة القدر خير من ألف شهر", size: "xl" },
  { name: "عيد الغدير", color: "#c9b02a", banner_ar: "عيد الغدير الأغر", meaning_ar: "يوم إكمال الدين وإتمام النعمة — ولاية أمير المؤمنين علي (ع).", palette: ["#4a3a0a", "#c9b02a", "#f5e07c", "#fff5c6"], frame: "ribbon", motifs: ["راية", "هلال", "نخلة"], header_ar: "عيد الغدير الأغر", size: "xl" },
  { name: "اليوم الوطني العراقي", color: "#c92a2a", banner_ar: "كل عام والعراق بخير", meaning_ar: "عيد الوطن — يوم يذكرنا بالانتماء والفخر.", palette: ["#4a0a0a", "#c92a2a", "#ffffff", "#0a8a3a"], frame: "ribbon", motifs: ["علم", "نخلة", "قبة"], header_ar: "كل عام والعراق بخير", size: "xl" },
  { name: "رأس السنة الهجرية", color: "#1a5a95", banner_ar: "عام هجري جديد", meaning_ar: "بداية عام جديد بعد الهجرة النبوية — تجدّد الأمل والعزيمة.", palette: ["#0a2a4a", "#1a5a95", "#7fb3d5", "#f5d67c"], frame: "classic", motifs: ["هلال", "درب"], header_ar: "عام هجري مبارك", size: "lg" },
  { name: "بداية العام الدراسي", color: "#0f8a5a", banner_ar: "موسم العودة للمدارس", meaning_ar: "شغف التعلم — كتب وأصدقاء ومغامرات جديدة.", palette: ["#0a3a2a", "#0f8a5a", "#7ed6b0", "#f5c443"], frame: "geometric", motifs: ["كتاب", "قلم", "حقيبة"], header_ar: "عودة سعيدة إلى المدارس", size: "lg" },
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
    id: "", name: "",
    start_date: null, end_date: null,
    accent_color: null,
    banner_text_ar: null, banner_text_en: null, banner_url: null,
    meaning_ar: null, meaning_en: null,
    palette: null, frame_style: "classic", motifs: null,
    header_title_ar: null, header_title_en: null, header_size: "md",
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

  function applyPreset(p: Preset) {
    setDraft((d) => ({
      ...d,
      name: p.name,
      accent_color: p.color,
      banner_text_ar: p.banner_ar,
      meaning_ar: p.meaning_ar,
      palette: p.palette,
      frame_style: p.frame,
      motifs: p.motifs,
      header_title_ar: p.header_ar,
      header_size: p.size,
    }));
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t("admin_themes")}</h1>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-start">{t("theme_name")}</th>
                <th className="px-3 py-2.5 text-start">لوحة</th>
                <th className="px-3 py-2.5 text-start">{t("theme_dates")}</th>
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
                    {th.header_title_ar && <div className="mt-0.5 text-[10px] text-muted-foreground">{th.header_title_ar}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-0.5">
                      {(th.palette ?? []).slice(0, 5).map((c, i) => (
                        <span key={i} className="inline-block size-4 rounded" style={{ background: c }} title={c} />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{th.start_date ?? "—"} → {th.end_date ?? "—"}</td>
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

        <div className="rounded-2xl border bg-card p-4 space-y-3 h-fit">
          <div className="text-sm font-bold">{draft.id ? t("edit") : t("theme_new")}</div>

          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto p-1 rounded-lg border bg-secondary/30">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-background"
                style={{ borderColor: p.color }}
                title={p.meaning_ar}
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
          <Field label="عنوان الهيدر (عربي)">
            <input value={draft.header_title_ar ?? ""} onChange={(e) => setDraft({ ...draft, header_title_ar: e.target.value || null })} className="input" />
          </Field>
          <Field label="عنوان الهيدر (English)">
            <input value={draft.header_title_en ?? ""} onChange={(e) => setDraft({ ...draft, header_title_en: e.target.value || null })} className="input" />
          </Field>
          <Field label="حجم عنوان الهيدر">
            <select value={draft.header_size ?? "md"} onChange={(e) => setDraft({ ...draft, header_size: e.target.value })} className="input">
              <option value="sm">صغير</option>
              <option value="md">وسط</option>
              <option value="lg">كبير</option>
              <option value="xl">ضخم</option>
            </select>
          </Field>
          <Field label={t("theme_accent")}>
            <div className="flex gap-2">
              <input type="color" value={/^#/.test(draft.accent_color ?? "") ? draft.accent_color! : "#169CA3"} onChange={(e) => setDraft({ ...draft, accent_color: e.target.value })} className="h-9 w-12 rounded border" />
              <input value={draft.accent_color ?? ""} onChange={(e) => setDraft({ ...draft, accent_color: e.target.value || null })} placeholder="#169CA3" className="input font-mono text-xs" />
            </div>
          </Field>
          <Field label="لوحة الألوان (مفصولة بفواصل)">
            <input
              value={(draft.palette ?? []).join(", ")}
              onChange={(e) => setDraft({ ...draft, palette: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6) })}
              placeholder="#111, #333, #d4a537"
              className="input font-mono text-xs"
            />
            {draft.palette && draft.palette.length > 0 && (
              <div className="mt-1 flex gap-0.5">
                {draft.palette.map((c, i) => <span key={i} className="inline-block size-5 rounded" style={{ background: c }} />)}
              </div>
            )}
          </Field>
          <Field label="نمط الإطار في القصة">
            <select value={draft.frame_style ?? "classic"} onChange={(e) => setDraft({ ...draft, frame_style: e.target.value })} className="input">
              <option value="classic">كلاسيكي</option>
              <option value="arabesque">أرابيسك</option>
              <option value="ribbon">شريط</option>
              <option value="stars">نجوم</option>
              <option value="floral">زهور</option>
              <option value="geometric">هندسي</option>
              <option value="none">بدون</option>
            </select>
          </Field>
          <Field label="زخارف/رموز (مفصولة بفواصل)">
            <input
              value={(draft.motifs ?? []).join(", ")}
              onChange={(e) => setDraft({ ...draft, motifs: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8) })}
              placeholder="فانوس، هلال، نجمة"
              className="input"
            />
          </Field>
          <Field label="معنى الشهر / المناسبة (عربي)">
            <textarea rows={3} value={draft.meaning_ar ?? ""} onChange={(e) => setDraft({ ...draft, meaning_ar: e.target.value || null })} className="input" />
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
