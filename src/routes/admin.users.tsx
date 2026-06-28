import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { adminListUsers } from "../lib/orders.functions";
import { useT } from "../lib/i18n";
import { Download } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { t } = useT();
  const fn = useServerFn(adminListUsers);
  const q = useQuery({ queryKey: ["admin-users"], queryFn: () => fn(), refetchInterval: 30_000 });
  const rows = q.data ?? [];

  const csvHref = useMemo(() => {
    const header = ["name", "phone", "orders", "total_spent_iqd", "marketing_consent", "last_login_at", "created_at", "notes"];
    const lines = [header.join(",")].concat(
      rows.map((u) => [
        JSON.stringify(u.full_name ?? ""),
        JSON.stringify(u.phone ?? ""),
        u.order_count,
        u.total_spent_iqd,
        u.marketing_consent ? "1" : "0",
        u.last_login_at ?? "",
        u.created_at ?? "",
        JSON.stringify(u.notes ?? ""),
      ].join(",")),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [rows]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("admin_users")}</h1>
        <a href={csvHref} download="basma-customers.csv" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">
          <Download className="size-4" /> {t("export_csv")}
        </a>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-start">{t("auth_full_name")}</th>
              <th className="px-3 py-2.5 text-start">{t("auth_phone")}</th>
              <th className="px-3 py-2.5 text-end">{t("col_orders_count")}</th>
              <th className="px-3 py-2.5 text-end">{t("col_spent")}</th>
              <th className="px-3 py-2.5 text-start">{t("col_last_login")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">—</td></tr>
            )}
            {rows.map((u) => (
              <tr key={u.id} className="border-t hover:bg-secondary/30">
                <td className="px-3 py-2.5 font-medium">{u.full_name}</td>
                <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs" dir="ltr">{u.phone}</td>
                <td className="px-3 py-2.5 text-end font-mono">{u.order_count}</td>
                <td className="px-3 py-2.5 text-end font-mono text-primary">{Number(u.total_spent_iqd).toLocaleString()}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
