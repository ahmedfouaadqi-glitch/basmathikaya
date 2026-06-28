import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Plus, UserCircle } from "lucide-react";
import { useT } from "../lib/i18n";
import { createOrderDraft, getPublicPricing } from "../lib/orders.functions";
import { getCurrentUser } from "../lib/auth.functions";
import { computeTierAmount, DEFAULT_PRICING, MAX_PAGES, MIN_PAGES, MAX_CHARACTERS } from "../lib/pricing";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "ابدأ حكايتك — بصمة حكاية" },
      { name: "description", content: "أنشئ قصة فريدة بشخصياتك وأجوائك المفضلة." },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const me = await getCurrentUser();
    if (!me) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { me };
  },
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

const ROLES = ["protagonist", "friend", "family", "pet", "other"] as const;
type Role = (typeof ROLES)[number];

type CharacterDraft = {
  name: string;
  age: string;
  role: Role;
  description: string;
};

function CreatePage() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const { me } = Route.useRouteContext();
  const create = useServerFn(createOrderDraft);
  const pricingFn = useServerFn(getPublicPricing);
  const pricingQ = useQuery({ queryKey: ["pricing-public"], queryFn: () => pricingFn(), staleTime: 60_000 });

  const [characters, setCharacters] = useState<CharacterDraft[]>([
    { name: me?.name ?? "", age: "", role: "protagonist", description: "" },
  ]);
  const [moods, setMoods] = useState<string[]>(["adventure"]);
  const [instructions, setInstructions] = useState("");
  const [pages, setPages] = useState<number>(5);
  const [submitting, setSubmitting] = useState(false);

  const pricing = pricingQ.data ?? DEFAULT_PRICING;
  const maxChars = Number(pricingQ.data?.max_characters ?? MAX_CHARACTERS);

  const estimates = useMemo(() => ({
    pdf: computeTierAmount("pdf", pages, pricing, characters.length),
    printed: computeTierAmount("printed", pages, pricing, characters.length),
    video: computeTierAmount("video", pages, pricing, characters.length),
  }), [pages, pricing, characters.length]);

  function updateChar(i: number, patch: Partial<CharacterDraft>) {
    setCharacters((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addChar() {
    if (characters.length >= maxChars) {
      toast.error(`الحد الأقصى ${maxChars} شخصيات`);
      return;
    }
    setCharacters((cs) => [...cs, { name: "", age: "", role: "friend", description: "" }]);
  }
  function removeChar(i: number) {
    if (i === 0) return;
    setCharacters((cs) => cs.filter((_, idx) => idx !== i));
  }

  function toggleMood(value: string) {
    setMoods((cur) => {
      if (cur.includes(value)) {
        return cur.length === 1 ? cur : cur.filter((m) => m !== value);
      }
      if (cur.length >= 3) {
        toast.error("الحد الأقصى 3 أجواء");
        return cur;
      }
      return [...cur, value];
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!characters[0].name.trim()) return toast.error("اكتب اسم البطل الرئيسي");
    if (moods.length === 0) return toast.error("اختر جواً واحداً على الأقل");
    setSubmitting(true);
    try {
      const res = await create({
        data: {
          characters: characters.map((c) => ({
            name: c.name.trim(),
            age: c.age ? Number(c.age) : null,
            role: c.role,
            description: c.description.trim(),
          })),
          moods,
          custom_instructions: instructions.trim(),
          language: lang,
          page_count: pages,
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

      <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
        {/* Characters */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label className="block text-sm font-bold">{t("characters_title")}</label>
            <span className="text-xs text-muted-foreground">{characters.length} / {maxChars}</span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">{t("characters_hint")}</p>

          <div className="space-y-3">
            {characters.map((c, i) => (
              <div key={i} className="rounded-xl border bg-background/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                    <UserCircle className="size-4" />
                    {i === 0 ? t("character_main") : `${t("character_n")} ${i + 1}`}
                  </div>
                  {i > 0 && (
                    <button type="button" onClick={() => removeChar(i)} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline">
                      <Trash2 className="size-3" /> {t("remove_character")}
                    </button>
                  )}
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <input
                      placeholder={t("character_name")}
                      value={c.name}
                      onChange={(e) => updateChar(i, { name: e.target.value })}
                      maxLength={60}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                      required={i === 0}
                    />
                  </div>
                  <input
                    placeholder={t("character_age")}
                    type="number"
                    min={1}
                    max={120}
                    value={c.age}
                    onChange={(e) => updateChar(i, { age: e.target.value })}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                {i > 0 && (
                  <select
                    value={c.role}
                    onChange={(e) => updateChar(i, { role: e.target.value as Role })}
                    className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{t(`role_${r}` as never)}</option>
                    ))}
                  </select>
                )}
                <textarea
                  placeholder={t("character_description_ph")}
                  value={c.description}
                  onChange={(e) => updateChar(i, { description: e.target.value })}
                  maxLength={300}
                  rows={2}
                  className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            ))}
          </div>

          {characters.length < maxChars && (
            <button
              type="button"
              onClick={addChar}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 py-2.5 text-sm font-medium text-primary hover:bg-primary/10"
            >
              <Plus className="size-4" /> {t("add_character")}
            </button>
          )}
        </div>

        {/* Moods */}
        <div>
          <label className="mb-2 block text-sm font-bold">{t("field_mood")}</label>
          <div className="grid grid-cols-3 gap-2">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => toggleMood(m.value)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-sm transition ${
                  moods.includes(m.value)
                    ? "border-primary bg-primary/10 font-semibold"
                    : "hover:bg-secondary"
                }`}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span>{t(m.key as never)}</span>
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("field_mood_limit")}</p>
        </div>

        {/* Custom instructions */}
        <div>
          <label className="mb-2 block text-sm font-bold">{t("field_instructions")}</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={t("field_instructions_placeholder")}
            maxLength={500}
            rows={3}
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="mt-1 text-end text-xs text-muted-foreground">{instructions.length}/500</div>
        </div>

        {/* Pages */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className="block text-sm font-bold">{t("field_pages")}</label>
            <span className="text-lg font-extrabold text-primary">{pages} <span className="text-xs font-medium text-muted-foreground">{t("pages_label")}</span></span>
          </div>
          <input
            type="range"
            min={MIN_PAGES}
            max={MAX_PAGES}
            step={1}
            value={pages}
            onChange={(e) => setPages(Number(e.target.value))}
            className="w-full accent-[color:var(--color-primary)]"
          />
          <p className="mt-1 text-xs text-muted-foreground">{t("field_pages_hint")}</p>

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border bg-secondary/30 p-2 text-center text-xs">
            <div>
              <div className="text-muted-foreground">{t("tier_pdf")}</div>
              <div className="font-bold text-primary">{estimates.pdf.toLocaleString()} {t("iqd")}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t("tier_printed")}</div>
              <div className="font-bold text-primary">{estimates.printed.toLocaleString()} {t("iqd")}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t("tier_video")}</div>
              <div className="font-bold text-primary">{estimates.video.toLocaleString()} {t("iqd")}</div>
            </div>
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
