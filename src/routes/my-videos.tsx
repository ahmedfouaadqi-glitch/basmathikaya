import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Film, Share2, Globe, Lock } from "lucide-react";
import { getCurrentUser } from "../lib/auth.functions";
import { getMyVideos, publishMyVideo } from "../lib/videos.functions";

export const Route = createFileRoute("/my-videos")({
  beforeLoad: async ({ location }) => {
    const me = await getCurrentUser();
    if (!me) throw redirect({ to: "/auth", search: { redirect: location.href } });
    return { me };
  },
  component: MyVideosPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending_review: "بانتظار المراجعة",
  approved: "معتمد — قيد التوليد",
  generating: "قيد التوليد",
  ready: "جاهز",
  rejected: "مرفوض",
  failed: "فشل",
};

function MyVideosPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(getMyVideos);
  const publishFn = useServerFn(publishMyVideo);
  const q = useQuery({ queryKey: ["my-videos"], queryFn: () => listFn() });

  async function togglePublish(id: string, isPublic: boolean) {
    try {
      const r = await publishFn({ data: { id, isPublic: !isPublic } });
      if (!isPublic && r.share_token) {
        const url = `${window.location.origin}/v/${r.share_token}`;
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.success("تم النشر ونسخ الرابط");
      } else {
        toast.success(!isPublic ? "تم النشر" : "تم إلغاء النشر");
      }
      qc.invalidateQueries({ queryKey: ["my-videos"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل");
    }
  }

  const rows = q.data ?? [];

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/my-orders" className="btn-ghost"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Film className="w-6 h-6 text-primary" /> فيديوهاتي
        </h1>
        <Link to="/videos" className="btn-primary ms-auto">طلب فيديو جديد</Link>
      </div>

      {q.isLoading && <div className="text-center p-8">جارٍ التحميل...</div>}
      {!q.isLoading && rows.length === 0 && (
        <div className="text-center p-12 text-muted-foreground">
          لا توجد فيديوهات بعد. <Link to="/videos" className="text-primary underline">ابدأ بطلب جديد</Link>
        </div>
      )}

      <div className="grid gap-3">
        {rows.map((v) => (
          <div key={v.id} className="p-4 rounded-lg border bg-card">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-semibold">{v.product_id}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(v.created_at).toLocaleDateString("ar")} — {v.price_iqd.toLocaleString()} د.ع
                </div>
                {v.rejection_reason && (
                  <div className="text-xs text-destructive mt-2">سبب الرفض: {v.rejection_reason}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded bg-muted">{STATUS_LABEL[v.status] ?? v.status}</span>
                {v.status === "ready" && v.share_token && (
                  <Link to="/v/$token" params={{ token: v.share_token }} className="btn-primary text-sm">
                    تشغيل
                  </Link>
                )}
                {v.status === "ready" && (
                  <button onClick={() => togglePublish(v.id, !!v.is_public)} className="btn-ghost text-sm">
                    {v.is_public ? <><Lock className="w-3 h-3 inline" /> إلغاء النشر</> : <><Globe className="w-3 h-3 inline" /> نشر</>}
                  </button>
                )}
                {v.status === "ready" && v.is_public && v.share_token && (
                  <button
                    className="btn-ghost text-sm"
                    onClick={() => {
                      const url = `${window.location.origin}/v/${v.share_token}`;
                      navigator.clipboard.writeText(url);
                      toast.success("تم نسخ الرابط");
                    }}
                  >
                    <Share2 className="w-3 h-3 inline" /> نسخ الرابط
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
