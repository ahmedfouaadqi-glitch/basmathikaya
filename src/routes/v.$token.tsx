import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Film } from "lucide-react";
import { getPublicVideo } from "../lib/videos.functions";

export const Route = createFileRoute("/v/$token")({
  component: PublicVideoPage,
  head: ({ params }) => ({
    meta: [
      { title: `فيديو قصة — ${params.token}` },
      { name: "description", content: "شاهد قصة الطفل كفيديو قصير من صنعنا لك." },
    ],
  }),
});

function PublicVideoPage() {
  const { token } = Route.useParams();
  const fn = useServerFn(getPublicVideo);
  const q = useQuery({ queryKey: ["public-video", token], queryFn: () => fn({ data: { token } }) });

  if (q.isLoading) return <div className="p-8 text-center">جارٍ التحميل...</div>;
  if (q.isError || !q.data) {
    return (
      <div className="min-h-screen p-6 max-w-xl mx-auto text-center space-y-4">
        <Film className="w-16 h-16 mx-auto opacity-40" />
        <h1 className="text-xl font-bold">الفيديو غير متاح</h1>
        <Link to="/" className="btn-primary inline-block">العودة للرئيسية</Link>
      </div>
    );
  }

  const v = q.data;

  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto">
      <div className="rounded-lg overflow-hidden bg-black shadow-xl aspect-video flex items-center justify-center">
        {v.final_url ? (
          <video src={v.final_url} poster={v.poster_url ?? undefined} controls className="w-full h-full" />
        ) : (
          <div className="text-white/70">لا يوجد ملف فيديو</div>
        )}
      </div>
      <div className="mt-4 text-center space-y-2">
        <div className="text-sm text-muted-foreground">
          فيديو مُنشأ خصيصاً من قصة الطفل
        </div>
        <Link to="/" className="btn-primary inline-block mt-4">أنشئ قصتك الخاصة</Link>
      </div>
    </div>
  );
}
