import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import { getHomeContent, adminUpdateHomeContent, DEFAULT_HOME_CONTENT, type HomeContent } from "../lib/site-content.functions";

export const Route = createFileRoute("/admin/content")({
  component: ContentPage,
});

function ContentPage() {
  const getFn = useServerFn(getHomeContent);
  const setFn = useServerFn(adminUpdateHomeContent);
  const q = useQuery({ queryKey: ["admin-home-content"], queryFn: () => getFn() });
  const [form, setForm] = useState<HomeContent | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data && !form) setForm(q.data);
  }, [q.data, form]);

  if (!form) return <div className="py-10 text-center">…</div>;

  const set = <K extends keyof HomeContent>(k: K, v: HomeContent[K]) => setForm({ ...form, [k]: v });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      await setFn({ data: form });
      toast.success("تم الحفظ");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSaving(false);
    }
  }

  function Pair({ k, label, multiline }: { k: keyof HomeContent; label: string; multiline?: boolean }) {
    const kAr = `${k}_ar` as keyof HomeContent;
    const kEn = `${k}_en` as keyof HomeContent;
    return (
      <div className="grid gap-2 md:grid-cols-2 rounded-xl border bg-secondary/20 p-3">
        <div className="md:col-span-2 text-xs font-bold text-muted-foreground">{label}</div>
        <label className="block">
          <span className="block text-xs mb-1">العربية</span>
          {multiline ? (
            <textarea rows={3} value={String(form![kAr] ?? "")} onChange={(e) => set(kAr, e.target.value as never)} className="input" />
          ) : (
            <input value={String(form![kAr] ?? "")} onChange={(e) => set(kAr, e.target.value as never)} className="input" />
          )}
        </label>
        <label className="block">
          <span className="block text-xs mb-1">English</span>
          {multiline ? (
            <textarea rows={3} value={String(form![kEn] ?? "")} onChange={(e) => set(kEn, e.target.value as never)} className="input" />
          ) : (
            <input value={String(form![kEn] ?? "")} onChange={(e) => set(kEn, e.target.value as never)} className="input" />
          )}
        </label>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">محتوى الصفحة الرئيسية</h1>
        <button
          type="button"
          onClick={() => setForm(DEFAULT_HOME_CONTENT)}
          className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-secondary"
        >
          <RotateCcw className="size-3.5" /> إعادة الافتراضي
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-card p-4">
        <Pair k={"tagline" as keyof HomeContent} label="الشعار العلوي (Tagline)" />
        <Pair k={"hero_lead" as keyof HomeContent} label="النص التعريفي تحت العنوان" multiline />
        <Pair k={"cta_start" as keyof HomeContent} label="زر بدء الحكاية (CTA)" />
        <Pair k={"feat_1_t" as keyof HomeContent} label="ميزة 1 — العنوان" />
        <Pair k={"feat_1_d" as keyof HomeContent} label="ميزة 1 — الوصف" multiline />
        <Pair k={"feat_2_t" as keyof HomeContent} label="ميزة 2 — العنوان" />
        <Pair k={"feat_2_d" as keyof HomeContent} label="ميزة 2 — الوصف" multiline />
        <Pair k={"feat_3_t" as keyof HomeContent} label="ميزة 3 — العنوان" />
        <Pair k={"feat_3_d" as keyof HomeContent} label="ميزة 3 — الوصف" multiline />
        <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-3 font-bold text-primary-foreground disabled:opacity-60">
          {saving && <Loader2 className="size-4 animate-spin" />}
          حفظ
        </button>
      </form>

      <style>{`.input{width:100%;border-radius:0.5rem;border:1px solid var(--color-border);background:var(--color-background);padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{box-shadow:0 0 0 2px var(--color-primary)}`}</style>
    </div>
  );
}
