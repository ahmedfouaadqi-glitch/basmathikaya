import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { getEmergency, setEmergency } from "../lib/admin-ops.functions";

export const Route = createFileRoute("/admin/emergency")({ component: EmergencyPage });

type Controls = {
  ai_all_paused: boolean; ai_image_paused: boolean; ai_text_paused: boolean; qa_paused: boolean;
  reason: string | null; paused_by: string | null; paused_at: string | null;
};

const SWITCHES: Array<{ key: keyof Controls; label: string; desc: string }> = [
  { key: "ai_all_paused", label: "إيقاف كل الذكاء الاصطناعي", desc: "يمنع كل توليد نص وصورة." },
  { key: "ai_text_paused", label: "إيقاف توليد النص", desc: "يوقف كتابة القصص فقط." },
  { key: "ai_image_paused", label: "إيقاف توليد الصور", desc: "يوقف الصور فقط." },
  { key: "qa_paused", label: "إيقاف مراجعة الجودة", desc: "يعطّل خطوة الـ QA بعد التوليد." },
];

function EmergencyPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getEmergency);
  const setFn = useServerFn(setEmergency);
  const q = useQuery({ queryKey: ["admin-emergency"], queryFn: () => getFn(), refetchInterval: 15_000 });
  const [reason, setReason] = useState("");
  const inv = () => qc.invalidateQueries({ queryKey: ["admin-emergency"] });
  const mut = useMutation({
    mutationFn: (v: Partial<Controls> & { reason?: string }) => setFn({ data: v }),
    onSuccess: () => { toast.success("تم التحديث"); inv(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطأ"),
  });
  const c = (q.data ?? {}) as Controls;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="size-6 text-destructive" />
        <h1 className="text-2xl font-bold">أزرار الطوارئ</h1>
      </div>
      <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        تفعيل أي زر يوقف الخدمة فورًا. اذكر السبب دائمًا.
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-semibold">السبب</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder={c.reason ?? "مثال: تجاوزنا حد الميزانية"}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm" maxLength={500} />
      </label>

      <div className="space-y-2">
        {SWITCHES.map((sw) => {
          const on = Boolean(c[sw.key]);
          return (
            <div key={sw.key} className="flex items-center justify-between rounded-xl border bg-card p-3">
              <div className="min-w-0">
                <div className="font-semibold">{sw.label}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{sw.desc}</p>
              </div>
              <button
                onClick={() => {
                  if (!on && !reason.trim()) { toast.error("اذكر السبب أولاً"); return; }
                  if (!confirm(on ? "تشغيل الخدمة؟" : "إيقاف الخدمة؟")) return;
                  mut.mutate({ [sw.key]: !on, reason: reason.trim() || undefined });
                }}
                className={`rounded-md px-4 py-2 text-sm font-bold ${on ? "bg-destructive text-destructive-foreground" : "border hover:bg-secondary"}`}
              >
                {on ? "متوقف" : "شغّال"}
              </button>
            </div>
          );
        })}
      </div>

      {c.paused_at && (
        <p className="mt-4 text-xs text-muted-foreground">
          آخر تعديل: {new Date(c.paused_at).toLocaleString("ar")} — {c.paused_by ?? ""}
        </p>
      )}
    </div>
  );
}
