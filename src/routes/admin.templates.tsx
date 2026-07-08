import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Eye, EyeOff, Upload, X } from "lucide-react";
import {
  adminListPreviewTemplates,
  adminUpsertPreviewTemplate,
  adminDeletePreviewTemplate,
  adminSetPreviewTemplateFlag,
  adminUploadTemplateImage,
  type PreviewTemplate,
} from "../lib/preview-templates.functions";

export const Route = createFileRoute("/admin/templates")({
  component: TemplatesPage,
});

type Draft = {
  id?: string;
  name: string;
  language: "ar" | "en" | "ku";
  story_type: string;
  moods: string; // comma-separated in the UI
  title: string;
  reflective_question: string;
  page_count: number;
  orientation: "portrait" | "landscape";
  frame_style: string;
  palette: string; // comma-separated
  pages: { text: string }[];
  cover_image_path: string | null;
  cover_url: string | null;
  page_images: string[];
  page_urls: string[];
  active: boolean;
  hidden: boolean;
  seasonal_start: string;
  seasonal_end: string;
  priority: number;
};

const EMPTY: Draft = {
  name: "",
  language: "ar",
  story_type: "",
  moods: "",
  title: "",
  reflective_question: "",
  page_count: 5,
  orientation: "portrait",
  frame_style: "",
  palette: "",
  pages: Array.from({ length: 5 }, () => ({ text: "" })),
  cover_image_path: null,
  cover_url: null,
  page_images: [],
  page_urls: [],
  active: true,
  hidden: false,
  seasonal_start: "",
  seasonal_end: "",
  priority: 0,
};

function tplToDraft(t: PreviewTemplate): Draft {
  return {
    id: t.id,
    name: t.name,
    language: t.language,
    story_type: t.story_type ?? "",
    moods: (t.moods ?? []).join(", "),
    title: t.title,
    reflective_question: t.reflective_question ?? "",
    page_count: t.page_count,
    orientation: t.orientation,
    frame_style: t.frame_style ?? "",
    palette: (t.palette ?? []).join(", "),
    pages: (t.pages ?? []).length
      ? t.pages.map((p) => ({ text: p.text ?? "" }))
      : Array.from({ length: t.page_count }, () => ({ text: "" })),
    cover_image_path: t.cover_image_path,
    cover_url: t.cover_url ?? null,
    page_images: t.page_images ?? [],
    page_urls: t.page_urls ?? [],
    active: t.active,
    hidden: t.hidden,
    seasonal_start: t.seasonal_start ?? "",
    seasonal_end: t.seasonal_end ?? "",
    priority: t.priority,
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(fr.error);
    fr.onload = () => res(String(fr.result));
    fr.readAsDataURL(file);
  });
}

function TemplatesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListPreviewTemplates);
  const upsertFn = useServerFn(adminUpsertPreviewTemplate);
  const deleteFn = useServerFn(adminDeletePreviewTemplate);
  const flagFn = useServerFn(adminSetPreviewTemplateFlag);
  const uploadFn = useServerFn(adminUploadTemplateImage);

  const q = useQuery({ queryKey: ["admin-preview-templates"], queryFn: () => listFn() });
  const items = (q.data ?? []) as PreviewTemplate[];

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  function openNew() {
    setDraft({ ...EMPTY, pages: Array.from({ length: 5 }, () => ({ text: "" })) });
    setEditorOpen(true);
  }
  function openEdit(t: PreviewTemplate) {
    setDraft(tplToDraft(t));
    setEditorOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        id: draft.id,
        name: draft.name.trim(),
        language: draft.language,
        story_type: draft.story_type.trim() || null,
        moods: draft.moods.split(",").map((s) => s.trim()).filter(Boolean),
        title: draft.title.trim(),
        reflective_question: draft.reflective_question.trim() || null,
        page_count: draft.page_count,
        orientation: draft.orientation,
        frame_style: draft.frame_style.trim() || null,
        palette: draft.palette.split(",").map((s) => s.trim()).filter(Boolean),
        pages: draft.pages.slice(0, draft.page_count).map((p) => ({ text: p.text ?? "" })),
        cover_image_path: draft.cover_image_path,
        page_images: draft.page_images,
        active: draft.active,
        hidden: draft.hidden,
        seasonal_start: draft.seasonal_start || null,
        seasonal_end: draft.seasonal_end || null,
        priority: draft.priority,
      };
      const res = await upsertFn({ data: payload });
      toast.success("تم الحفظ");
      setDraft((d) => ({ ...d, id: res.id }));
      qc.invalidateQueries({ queryKey: ["admin-preview-templates"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("حذف النموذج نهائياً؟")) return;
    await deleteFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-preview-templates"] });
  }

  async function toggle(id: string, patch: { active?: boolean; hidden?: boolean }) {
    await flagFn({ data: { id, ...patch } });
    qc.invalidateQueries({ queryKey: ["admin-preview-templates"] });
  }

  async function pickCover(file: File) {
    if (!draft.id) {
      toast.error("احفظ النموذج أولاً قبل رفع الصور");
      return;
    }
    const url = await fileToDataUrl(file);
    const r = await uploadFn({ data: { templateId: draft.id, kind: "cover", dataUrl: url } });
    setDraft((d) => ({ ...d, cover_image_path: r.path, cover_url: r.previewUrl }));
    await upsertFn({ data: {
      id: draft.id, name: draft.name, language: draft.language, title: draft.title,
      story_type: draft.story_type || null, moods: draft.moods.split(",").map((s) => s.trim()).filter(Boolean),
      reflective_question: draft.reflective_question || null, page_count: draft.page_count,
      orientation: draft.orientation, frame_style: draft.frame_style || null,
      palette: draft.palette.split(",").map((s) => s.trim()).filter(Boolean),
      pages: draft.pages.slice(0, draft.page_count).map((p) => ({ text: p.text ?? "" })),
      cover_image_path: r.path, page_images: draft.page_images,
      active: draft.active, hidden: draft.hidden,
      seasonal_start: draft.seasonal_start || null, seasonal_end: draft.seasonal_end || null,
      priority: draft.priority,
    } });
    qc.invalidateQueries({ queryKey: ["admin-preview-templates"] });
  }

  async function pickPageImage(file: File, index: number) {
    if (!draft.id) {
      toast.error("احفظ النموذج أولاً قبل رفع الصور");
      return;
    }
    const url = await fileToDataUrl(file);
    const r = await uploadFn({ data: { templateId: draft.id, kind: "page", pageIndex: index, dataUrl: url } });
    setDraft((d) => {
      const nextPaths = [...d.page_images];
      const nextUrls = [...d.page_urls];
      while (nextPaths.length <= index) nextPaths.push("");
      while (nextUrls.length <= index) nextUrls.push("");
      nextPaths[index] = r.path;
      nextUrls[index] = r.previewUrl ?? "";
      return { ...d, page_images: nextPaths, page_urls: nextUrls };
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">قوالب المعاينة المجانية</h1>
          <p className="text-sm text-muted-foreground">
            نماذج ثابتة تُعرض في صفحة "معاينة نموذج مجاني" — لا تستهلك أي توكن. تُدار موسمياً بالتفعيل/الإخفاء أو نافذة تاريخ.
          </p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          <Plus className="size-4" /> إنشاء نموذج
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {q.isLoading && <div className="col-span-full text-center text-muted-foreground">جاري التحميل…</div>}
        {items.length === 0 && !q.isLoading && (
          <div className="col-span-full rounded-xl border bg-card p-6 text-center text-muted-foreground">
            لا توجد نماذج بعد. اضغط "إنشاء نموذج" لبدء أول قالب.
          </div>
        )}
        {items.map((t) => (
          <div key={t.id} className="rounded-2xl border bg-card p-3">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-secondary mb-2">
              {t.cover_url ? (
                <img src={t.cover_url} alt={t.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">لا توجد صورة غلاف</div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold truncate">{t.name}</div>
                <div className="text-xs text-muted-foreground truncate">{t.language.toUpperCase()} · {t.page_count} ص · {t.orientation}</div>
                {t.moods?.length ? <div className="mt-1 text-[10px] text-muted-foreground truncate">{t.moods.join(", ")}</div> : null}
              </div>
              <div className="flex flex-col gap-1">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${t.active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {t.active ? "مُفعّل" : "متوقف"}
                </span>
                {t.hidden && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">مخفي</span>}
              </div>
            </div>
            {(t.seasonal_start || t.seasonal_end) && (
              <div className="mt-2 text-[11px] text-muted-foreground">
                موسمي: {t.seasonal_start ?? "—"} → {t.seasonal_end ?? "—"}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button onClick={() => openEdit(t)} className="rounded-md border px-2 py-1 text-xs hover:bg-secondary">تعديل</button>
              <button onClick={() => toggle(t.id, { active: !t.active })} className="rounded-md border px-2 py-1 text-xs hover:bg-secondary">
                {t.active ? "إيقاف" : "تفعيل"}
              </button>
              <button onClick={() => toggle(t.id, { hidden: !t.hidden })} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-secondary">
                {t.hidden ? <><Eye className="size-3" /> إظهار</> : <><EyeOff className="size-3" /> إخفاء</>}
              </button>
              <button onClick={() => remove(t.id)} className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                <Trash2 className="size-3" /> حذف
              </button>
            </div>
          </div>
        ))}
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:p-6" onClick={() => setEditorOpen(false)}>
          <div className="w-full max-w-3xl rounded-2xl border bg-card p-4 sm:p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-bold">{draft.id ? "تعديل نموذج" : "نموذج جديد"}</h2>
              <button onClick={() => setEditorOpen(false)} className="grid size-8 place-items-center rounded-full border hover:bg-secondary"><X className="size-4" /></button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 font-medium">اسم النموذج (داخلي)</div>
                <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">اللغة</div>
                <select value={draft.language} onChange={(e) => setDraft((d) => ({ ...d, language: e.target.value as Draft["language"] }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  <option value="ar">عربي</option>
                  <option value="en">English</option>
                  <option value="ku">کوردی</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">نوع القصة (اختياري)</div>
                <input value={draft.story_type} onChange={(e) => setDraft((d) => ({ ...d, story_type: e.target.value }))} placeholder="عاشوراء، تخرج، رمضان…" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">الأجواء (فصل بفواصل)</div>
                <input value={draft.moods} onChange={(e) => setDraft((d) => ({ ...d, moods: e.target.value }))} placeholder="adventure, fantasy" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="text-sm sm:col-span-2">
                <div className="mb-1 font-medium">عنوان القصة</div>
                <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">عدد الصفحات</div>
                <input type="number" min={1} max={20} value={draft.page_count} onChange={(e) => setDraft((d) => {
                  const n = Math.max(1, Math.min(20, Number(e.target.value) || 1));
                  const pages = Array.from({ length: n }, (_, i) => d.pages[i] ?? { text: "" });
                  return { ...d, page_count: n, pages };
                })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">الاتجاه</div>
                <select value={draft.orientation} onChange={(e) => setDraft((d) => ({ ...d, orientation: e.target.value as Draft["orientation"] }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  <option value="portrait">عمودي</option>
                  <option value="landscape">أفقي</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">إطار</div>
                <input value={draft.frame_style} onChange={(e) => setDraft((d) => ({ ...d, frame_style: e.target.value }))} placeholder="classic / floral…" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">لوحة الألوان (فصل بفواصل)</div>
                <input value={draft.palette} onChange={(e) => setDraft((d) => ({ ...d, palette: e.target.value }))} placeholder="#169CA3, #D4A537" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">أولوية العرض</div>
                <input type="number" value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: Number(e.target.value) || 0 }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">بداية موسمية (اختياري)</div>
                <input type="date" value={draft.seasonal_start} onChange={(e) => setDraft((d) => ({ ...d, seasonal_start: e.target.value }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">نهاية موسمية (اختياري)</div>
                <input type="date" value={draft.seasonal_end} onChange={(e) => setDraft((d) => ({ ...d, seasonal_end: e.target.value }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="text-sm sm:col-span-2">
                <div className="mb-1 font-medium">سؤال تأملي في نهاية القصة</div>
                <input value={draft.reflective_question} onChange={(e) => setDraft((d) => ({ ...d, reflective_question: e.target.value }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </label>
              <div className="flex items-center gap-4 sm:col-span-2 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} /> مُفعّل
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={draft.hidden} onChange={(e) => setDraft((d) => ({ ...d, hidden: e.target.checked }))} /> مخفي
                </label>
              </div>
            </div>

            {/* Cover uploader */}
            <div className="mt-5 rounded-xl border p-3">
              <div className="mb-2 text-sm font-bold">صورة الغلاف</div>
              <div className="flex items-start gap-3">
                <div className="size-24 shrink-0 overflow-hidden rounded-lg border bg-secondary">
                  {draft.cover_url ? <img src={draft.cover_url} alt="cover" className="h-full w-full object-cover" /> : null}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">
                  <Upload className="size-3.5" />
                  رفع صورة الغلاف
                  <input hidden type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickCover(f); }} />
                </label>
              </div>
            </div>

            {/* Pages */}
            <div className="mt-4 space-y-3">
              <div className="text-sm font-bold">صفحات القصة</div>
              {draft.pages.slice(0, draft.page_count).map((p, i) => (
                <div key={i} className="rounded-xl border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-medium text-muted-foreground">صفحة {i + 1}</div>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-secondary">
                      <Upload className="size-3" /> صورة
                      <input hidden type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPageImage(f, i); }} />
                    </label>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="size-20 shrink-0 overflow-hidden rounded-lg border bg-secondary">
                      {draft.page_urls[i] ? <img src={draft.page_urls[i]} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <textarea
                      value={p.text}
                      onChange={(e) => setDraft((d) => {
                        const pages = [...d.pages];
                        pages[i] = { text: e.target.value };
                        return { ...d, pages };
                      })}
                      rows={4}
                      className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditorOpen(false)} className="rounded-xl border px-4 py-2 text-sm">إلغاء</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
                {saving && <Loader2 className="size-4 animate-spin" />} حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
