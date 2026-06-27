import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { useT } from "../lib/i18n";
import { createOrderDraft } from "../lib/orders.functions";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "ابدأ حكايتك — بصمة حكاية" },
      { name: "description", content: "ارفع صورتك واختر جوّ القصة لإنشاء حكاية مخصصة بملامحك." },
    ],
  }),
  component: CreatePage,
});

const MOODS = [
  { value: "adventure", key: "mood_adventure", emoji: "🗺️" },
  { value: "fantasy", key: "mood_fantasy", emoji: "🧚" },
  { value: "space", key: "mood_space", emoji: "🚀" },
  { value: "history", key: "mood_history", emoji: "🏛️" },
  { value: "comedy", key: "mood_comedy", emoji: "😄" },
  { value: "mystery", key: "mood_mystery", emoji: "🔎" },
] as const;

async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function CreatePage() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const create = useServerFn(createOrderDraft);
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [phone, setPhone] = useState("");
  const [mood, setMood] = useState<string>("adventure");
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [imgDataUrl, setImgDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(file: File | null) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("الصورة كبيرة جداً (الحد 8MB)");
      return;
    }
    const url = await fileToDataURL(file);
    setImgDataUrl(url);
    setImgPreview(url);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imgDataUrl) return toast.error(t("field_image"));
    if (!name.trim() || !phone.trim() || !age) return toast.error("املأ كل الحقول");
    setSubmitting(true);
    try {
      const res = await create({
        data: {
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          age: Number(age),
          mood,
          language: lang,
          image_data_url: imgDataUrl,
        },
      });
      navigate({ to: "/preview/$orderId", params: { orderId: res.orderId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-extrabold">{t("form_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("form_subtitle")}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
        {/* Image */}
        <div>
          <label className="block text-sm font-medium mb-2">{t("field_image")}</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
          {imgPreview ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative block w-full overflow-hidden rounded-xl border"
            >
              <img src={imgPreview} alt="" className="aspect-square w-full max-w-xs mx-auto object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                <span className="text-white font-medium">تغيير الصورة</span>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/40 px-4 py-10 text-muted-foreground hover:bg-secondary"
            >
              <Upload className="size-7 text-primary" />
              <span className="font-medium text-foreground">اضغط لرفع الصورة</span>
              <span className="text-xs">{t("field_image_hint")}</span>
            </button>
          )}
        </div>

        {/* Name + Age */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-2">{t("field_name")}</label>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">{t("field_age")}</label>
            <input
              type="number"
              min={1}
              max={120}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary"
              value={age}
              onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")}
              required
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium mb-2">{t("field_phone")}</label>
          <input
            type="tel"
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07XXXXXXXXX"
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">{t("field_phone_hint")}</p>
        </div>

        {/* Mood */}
        <div>
          <label className="block text-sm font-medium mb-2">{t("field_mood")}</label>
          <div className="grid grid-cols-3 gap-2">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(m.value)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-sm transition ${
                  mood === m.value
                    ? "border-primary bg-primary/10 font-semibold"
                    : "hover:bg-secondary"
                }`}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span>{t(m.key as never)}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-3.5 text-base font-bold text-primary-foreground shadow-warm disabled:opacity-60"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {t("submit_create")}
        </button>
      </form>
    </div>
  );
}
