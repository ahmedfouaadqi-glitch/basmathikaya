import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listTestimonialsAdmin, upsertTestimonial, deleteTestimonial } from "../lib/admin-ops.functions";
import { toast } from "sonner";
import { useState } from "react";
import { Trash2, Edit3, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/testimonials")({ component: AdminTestimonialsPage });

type Row = {
  id: string;
  author_name: string;
  author_city: string | null;
  content: string;
  rating: number;
  avatar_url: string | null;
  published: boolean;
  featured: boolean;
  sort_order: number;
};

function AdminTestimonialsPage() {
  const listFn = useServerFn(listTestimonialsAdmin);
  const saveFn = useServerFn(upsertTestimonial);
  const delFn = useServerFn(deleteTestimonial);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-testimonials"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<Partial<Row> | null>(null);

  function empty(): Partial<Row> {
    return { author_name: "", content: "", rating: 5, published: true, featured: false, sort_order: 0 };
  }

  async function save() {
    if (!editing) return;
    try {
      await saveFn({
        data: {
          id: editing.id,
          author_name: editing.author_name!,
          author_city: editing.author_city ?? null,
          content: editing.content!,
          rating: editing.rating ?? 5,
          avatar_url: editing.avatar_url ?? null,
          published: editing.published ?? false,
          featured: editing.featured ?? false,
          sort_order: editing.sort_order ?? 0,
        },
      });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-testimonials"] });
      toast.success("حُفظ");
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
  }

  async function remove(id: string) {
    if (!confirm("حذف نهائي؟")) return;
    try {
      await delFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin-testimonials"] });
      toast.success("حُذف");
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">الشهادات</h1>
        <button
          onClick={() => setEditing(empty())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm"
        >
          <Plus className="size-4" /> جديدة
        </button>
      </div>

      <div className="space-y-2">
        {((q.data ?? []) as Row[]).map((t) => (
          <div key={t.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <strong>{t.author_name}</strong>
                  {t.author_city && <span className="text-xs text-muted-foreground">— {t.author_city}</span>}
                  <span className="text-xs">⭐ {t.rating}</span>
                  {t.published ? (
                    <span className="rounded-full bg-primary/15 text-primary text-[10px] px-2 py-0.5">منشور</span>
                  ) : (
                    <span className="rounded-full bg-secondary text-[10px] px-2 py-0.5">مسودة</span>
                  )}
                  {t.featured && <span className="rounded-full bg-accent/20 text-accent text-[10px] px-2 py-0.5">مميّز</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{t.content}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(t)} className="rounded p-1.5 hover:bg-secondary"><Edit3 className="size-4" /></button>
                <button onClick={() => remove(t.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="size-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-2xl border bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-lg font-bold">{editing.id ? "تعديل" : "إضافة"} شهادة</h2>
            <div className="space-y-3">
              <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="الاسم"
                value={editing.author_name ?? ""} onChange={(e) => setEditing({ ...editing, author_name: e.target.value })} />
              <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="المدينة (اختياري)"
                value={editing.author_city ?? ""} onChange={(e) => setEditing({ ...editing, author_city: e.target.value })} />
              <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={4} placeholder="النص"
                value={editing.content ?? ""} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">
                  التقييم:
                  <input type="number" min={1} max={5} className="ms-2 w-16 rounded border px-2 py-1"
                    value={editing.rating ?? 5} onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })} />
                </label>
                <label className="text-sm">
                  ترتيب:
                  <input type="number" className="ms-2 w-16 rounded border px-2 py-1"
                    value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </label>
              </div>
              <div className="flex gap-4 text-sm">
                <label><input type="checkbox" checked={!!editing.published} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} /> منشور</label>
                <label><input type="checkbox" checked={!!editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} /> مميّز</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEditing(null)} className="rounded-lg border px-3 py-2 text-sm">إلغاء</button>
                <button onClick={save} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-bold">حفظ</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
