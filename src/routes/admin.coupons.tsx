import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Plus } from "lucide-react";
import { adminListCoupons, adminUpsertCoupon, adminDeleteCoupon } from "../lib/orders.functions";
import { useT } from "../lib/i18n";

export const Route = createFileRoute("/admin/coupons")({
  component: CouponsPage,
});

type Draft = {
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_uses: number | "";
  valid_from: string;
  valid_to: string;
  applies_to: "all" | "new";
  active: boolean;
  min_pages: number;
  applies_quality: Array<"standard" | "premium">;
  applies_tier: Array<"pdf" | "printed" | "video">;
};

const emptyDraft: Draft = {
  code: "",
  discount_type: "percent",
  discount_value: 10,
  max_uses: "",
  valid_from: "",
  valid_to: "",
  applies_to: "all",
  active: true,
  min_pages: 0,
  applies_quality: ["standard", "premium"],
  applies_tier: ["pdf", "printed", "video"],
};


function CouponsPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListCoupons);
  const upsertFn = useServerFn(adminUpsertCoupon);
  const delFn = useServerFn(adminDeleteCoupon);
  const q = useQuery({ queryKey: ["admin-coupons"], queryFn: () => listFn() });
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertFn({
        data: {
          code: draft.code,
          discount_type: draft.discount_type,
          discount_value: Number(draft.discount_value),
          max_uses: draft.max_uses === "" ? null : Number(draft.max_uses),
          valid_from: draft.valid_from || null,
          valid_to: draft.valid_to || null,
          applies_to: draft.applies_to,
          active: draft.active,
          min_pages: Number(draft.min_pages) || 0,
          applies_quality: draft.applies_quality.length ? draft.applies_quality : ["standard", "premium"],
          applies_tier: draft.applies_tier.length ? draft.applies_tier : ["pdf", "printed", "video"],
        },
      });

      setDraft(emptyDraft);
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success(t("saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("حذف الكوبون؟")) return;
    try {
      await delFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">{t("admin_coupons")}</h1>

      <form onSubmit={save} className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="text-sm font-semibold">إضافة كوبون جديد</div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="الكود">
            <input
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
              maxLength={40}
              required
              className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>
          <Field label="نوع الخصم">
            <select
              value={draft.discount_type}
              onChange={(e) => setDraft({ ...draft, discount_type: e.target.value as Draft["discount_type"] })}
              className="w-full rounded-lg border bg-background px-3 py-2"
            >
              <option value="percent">نسبة مئوية %</option>
              <option value="fixed">مبلغ ثابت د.ع</option>
            </select>
          </Field>
          <Field label={draft.discount_type === "percent" ? "قيمة الخصم %" : "قيمة الخصم د.ع"}>
            <input
              type="number"
              min={1}
              value={draft.discount_value}
              onChange={(e) => setDraft({ ...draft, discount_value: Number(e.target.value) })}
              className="w-full rounded-lg border bg-background px-3 py-2"
            />
          </Field>
          <Field label="الحد الأقصى للاستخدام (فارغ = بلا حد)">
            <input
              type="number"
              min={1}
              value={draft.max_uses}
              onChange={(e) => setDraft({ ...draft, max_uses: e.target.value === "" ? "" : Number(e.target.value) })}
              className="w-full rounded-lg border bg-background px-3 py-2"
            />
          </Field>
          <Field label="ساري من">
            <input
              type="date"
              value={draft.valid_from}
              onChange={(e) => setDraft({ ...draft, valid_from: e.target.value })}
              className="w-full rounded-lg border bg-background px-3 py-2"
            />
          </Field>
          <Field label="ساري إلى">
            <input
              type="date"
              value={draft.valid_to}
              onChange={(e) => setDraft({ ...draft, valid_to: e.target.value })}
              className="w-full rounded-lg border bg-background px-3 py-2"
            />
          </Field>
          <Field label="يشمل">
            <select
              value={draft.applies_to}
              onChange={(e) => setDraft({ ...draft, applies_to: e.target.value as Draft["applies_to"] })}
              className="w-full rounded-lg border bg-background px-3 py-2"
            >
              <option value="all">الكل</option>
              <option value="new">المستخدمين الجدد فقط</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm mt-6">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            نشط
          </label>
        </div>
        <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent px-4 py-2.5 font-bold text-primary-foreground disabled:opacity-60">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          حفظ الكوبون
        </button>
      </form>

      <div className="rounded-2xl border bg-card">
        <div className="border-b px-4 py-3 text-sm font-semibold">القائمة</div>
        <div className="divide-y">
          {q.isLoading && <div className="p-6 text-center text-sm text-muted-foreground">…</div>}
          {(q.data ?? []).length === 0 && !q.isLoading && (
            <div className="p-6 text-center text-sm text-muted-foreground">لا يوجد كوبونات</div>
          )}
          {(q.data ?? []).map((c) => {
            const cc = c as {
              id: string; code: string; discount_type: string; discount_value: number | string;
              max_uses: number | null; uses_count: number | null; applies_to: string; active: boolean;
              valid_from: string | null; valid_to: string | null;
            };
            return (
              <div key={cc.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-24 font-mono font-bold">{cc.code}</div>
                <div className="text-muted-foreground">
                  {cc.discount_type === "percent" ? `${cc.discount_value}%` : `${cc.discount_value} د.ع`}
                </div>
                <div className="text-xs text-muted-foreground">
                  الاستخدام {cc.uses_count ?? 0}/{cc.max_uses ?? "∞"} — {cc.applies_to === "new" ? "جدد" : "الكل"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {cc.valid_from ?? "—"} → {cc.valid_to ?? "—"}
                </div>
                <span className={`ms-auto rounded-full px-2 py-0.5 text-xs ${cc.active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {cc.active ? "نشط" : "متوقف"}
                </span>
                <button onClick={() => remove(cc.id)} className="rounded-md p-1.5 text-destructive hover:bg-destructive/10" title="حذف">
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}
