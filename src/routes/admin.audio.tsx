import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, Play, Music, Volume2 } from "lucide-react";
import { adminListAudio, adminUploadAudio, adminUpdateAudio, adminDeleteAudio, adminSignAudio } from "@/lib/audio-admin.functions";
import { listFlags, updateFlag } from "@/lib/admin-ops.functions";

export const Route = createFileRoute("/admin/audio")({ component: AdminAudioPage });

const SFX_SLOTS = [
  { slot: "click", label: "نقر" },
  { slot: "success", label: "نجاح / إتمام طلب" },
  { slot: "error", label: "خطأ / رفض طلب" },
  { slot: "notify", label: "إشعار" },
  { slot: "nav", label: "تنقّل بين الصفحات" },
] as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      res(result.split(",")[1] ?? "");
    };
    reader.onerror = () => rej(reader.error);
    reader.readAsDataURL(file);
  });
}

function AdminAudioPage() {
  const listFn = useServerFn(adminListAudio);
  const flagsFn = useServerFn(listFlags);
  const q = useQuery({ queryKey: ["admin-audio"], queryFn: () => listFn() });
  const flagsQ = useQuery({ queryKey: ["admin-flags"], queryFn: () => flagsFn() });

  const [tab, setTab] = useState<"music" | "sfx" | "settings">("music");

  const music = (q.data ?? []).filter((r) => r.kind === "music");
  const sfx = (q.data ?? []).filter((r) => r.kind === "sfx");

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Music className="size-6" />
        <h1 className="text-2xl font-bold">مكتبة الصوت</h1>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        ارفع الموسيقى وأصوات الواجهة، وتحكم في تفعيل الميزة من التبويب الأخير.
      </p>
      <div className="mb-4 flex gap-1 border-b">
        {[
          { id: "music", label: `موسيقى الخلفية (${music.length})` },
          { id: "sfx", label: `أصوات الواجهة (${sfx.filter((s) => s.is_active).length}/${SFX_SLOTS.length})` },
          { id: "settings", label: "الإعدادات" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.id ? "border-primary text-primary" : "border-transparent hover:text-foreground text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "music" && <MusicTab items={music} />}
      {tab === "sfx" && <SfxTab items={sfx} />}
      {tab === "settings" && <SettingsTab flags={flagsQ.data ?? []} />}
    </div>
  );
}

function MusicTab({ items }: { items: Array<Record<string, unknown>> }) {
  const uploadFn = useServerFn(adminUploadAudio);
  const updateFn = useServerFn(adminUpdateAudio);
  const deleteFn = useServerFn(adminDeleteAudio);
  const signFn = useServerFn(adminSignAudio);
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function submit() {
    if (!file || !title.trim()) { toast.error("الرجاء اختيار ملف وإدخال عنوان"); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error("الحد الأقصى 15MB"); return; }
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      await uploadFn({ data: {
        kind: "music", title_ar: title.trim(),
        filename: file.name, mime_type: file.type || "audio/mpeg",
        base64, volume_default: 0.5,
      }});
      toast.success("تم الرفع");
      setTitle(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["admin-audio"] });
      qc.invalidateQueries({ queryKey: ["audio-bootstrap"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
    finally { setUploading(false); }
  }

  async function preview(filePath: string) {
    try {
      const { url } = await signFn({ data: { filePath } });
      new Audio(url).play().catch(() => toast.error("تعذر التشغيل"));
    } catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 font-semibold">رفع مقطع جديد</div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input type="text" placeholder="عنوان المقطع" value={title} onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border bg-background px-3 py-2" />
          <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm" />
          <button onClick={submit} disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50">
            <Upload className="size-4" /> {uploading ? "جارٍ الرفع…" : "رفع"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">MP3 أو WAV، الحد الأقصى 15MB.</p>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs">
            <tr>
              <th className="p-2 text-start">العنوان</th>
              <th className="p-2">مفعّل</th>
              <th className="p-2">ترتيب</th>
              <th className="p-2 w-40">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">لا توجد مقاطع بعد</td></tr>
            )}
            {items.map((item) => {
              const r = item as { id: string; title_ar: string; file_path: string; is_active: boolean; display_order: number };
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.title_ar}</td>
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={r.is_active} onChange={async (e) => {
                      await updateFn({ data: { id: r.id, is_active: e.target.checked } });
                      qc.invalidateQueries({ queryKey: ["admin-audio"] });
                      qc.invalidateQueries({ queryKey: ["audio-bootstrap"] });
                    }} />
                  </td>
                  <td className="p-2 text-center">
                    <input type="number" defaultValue={r.display_order} className="w-16 rounded border px-2 py-1 text-center bg-background"
                      onBlur={async (e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!Number.isFinite(val) || val === r.display_order) return;
                        await updateFn({ data: { id: r.id, display_order: val } });
                        qc.invalidateQueries({ queryKey: ["admin-audio"] });
                      }} />
                  </td>
                  <td className="p-2">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => preview(r.file_path)} className="rounded border p-1.5 hover:bg-secondary" title="معاينة">
                        <Play className="size-3.5" />
                      </button>
                      <button onClick={async () => {
                        if (!confirm("حذف نهائي؟")) return;
                        await deleteFn({ data: { id: r.id } });
                        qc.invalidateQueries({ queryKey: ["admin-audio"] });
                        qc.invalidateQueries({ queryKey: ["audio-bootstrap"] });
                      }} className="rounded border p-1.5 text-destructive hover:bg-destructive/10" title="حذف">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SfxTab({ items }: { items: Array<Record<string, unknown>> }) {
  const uploadFn = useServerFn(adminUploadAudio);
  const deleteFn = useServerFn(adminDeleteAudio);
  const signFn = useServerFn(adminSignAudio);
  const qc = useQueryClient();

  async function replaceSlot(slot: (typeof SFX_SLOTS)[number]["slot"], file: File, title: string) {
    if (file.size > 2 * 1024 * 1024) { toast.error("الحد الأقصى 2MB لأصوات الواجهة"); return; }
    try {
      const base64 = await fileToBase64(file);
      await uploadFn({ data: {
        kind: "sfx", slot, title_ar: title || slot,
        filename: file.name, mime_type: file.type || "audio/mpeg",
        base64, volume_default: 0.4,
      }});
      toast.success(`تم استبدال صوت "${title}"`);
      qc.invalidateQueries({ queryKey: ["admin-audio"] });
      qc.invalidateQueries({ queryKey: ["audio-bootstrap"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
  }

  async function preview(filePath: string) {
    try {
      const { url } = await signFn({ data: { filePath } });
      new Audio(url).play().catch(() => toast.error("تعذر التشغيل"));
    } catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-xs">
          <tr>
            <th className="p-2 text-start">الحدث</th>
            <th className="p-2 text-start">الصوت الحالي</th>
            <th className="p-2 w-64">استبدال</th>
            <th className="p-2 w-32">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {SFX_SLOTS.map((s) => {
            const active = items.find((it) => {
              const r = it as { slot: string; is_active: boolean };
              return r.slot === s.slot && r.is_active;
            }) as { id: string; title_ar: string; file_path: string } | undefined;
            return (
              <tr key={s.slot} className="border-t">
                <td className="p-2 font-medium">{s.label}</td>
                <td className="p-2 text-xs text-muted-foreground">{active?.title_ar ?? "— لا يوجد —"}</td>
                <td className="p-2">
                  <input type="file" accept="audio/*" onChange={(e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    void replaceSlot(s.slot, f, s.label);
                    e.target.value = "";
                  }} className="text-xs" />
                </td>
                <td className="p-2">
                  <div className="flex justify-center gap-1">
                    {active && (
                      <>
                        <button onClick={() => preview(active.file_path)} className="rounded border p-1.5 hover:bg-secondary" title="معاينة">
                          <Play className="size-3.5" />
                        </button>
                        <button onClick={async () => {
                          if (!confirm("حذف نهائي؟")) return;
                          await deleteFn({ data: { id: active.id } });
                          qc.invalidateQueries({ queryKey: ["admin-audio"] });
                          qc.invalidateQueries({ queryKey: ["audio-bootstrap"] });
                        }} className="rounded border p-1.5 text-destructive hover:bg-destructive/10" title="حذف">
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SettingsTab({ flags }: { flags: Array<{ key: string; enabled: boolean; description?: string | null }> }) {
  const updateFn = useServerFn(updateFlag);
  const qc = useQueryClient();
  const audioFlags = flags.filter((f) => ["music_player_enabled", "ui_sfx_enabled", "music_source_promo_video"].includes(f.key));

  async function toggle(key: string, enabled: boolean) {
    try {
      await updateFn({ data: { key, enabled } });
      toast.success("تم التحديث");
      qc.invalidateQueries({ queryKey: ["admin-flags"] });
      qc.invalidateQueries({ queryKey: ["audio-bootstrap"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
  }

  const labels: Record<string, string> = {
    music_player_enabled: "تفعيل مشغّل الموسيقى العائم",
    ui_sfx_enabled: "تفعيل أصوات الواجهة",
    music_source_promo_video: "استخدام صوت فيديو الترويسة بدلاً من مكتبة الموسيقى",
  };

  return (
    <div className="space-y-3">
      {audioFlags.map((f) => (
        <label key={f.key} className="flex items-start gap-3 rounded-xl border bg-card p-4 cursor-pointer">
          <input type="checkbox" checked={f.enabled} onChange={(e) => toggle(f.key, e.target.checked)} className="mt-1" />
          <div className="flex-1">
            <div className="font-medium flex items-center gap-2"><Volume2 className="size-4" /> {labels[f.key]}</div>
            {f.description && <div className="text-xs text-muted-foreground mt-0.5">{f.description}</div>}
          </div>
        </label>
      ))}
    </div>
  );
}
