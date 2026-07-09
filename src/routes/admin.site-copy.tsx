import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Eye } from "lucide-react";
import { adminListSiteCopy, adminUpsertSiteCopy, SITE_COPY_KEYS, type SiteCopyRow } from "../lib/site-copy.functions";
import { SiteMarkdown } from "../components/SiteMarkdown";

export const Route = createFileRoute("/admin/site-copy")({
  head: () => ({ meta: [{ title: "نصوص الموقع — الإدارة" }, { name: "robots", content: "noindex" }] }),
  component: AdminSiteCopyPage,
});

function AdminSiteCopyPage() {
  const list = useServerFn(adminListSiteCopy);
  const upsert = useServerFn(adminUpsertSiteCopy);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-site-copy"],
    queryFn: () => list(),
  });

  const mutation = useMutation({
    mutationFn: (input: { key: string; title: string | null; body_md: string }) =>
      upsert({ data: input }),
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["admin-site-copy"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const knownKeys = [...SITE_COPY_KEYS];
  const rowsByKey: Record<string, SiteCopyRow> = {};
  for (const r of data ?? []) rowsByKey[r.key] = r;
  const allKeys = Array.from(new Set([...knownKeys, ...(data ?? []).map((r) => r.key)]));

  const [selectedKey, setSelectedKey] = useState<string>(knownKeys[0]);
  const current = rowsByKey[selectedKey] ?? { key: selectedKey, title: "", body_md: "", updated_at: "", updated_by: null };

  const [title, setTitle] = useState<string>(current.title ?? "");
  const [body, setBody] = useState<string>(current.body_md ?? "");
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    setTitle(current.title ?? "");
    setBody(current.body_md ?? "");
  }, [selectedKey, current.body_md, current.title]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
      <aside className="rounded-2xl border bg-card p-3">
        <h2 className="mb-2 text-sm font-bold text-muted-foreground">النصوص</h2>
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ul className="space-y-1">
            {allKeys.map((k) => (
              <li key={k}>
                <button
                  onClick={() => setSelectedKey(k)}
                  className={`w-full rounded-md px-2 py-1.5 text-right text-sm hover:bg-secondary ${selectedKey === k ? "bg-primary/10 font-semibold text-primary" : ""}`}
                >
                  <div className="truncate">{rowsByKey[k]?.title || k}</div>
                  <div className="truncate text-[10px] text-muted-foreground" dir="ltr">{k}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="space-y-4 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground" dir="ltr">{selectedKey}</div>
            <h1 className="text-lg font-bold">{title || "بدون عنوان"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
            >
              <Eye className="size-4" /> {showPreview ? "إخفاء المعاينة" : "معاينة"}
            </button>
            <button
              onClick={() => mutation.mutate({ key: selectedKey, title: title || null, body_md: body })}
              disabled={mutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              حفظ
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">العنوان (اختياري)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
            maxLength={200}
          />
        </div>

        <div className={`grid gap-4 ${showPreview ? "md:grid-cols-2" : ""}`}>
          <div>
            <label className="block text-sm font-medium mb-1">النص (Markdown)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
              maxLength={20000}
              className="w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
              dir="rtl"
            />
            <div className="mt-1 text-end text-xs text-muted-foreground">{body.length}/20000</div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              مدعوم: <code>**عريض**</code>، <code>_مائل_</code>، <code>[نص](رابط)</code>، قوائم بـ <code>-</code>، فقرات مفصولة بسطر فارغ.
            </p>
          </div>
          {showPreview && (
            <div>
              <label className="block text-sm font-medium mb-1">المعاينة</label>
              <div className="min-h-[400px] rounded-lg border bg-background p-4 leading-relaxed">
                <SiteMarkdown source={body} className="space-y-3 text-sm" />
              </div>
            </div>
          )}
        </div>

        {current.updated_at && (
          <div className="text-xs text-muted-foreground" dir="ltr">
            Last updated: {new Date(current.updated_at).toLocaleString()}
          </div>
        )}
      </section>
    </div>
  );
}
