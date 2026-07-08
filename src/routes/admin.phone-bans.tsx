import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listPhoneBans, addPhoneBan, removePhoneBan } from "../lib/admin-ops.functions";

export const Route = createFileRoute("/admin/phone-bans")({ component: PhoneBansPage });

type Ban = { phone: string; reason: string | null; banned_at: string };

function PhoneBansPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPhoneBans);
  const addFn = useServerFn(addPhoneBan);
  const rmFn = useServerFn(removePhoneBan);
  const q = useQuery({ queryKey: ["admin-phone-bans"], queryFn: () => listFn() });
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const inv = () => qc.invalidateQueries({ queryKey: ["admin-phone-bans"] });
  const add = useMutation({
    mutationFn: () => addFn({ data: { phone, reason: reason || undefined } }),
    onSuccess: () => { toast.success("تم الحظر"); setPhone(""); setReason(""); inv(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطأ"),
  });
  const rm = useMutation({
    mutationFn: (p: string) => rmFn({ data: { phone: p } }),
    onSuccess: () => { toast.success("تم الإلغاء"); inv(); },
  });
  const rows = (q.data ?? []) as Ban[];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">الأرقام المحظورة</h1>
      <div className="mb-4 rounded-xl border bg-card p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07..."
            className="rounded-md border bg-background px-3 py-2 text-sm" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="السبب (اختياري)"
            className="rounded-md border bg-background px-3 py-2 text-sm" />
          <button disabled={!phone.trim() || add.isPending}
            onClick={() => add.mutate()}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50">
            حظر
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs">
            <tr>
              <th className="p-2 text-start">الرقم</th><th className="p-2 text-start">السبب</th>
              <th className="p-2 text-start">التاريخ</th><th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.phone} className="border-t">
                <td className="p-2 font-mono">{b.phone}</td>
                <td className="p-2 text-xs">{b.reason ?? "—"}</td>
                <td className="p-2 text-xs">{new Date(b.banned_at).toLocaleDateString("ar")}</td>
                <td className="p-2 text-end">
                  <button onClick={() => { if (confirm("إلغاء الحظر؟")) rm.mutate(b.phone); }}
                    className="rounded border px-2 py-1 text-xs hover:bg-secondary">
                    إلغاء
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
