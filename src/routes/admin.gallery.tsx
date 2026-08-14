import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listGalleryAdmin, setGalleryFlags } from "../lib/admin-ops.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/gallery")({ component: AdminGalleryPage });

type GalleryCategory = "kids" | "adults" | "general";

function AdminGalleryPage() {
  const listFn = useServerFn(listGalleryAdmin);
  const setFn = useServerFn(setGalleryFlags);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-gallery"], queryFn: () => listFn(), refetchInterval: 60_000 });

  async function update(id: string, patch: Record<string, unknown>) {
    try {
      await setFn({ data: { orderId: id, ...patch } });
      qc.invalidateQueries({ queryKey: ["admin-gallery"] });
      toast.success("تم تحديث المعرض");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">إدارة المعرض</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        انشر القصص المسلّمة، صنّفها في معرض الأطفال أو الكبار، وحدد القصص المميّزة.
      </p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs">
            <tr>
              <th className="p-2">#</th>
              <th className="p-2 text-start">العنوان</th>
              <th className="p-2 text-start">المؤلف</th>
              <th className="p-2">المعرض</th>
              <th className="p-2">عام</th>
              <th className="p-2">مميّزة</th>
              <th className="p-2">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-2 font-mono">{o.order_number}</td>
                <td className="p-2">{o.public_title ?? o.title ?? "—"}</td>
                <td className="p-2 text-xs text-muted-foreground">
                  {o.show_author && o.public_author_name ? o.public_author_name : "—"}
                </td>
                <td className="p-2">
                  <select
                    className="rounded-lg border bg-background px-2 py-1 text-xs"
                    value={(o.gallery_category ?? (o.content_mode === "adult" ? "adults" : "kids")) as GalleryCategory}
                    onChange={(e) => update(o.id, { galleryCategory: e.target.value as GalleryCategory })}
                  >
                    <option value="kids">قصص الصغار</option>
                    <option value="adults">قصص الكبار</option>
                    <option value="general">عام</option>
                  </select>
                </td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={!!o.is_public}
                    onChange={(e) => update(o.id, { isPublic: e.target.checked })}
                  />
                </td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={!!o.gallery_featured}
                    onChange={(e) => update(o.id, { featured: e.target.checked })}
                    disabled={!o.is_public}
                  />
                </td>
                <td className="p-2 text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString("ar")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
