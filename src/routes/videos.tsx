import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, ArrowLeft, Film } from "lucide-react";
import { getCurrentUser } from "../lib/auth.functions";
import { myOrders } from "../lib/orders.functions";
import { listVideoProducts, createVideoOrder } from "../lib/videos.functions";

export const Route = createFileRoute("/videos")({
  beforeLoad: async ({ location }) => {
    const me = await getCurrentUser();
    if (!me) throw redirect({ to: "/auth", search: { redirect: location.href } });
    return { me };
  },
  component: VideosCatalog,
});

function VideosCatalog() {
  const listProductsFn = useServerFn(listVideoProducts);
  const listOrdersFn = useServerFn(myOrders);
  const createFn = useServerFn(createVideoOrder);
  const catalog = useQuery({ queryKey: ["video-products"], queryFn: () => listProductsFn() });
  const orders = useQuery({ queryKey: ["my-orders-for-video"], queryFn: () => listOrdersFn() });

  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedStory, setSelectedStory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (catalog.isLoading) return <div className="p-8 text-center">جارٍ التحميل...</div>;
  if (!catalog.data?.enabled) {
    return (
      <div className="min-h-screen p-6 max-w-2xl mx-auto text-center space-y-4">
        <Film className="w-16 h-16 mx-auto opacity-40" />
        <h1 className="text-2xl font-bold">مكتبة الفيديو (Beta)</h1>
        <p className="text-muted-foreground">هذه الميزة معطّلة حالياً من الإدارة.</p>
        <Link to="/my-orders" className="btn-primary inline-block">العودة</Link>
      </div>
    );
  }

  const products = catalog.data.products;
  const deliveredOrders = (orders.data ?? []).filter((o: { status: string }) => o.status === "delivered");

  async function submit() {
    if (!selectedProduct || !selectedStory) {
      toast.error("اختر نوع الفيديو وقصة");
      return;
    }
    setBusy(true);
    try {
      await createFn({ data: { productId: selectedProduct, storyOrderId: selectedStory } });
      toast.success("تم إرسال طلب الفيديو للمراجعة");
      setSelectedProduct(null);
      setSelectedStory(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإرسال");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/my-orders" className="btn-ghost"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          مكتبة الفيديو <span className="text-xs bg-accent/40 px-2 py-1 rounded">Beta</span>
        </h1>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        حوّل قصصك إلى فيديو قصير. كل طلب يخضع لمراجعة الإدارة قبل التوليد لضمان الجودة.
      </p>

      <h2 className="font-semibold mb-3">١. اختر نوع الفيديو</h2>
      <div className="grid gap-3 md:grid-cols-2 mb-8">
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedProduct(p.id)}
            className={`text-right p-4 rounded-lg border-2 transition ${
              selectedProduct === p.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
            }`}
          >
            <div className="font-bold">{p.name_ar}</div>
            {p.description_ar && <div className="text-xs text-muted-foreground mt-1">{p.description_ar}</div>}
            <div className="mt-2 flex items-center justify-between text-sm">
              <span>{p.duration_sec} ثانية</span>
              <span className="font-bold text-primary">{p.price_iqd.toLocaleString()} د.ع</span>
            </div>
          </button>
        ))}
      </div>

      <h2 className="font-semibold mb-3">٢. اختر القصة</h2>
      {deliveredOrders.length === 0 ? (
        <div className="p-4 rounded bg-muted text-sm">لا توجد قصص مُسلَّمة. أنشئ قصة أولاً.</div>
      ) : (
        <div className="grid gap-2 mb-8">
          {deliveredOrders.map((o: { id: string; order_number: number; title: string | null }) => (
            <button
              key={o.id}
              onClick={() => setSelectedStory(o.id)}
              className={`text-right p-3 rounded border transition ${
                selectedStory === o.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
              }`}
            >
              <div className="font-semibold">#{o.order_number} — {o.title ?? "بلا عنوان"}</div>
            </button>
          ))}
        </div>
      )}

      <div className="sticky bottom-4 bg-background border rounded-lg p-4 flex items-center justify-between shadow-lg">
        <div className="text-sm">
          {selectedProduct && selectedStory ? (
            <span>جاهز للإرسال</span>
          ) : (
            <span className="text-muted-foreground">اختر نوع الفيديو والقصة</span>
          )}
        </div>
        <button
          disabled={busy || !selectedProduct || !selectedStory}
          onClick={submit}
          className="btn-primary"
        >
          {busy ? "جارٍ الإرسال..." : "إرسال للمراجعة"}
        </button>
      </div>

      <div className="text-center mt-6">
        <Link to="/my-videos" className="text-sm text-primary underline">فيديوهاتي ←</Link>
      </div>
    </div>
  );
}
