import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  adminListPromoVideos,
  adminUpsertPromoVideo,
  adminDeletePromoVideo,
  type PromoVideo,
} from "../lib/promo-videos.functions";

export const Route = createFileRoute("/admin/videos")({
  component: VideosPage,
});

function VideosPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListPromoVideos);
  const upsertFn = useServerFn(adminUpsertPromoVideo);
  const deleteFn = useServerFn(adminDeletePromoVideo);
  const q = useQuery({ queryKey: ["admin-promo-videos"], queryFn: () => listFn() });
  const videos = (q.data ?? []) as PromoVideo[];

  const empty: PromoVideo = { id: "", url: "", title: null, sort_order: 0, enabled: true, muted_default: true };
  const [draft, setDraft] = useState<PromoVideo>(empty);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await upsertFn({ data: { ...draft, id: draft.id || undefined } });
      toast.success("تم الحفظ");
      setDraft(empty);
      qc.invalidateQueries({ queryKey: ["admin-promo-videos"] });
      qc.invalidateQueries({ queryKey: ["promo-videos"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(row: PromoVideo, patch: Partial<PromoVideo>) {
    await upsertFn({ data: { ...row, ...patch, id: row.id } });
    qc.invalidateQueries({ queryKey: ["admin-promo-videos"] });
    qc.invalidateQueries({ queryKey: ["promo-videos"] });
  }

  async function remove(id: string) {
    if (!confirm("حذف الفيديو؟")) return;
    await deleteFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-promo-videos"] });
    qc.invalidateQueries({ queryKey: ["promo-videos"] });
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">فيديوهات الترويسة</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        الصق روابط مباشرة لفيديوهات (mp4). ستُعرض في الصفحة الرئيسية بترتيب <code>sort_order</code>، وتُشغَّل الواحد تلو الآخر بشكل لا نهائي.
        يمكن التحكم بكتم الصوت افتراضياً لكل فيديو، ويستطيع الزائر تفعيل الصوت من زر التحكم.
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-start">العنوان</th>
                <th className="px-3 py-2.5 text-start">الرابط</th>
                <th className="px-3 py-2.5 text-center">ترتيب</th>
                <th className="px-3 py-2.5 text-center">مكتوم افتراضياً</th>
                <th className="px-3 py-2.5 text-center">مُفعّل</th>
                <th className="px-3 py-2.5 text-center">—</th>
              </tr>
            </thead>
            <tbody>
              {videos.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">لا يوجد فيديوهات — ستُعرض النسخ الافتراضية.</td></tr>
              )}
              {videos.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{v.title ?? "—"}</td>
                  <td className="px-3 py-2 max-w-[260px] truncate font-mono text-xs" dir="ltr">
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{v.url}</a>
                  </td>
                  <td className="px-3 py-2 text-center">{v.sort_order}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => toggle(v, { muted_default: !v.muted_default })}
                      className={`rounded-full px-3 py-0.5 text-xs font-medium ${v.muted_default ? "bg-secondary" : "bg-primary/15 text-primary"}`}
                    >
                      {v.muted_default ? "مكتوم" : "بصوت"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => toggle(v, { enabled: !v.enabled })}
                      className={`rounded-full px-3 py-0.5 text-xs font-medium ${v.enabled ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}
                    >
                      {v.enabled ? "مُفعّل" : "متوقف"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="inline-flex gap-1">
                      <button onClick={() => setDraft(v)} className="rounded-md border px-2 py-0.5 text-xs hover:bg-secondary">تعديل</button>
                      <button onClick={() => remove(v.id)} className="rounded-md border border-destructive/40 px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10">
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
          <div className="text-sm font-bold">{draft.id ? "تعديل فيديو" : "إضافة فيديو"}</div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">رابط مباشر (mp4)</span>
            <input dir="ltr" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://…/video.mp4" className="input font-mono text-xs" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">العنوان (اختياري)</span>
            <input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value || null })} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">ترتيب العرض</span>
            <input type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="input" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.muted_default} onChange={(e) => setDraft({ ...draft, muted_default: e.target.checked })} />
            مكتوم افتراضياً
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
            مُفعّل
          </label>

          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={saving || !draft.url.trim()} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              حفظ
            </button>
            {draft.id && (
              <button onClick={() => setDraft(empty)} className="rounded-xl border px-3 py-2 text-sm hover:bg-secondary">إلغاء</button>
            )}
          </div>
        </div>
      </div>

      <style>{`.input{width:100%;border-radius:0.5rem;border:1px solid var(--color-border);background:var(--color-background);padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{box-shadow:0 0 0 2px var(--color-primary)}`}</style>
    </div>
  );
}
