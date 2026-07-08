import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listGalleryAdmin, setGalleryFlags } from "../lib/admin-ops.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/gallery")({ component: AdminGalleryPage });

function AdminGalleryPage() {
  const listFn = useServerFn(listGalleryAdmin);
  const setFn = useServerFn(setGalleryFlags);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-gallery"], queryFn: () => listFn(), refetchInterval: 60_000 });

  async function toggle(id: string, field: "isPublic" | "featured", value: boolean) {
    try {
      await setFn({ data: { orderId: id, [field]: value } });
      qc.invalidateQueries({ queryKey: ["admin-gallery"] });
      toast.success("تم التحديث");
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">إدارة المعرض</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        اختر أي قصص مُسلّمة تُعرض في المعرض العام، ورشّح المميّزة منها.
      </p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs">
            <tr>
              <th className="p-2">#</th>
              <th className="p-2 text-start">العنوان</th>
              <th className="p-2 text-start">المؤلف</th>
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
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={!!o.is_public}
                    onChange={(e) => toggle(o.id, "isPublic", e.target.checked)}
                  />
                </td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={!!o.gallery_featured}
                    onChange={(e) => toggle(o.id, "featured", e.target.checked)}
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
