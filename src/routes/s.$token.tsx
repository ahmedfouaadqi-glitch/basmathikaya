import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getShareCardMeta } from "@/lib/share.functions";

const SITE = "https://basmathikaya.lovable.app";

export const Route = createFileRoute("/s/$token")({
  loader: async ({ params }) => {
    const meta = await getShareCardMeta({ data: { token: params.token } });
    if (!meta) throw notFound();
    return { meta };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "قصة غير متوفرة — بصمة حكاية" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = loaderData.meta.title || `قصة #${loaderData.meta.orderNumber}`;
    const desc = "قصة مصممة خصيصًا من بصمة حكاية — اطلب مثلها لطفلك.";
    const shareUrl = `${SITE}/s/${params.token}`;
    const imgUrl = `${SITE}/api/public/share-cards/${params.token}`;
    return {
      meta: [
        { title: `${title} — بصمة حكاية` },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: shareUrl },
        { property: "og:image", content: imgUrl },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: imgUrl },
      ],
      links: [{ rel: "canonical", href: shareUrl }],
    };
  },
  component: SharePage,
  notFoundComponent: NotFoundPage,
  errorComponent: () => (
    <div className="mx-auto max-w-md p-8 text-center text-muted-foreground">
      تعذّر تحميل القصة.
    </div>
  ),
});

function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-bold">القصة غير متوفرة</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        الرابط قد يكون منتهيًا أو تم حذفه.
      </p>
      <Link to="/" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
        الصفحة الرئيسية
      </Link>
    </div>
  );
}

function SharePage() {
  const { meta } = Route.useLoaderData();
  const params = Route.useParams();
  const imgUrl = `/api/public/share-cards/${params.token}`;
  const title = meta.title || `قصة #${meta.orderNumber}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        {meta.coverImagePath ? (
          <div className="aspect-[4/3] w-full bg-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgUrl}
              alt={title}
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20 text-6xl">
            📖
          </div>
        )}
        <div className="p-6 text-center">
          <p className="text-xs text-muted-foreground">بصمة حكاية · قصة #{meta.orderNumber}</p>
          <h1 className="mt-1 text-2xl font-bold">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            قصة مصورة صُممت خصيصًا لطفل. اجعل طفلك بطل قصته القادمة.
          </p>
          <Link
            to="/create"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            اطلب قصة مثلها ✨
          </Link>
        </div>
      </div>
    </div>
  );
}
