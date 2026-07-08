import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Star, StarOff, ArrowRight, Users } from "lucide-react";
import { getCurrentUser } from "../lib/auth.functions";
import {
  listFamilyMembers,
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  type FamilyMember,
} from "../lib/family.functions";

export const Route = createFileRoute("/family")({
  head: () => ({
    meta: [
      { title: "عائلتي — بصمة حكاية" },
      { name: "description", content: "احفظ شخصيات عائلتك لإعادة استخدامها في القصص." },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const me = await getCurrentUser();
    if (!me) throw redirect({ to: "/auth", search: { redirect: location.href } });
    return { me };
  },
  component: FamilyPage,
});

const ROLES = [
  { value: "family", label: "من العائلة" },
  { value: "protagonist", label: "بطل" },
  { value: "friend", label: "صديق" },
  { value: "pet", label: "حيوان أليف" },
  { value: "other", label: "آخر" },
] as const;

type FormState = {
  id?: string;
  display_name: string;
  nickname: string;
  age: string;
  gender: string;
  role: (typeof ROLES)[number]["value"];
  is_favorite: boolean;
};

const emptyForm: FormState = {
  display_name: "",
  nickname: "",
  age: "",
  gender: "",
  role: "family",
  is_favorite: false,
};

function FamilyPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listFamilyMembers);
  const createFn = useServerFn(createFamilyMember);
  const updateFn = useServerFn(updateFamilyMember);
  const deleteFn = useServerFn(deleteFamilyMember);

  const q = useQuery({ queryKey: ["family-members"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["family-members"] });

  const saveMut = useMutation({
    mutationFn: async (state: FormState) => {
      const payload = {
        display_name: state.display_name.trim(),
        nickname: state.nickname.trim() || null,
        age: state.age.trim() ? Number(state.age) : null,
        gender: state.gender.trim() || null,
        role: state.role,
        is_favorite: state.is_favorite,
      };
      if (state.id) {
        return updateFn({ data: { id: state.id, patch: payload } });
      }
      return createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      setOpen(false);
      setForm(emptyForm);
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "خطأ"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); invalidate(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "خطأ"),
  });

  const favMut = useMutation({
    mutationFn: (m: FamilyMember) =>
      updateFn({ data: { id: m.id, patch: { is_favorite: !m.is_favorite } } }),
    onSuccess: invalidate,
  });

  function openCreate() {
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(m: FamilyMember) {
    setForm({
      id: m.id,
      display_name: m.display_name,
      nickname: m.nickname ?? "",
      age: m.age != null ? String(m.age) : "",
      gender: m.gender ?? "",
      role: (ROLES.find((r) => r.value === m.role)?.value ?? "family") as FormState["role"],
      is_favorite: m.is_favorite,
    });
    setOpen(true);
  }

  const members = q.data ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold inline-flex items-center gap-2">
            <Users className="size-6" /> عائلتي
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            احفظ الشخصيات لتستخدمها بسرعة في قصص جديدة.
          </p>
        </div>
        <Link
          to="/my-orders"
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
        >
          <ArrowRight className="size-4" /> طلباتي
        </Link>
      </div>

      <button
        onClick={openCreate}
        className="mb-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        <Plus className="size-4" /> إضافة فرد جديد
      </button>

      {q.isLoading ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">…</div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">
          لم تُضِف أي فرد بعد. ابدأ بإضافة أطفالك أو أفراد عائلتك.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <li key={m.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-bold">{m.display_name}</h3>
                    {m.is_favorite && <Star className="size-4 fill-accent text-accent" />}
                  </div>
                  {m.nickname && (
                    <p className="mt-0.5 text-xs text-muted-foreground">« {m.nickname} »</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ROLES.find((r) => r.value === m.role)?.label ?? m.role}
                    {m.age != null && ` · ${m.age} سنة`}
                    {m.gender && ` · ${m.gender}`}
                  </p>
                  {m.times_used > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      استُخدم {m.times_used} مرة
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    onClick={() => favMut.mutate(m)}
                    className="rounded-md border p-1.5 hover:bg-secondary"
                    title={m.is_favorite ? "إلغاء المفضلة" : "إضافة للمفضلة"}
                  >
                    {m.is_favorite ? <StarOff className="size-4" /> : <Star className="size-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(m)}
                    className="rounded-md border p-1.5 hover:bg-secondary"
                    title="تعديل"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`حذف ${m.display_name}؟`)) deleteMut.mutate(m.id);
                    }}
                    className="rounded-md border p-1.5 text-destructive hover:bg-destructive/10"
                    title="حذف"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-bold">
              {form.id ? "تعديل فرد" : "إضافة فرد جديد"}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.display_name.trim()) {
                  toast.error("الاسم مطلوب");
                  return;
                }
                saveMut.mutate(form);
              }}
              className="space-y-3"
            >
              <label className="block text-sm">
                <span className="mb-1 block font-semibold">الاسم *</span>
                <input
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="w-full rounded-md border bg-background px-3 py-2"
                  maxLength={80}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold">لقب مستعار</span>
                <input
                  value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                  className="w-full rounded-md border bg-background px-3 py-2"
                  maxLength={80}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold">العمر</span>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                    className="w-full rounded-md border bg-background px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold">النوع</span>
                  <input
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full rounded-md border bg-background px-3 py-2"
                    placeholder="ذكر / أنثى"
                    maxLength={20}
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold">الدور</span>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as FormState["role"] })
                  }
                  className="w-full rounded-md border bg-background px-3 py-2"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_favorite}
                  onChange={(e) => setForm({ ...form, is_favorite: e.target.checked })}
                />
                <span>المفضلة</span>
              </label>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saveMut.isPending}
                  className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {saveMut.isPending ? "…" : "حفظ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
