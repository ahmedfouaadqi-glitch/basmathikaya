import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { adminListUsers, adminSetUserStatus, adminDeleteUser } from "../lib/orders.functions";
import { useT } from "../lib/i18n";
import { Download, Search } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const fn = useServerFn(adminListUsers);
  const setStatusFn = useServerFn(adminSetUserStatus);
  const delFn = useServerFn(adminDeleteUser);
  const q = useQuery({ queryKey: ["admin-users"], queryFn: () => fn(), refetchInterval: 30_000 });
  const allRows = q.data ?? [];
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return allRows;
    return allRows.filter((u) =>
      (u.full_name ?? "").toLowerCase().includes(s) ||
      (u.phone ?? "").toLowerCase().includes(s) ||
      (u.notes ?? "").toLowerCase().includes(s),
    );
  }, [allRows, search]);

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("admin_users")}</h1>
        <a href={csvHref} download="basma-customers.csv" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">
          <Download className="size-4" /> {t("export_csv")}
        </a>
      </div>

      <div className="mb-3 relative">
        <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search_customers")}
          className="w-full rounded-xl border bg-card ps-9 pe-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
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
