import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Star, Trash2, Save } from "lucide-react";
import {
  listAllArtStyles,
  upsertArtStyle,
  deleteArtStyle,
  setDefaultArtStyle,
  type ArtStyle,
} from "../lib/art-styles.functions";

export const Route = createFileRoute("/admin/art-styles")({ component: ArtStylesPage });

type Draft = {
  id?: string;
  slug: string;
  category: "realistic" | "cartoon";
  name_ar: string;
  name_en: string;
  prompt_fragment: string;
  is_enabled: boolean;
  sort_order: number;
};

function toDraft(s: ArtStyle): Draft {
  return {
    id: s.id, slug: s.slug, category: s.category,
    name_ar: s.name_ar, name_en: s.name_en,
    prompt_fragment: s.prompt_fragment,
    is_enabled: s.is_enabled, sort_order: s.sort_order,
  };
}

function ArtStylesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllArtStyles);
  const upFn = useServerFn(upsertArtStyle);
  const delFn = useServerFn(deleteArtStyle);
  const defFn = useServerFn(setDefaultArtStyle);

  const q = useQuery({ queryKey: ["admin-art-styles"], queryFn: () => listFn() });
  const inv = () => qc.invalidateQueries({ queryKey: ["admin-art-styles"] });

  const upsert = useMutation({
    mutationFn: (d: Draft) => upFn({ data: d }),
    onSuccess: () => { toast.success("تم الحفظ"); inv(); setCreating(null); setEditingId(null); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطأ"),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); inv(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطأ"),
  });
  const setDef = useMutation({
    mutationFn: (id: string) => defFn({ data: { id } }),
    onSuccess: () => { toast.success("تم تعيين الافتراضي"); inv(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطأ"),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState<Draft | null>(null);

  const styles = (q.data ?? []) as ArtStyle[];
  const byCat = (c: "realistic" | "cartoon") => styles.filter((s) => s.category === c);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">أنماط الرسم الفنية</h1>
        <button
          onClick={() => setCreating({
            slug: "", category: "cartoon", name_ar: "", name_en: "",
            prompt_fragment: "", is_enabled: true, sort_order: 100,
          })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          <Plus className="size-4" /> إضافة نمط
        </button>
      </div>

      {q.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> جاري التحميل…</div>}

      {creating && (
        <StyleEditor
          draft={creating}
          onCancel={() => setCreating(null)}
          onSave={(d) => upsert.mutate(d)}
          saving={upsert.isPending}
        />
      )}

      {(["realistic", "cartoon"] as const).map((cat) => (
        <section key={cat} className="space-y-2">
          <h2 className="text-lg font-bold text-primary">
            {cat === "realistic" ? "واقعي" : "كرتوني"}
          </h2>
          <div className="space-y-2">
            {byCat(cat).map((s) => (
              editingId === s.id ? (
                <StyleEditor
                  key={s.id}
                  draft={toDraft(s)}
                  onCancel={() => setEditingId(null)}
                  onSave={(d) => upsert.mutate(d)}
                  saving={upsert.isPending}
                />
              ) : (
                <div key={s.id} className="rounded-xl border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{s.name_ar}</span>
                      <span className="text-xs text-muted-foreground">({s.name_en})</span>
                      <code className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">{s.slug}</code>
                      {s.is_default && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600"><Star className="size-3" /> افتراضي</span>}
                      {!s.is_enabled && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">معطّل</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">ترتيب: {s.sort_order}</span>
                      {!s.is_default && (
                        <button onClick={() => setDef.mutate(s.id)} className="rounded-md border px-2 py-1 hover:bg-secondary" disabled={setDef.isPending}>
                          تعيين افتراضي
                        </button>
                      )}
                      <button onClick={() => setEditingId(s.id)} className="rounded-md border px-2 py-1 hover:bg-secondary">تعديل</button>
                      {!s.is_default && (
                        <button
                          onClick={() => { if (confirm(`حذف نمط "${s.name_ar}"؟`)) del.mutate(s.id); }}
                          className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-destructive hover:bg-destructive/10"
                          disabled={del.isPending}
                        >
                          <Trash2 className="size-3" /> حذف
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{s.prompt_fragment}</p>
                </div>
              )
            ))}
            {byCat(cat).length === 0 && !q.isLoading && (
              <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">لا توجد أنماط</div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function StyleEditor({
  draft, onCancel, onSave, saving,
}: {
  draft: Draft;
  onCancel: () => void;
  onSave: (d: Draft) => void;
  saving: boolean;
}) {
  const [d, setD] = useState<Draft>(draft);
  return (
    <div className="rounded-xl border-2 border-primary bg-card p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          <span className="mb-1 block font-semibold">Slug</span>
          <input value={d.slug} onChange={(e) => setD({ ...d, slug: e.target.value })} className="w-full rounded-md border bg-background px-2 py-1.5 font-mono text-xs" placeholder="e.g. anime" />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-semibold">الفئة</span>
          <select value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as "realistic" | "cartoon" })} className="w-full rounded-md border bg-background px-2 py-1.5 text-xs">
            <option value="realistic">واقعي</option>
            <option value="cartoon">كرتوني</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-semibold">الاسم (عربي)</span>
          <input value={d.name_ar} onChange={(e) => setD({ ...d, name_ar: e.target.value })} className="w-full rounded-md border bg-background px-2 py-1.5" />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-semibold">Name (EN)</span>
          <input value={d.name_en} onChange={(e) => setD({ ...d, name_en: e.target.value })} className="w-full rounded-md border bg-background px-2 py-1.5" />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-1 block font-semibold">Prompt Fragment (يُدمج مع Character DNA)</span>
          <textarea value={d.prompt_fragment} onChange={(e) => setD({ ...d, prompt_fragment: e.target.value })} rows={4} className="w-full rounded-md border bg-background px-2 py-1.5 text-xs leading-relaxed" />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-semibold">الترتيب</span>
          <input type="number" min={0} value={d.sort_order} onChange={(e) => setD({ ...d, sort_order: Number(e.target.value) })} className="w-full rounded-md border bg-background px-2 py-1.5" />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={d.is_enabled} onChange={(e) => setD({ ...d, is_enabled: e.target.checked })} />
          <span>مفعّل</span>
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onSave(d)}
          disabled={saving || !d.slug || !d.name_ar || !d.name_en || d.prompt_fragment.length < 10}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          حفظ
        </button>
        <button onClick={onCancel} className="rounded-lg border px-3 py-2 text-sm hover:bg-secondary">إلغاء</button>
      </div>
    </div>
  );
}
