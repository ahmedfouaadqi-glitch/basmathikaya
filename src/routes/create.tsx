import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Plus, UserCircle, Camera, X, CheckCircle2, XCircle, Eye } from "lucide-react";
import { useT } from "../lib/i18n";
import { createOrderDraft, getPublicPricing, validateCoupon, getOrderPrefill } from "../lib/orders.functions";
import { listPublicArtStyles, type ArtStyle } from "../lib/art-styles.functions";
import { uploadCharacterPhoto } from "../lib/uploads.functions";
import { getCurrentUser } from "../lib/auth.functions";
import { computeTierAmount, DEFAULT_PRICING, MAX_PAGES, MIN_PAGES, MAX_CHARACTERS } from "../lib/pricing";
import { buildSampleStory } from "../lib/sample-story";
import { listPublicPreviewTemplates, type PreviewTemplate } from "../lib/preview-templates.functions";
import { getSiteCopy } from "../lib/site-copy.functions";
import { SiteMarkdown } from "../components/SiteMarkdown";
import { z } from "zod";


export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "ابدأ حكايتك — بصمة حكاية" },
      { name: "description", content: "أنشئ قصة فريدة بشخصياتك وأجوائك المفضلة." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) =>
    z.object({ from: z.string().uuid().optional() }).parse(search),
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
  photoPath: string | null;
  photoPreview: string | null;
  uploading: boolean;
};

function newDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(file);
  });
}

function CreatePage() {
  const { t, lang, setLang } = useT();
  const navigate = useNavigate();
  const { me } = Route.useRouteContext();
  const search = Route.useSearch();
  const create = useServerFn(createOrderDraft);
  const uploadPhoto = useServerFn(uploadCharacterPhoto);
  const pricingFn = useServerFn(getPublicPricing);
  const validateCouponFn = useServerFn(validateCoupon);
  const prefillFn = useServerFn(getOrderPrefill);
  const pricingQ = useQuery({ queryKey: ["pricing-public"], queryFn: () => pricingFn(), staleTime: 60_000 });
  const [samplePreviewOpen, setSamplePreviewOpen] = useState(false);

  const draftIdRef = useRef<string>(newDraftId());

  const [characters, setCharacters] = useState<CharacterDraft[]>([
    { name: me?.name ?? "", age: "", role: "protagonist", description: "", photoPath: null, photoPreview: null, uploading: false },
  ]);
  const [moods, setMoods] = useState<string[]>(["adventure"]);
  const [instructions, setInstructions] = useState("");
  const [pages, setPages] = useState<number>(5);
  const [qualityTier, setQualityTier] = useState<"standard" | "premium">("standard");
  const [tier, setTier] = useState<"pdf" | "printed" | "video">("pdf");
  const [pdfOrientation, setPdfOrientation] = useState<"portrait" | "landscape">("portrait");
  const [artStyleCategory, setArtStyleCategory] = useState<"realistic" | "cartoon" | null>(null);
  const [artStyleSlug, setArtStyleSlug] = useState<string | null>(null);
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponState, setCouponState] = useState<
    { status: "idle" } | { status: "checking" } | { status: "valid"; label: string } | { status: "invalid"; reason: string }
  >({ status: "idle" });

  const artStylesFn = useServerFn(listPublicArtStyles);
  const artStylesQ = useQuery({ queryKey: ["art-styles-public"], queryFn: () => artStylesFn(), staleTime: 5 * 60_000 });
  const artStyles = (artStylesQ.data ?? []) as ArtStyle[];
  const cartoonStyles = artStyles.filter((s) => s.category === "cartoon");
  const realisticStyle = artStyles.find((s) => s.category === "realistic") ?? null;

  const siteCopyFn = useServerFn(getSiteCopy);
  const adultNoticeQ = useQuery({
    queryKey: ["site-copy", "create.adult_notice"],
    queryFn: () => siteCopyFn({ data: { key: "create.adult_notice" } }),
    staleTime: 5 * 60_000,
  });

  const pricing = pricingQ.data ?? DEFAULT_PRICING;
  const maxChars = Number(pricingQ.data?.max_characters ?? MAX_CHARACTERS);
  const videoEnabled = Boolean((pricingQ.data as { video_tier_enabled?: boolean } | undefined)?.video_tier_enabled ?? false);

  const estimates = useMemo(() => ({
    pdf: computeTierAmount("pdf", pages, pricing, characters.length, qualityTier, moods.length),
    printed: computeTierAmount("printed", pages, pricing, characters.length, qualityTier, moods.length),
    video: computeTierAmount("video", pages, pricing, characters.length, qualityTier, moods.length),
  }), [pages, pricing, characters.length, qualityTier, moods.length]);

  const gross = estimates[tier];
  const discount = useMemo(() => {
    if (couponState.status !== "valid") return 0;
    const m = couponState.label.match(/^(percent|fixed):(\d+(?:\.\d+)?)$/);
    if (!m) return 0;
    const val = Number(m[2]);
    const d = m[1] === "percent" ? Math.round((gross * val) / 100) : Math.round(val);
    return Math.max(0, Math.min(d, gross));
  }, [couponState, gross]);
  const finalAmount = Math.max(0, gross - discount);

  // Live coupon validation (debounced).
  useEffect(() => {
    const code = couponCode.trim();
    if (!code) { setCouponState({ status: "idle" }); return; }
    let cancelled = false;
    setCouponState({ status: "checking" });
    const id = window.setTimeout(async () => {
      try {
        const r = await validateCouponFn({ data: { code, pageCount: pages, quality: qualityTier, tier } });
        if (cancelled) return;
        if (r.ok) setCouponState({ status: "valid", label: `${r.discount_type}:${r.discount_value}` });
        else setCouponState({ status: "invalid", reason: (r as { reason?: string }).reason ?? "غير صالح" });
      } catch { if (!cancelled) setCouponState({ status: "invalid", reason: "خطأ" }); }
    }, 500);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [couponCode, pages, qualityTier, tier, validateCouponFn]);

  // Prefill the form from an existing order (?from=<orderId>) — "recreate with new options".
  const fromOrderId = search.from;
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!fromOrderId || prefilledRef.current) return;
    prefilledRef.current = true;
    (async () => {
      try {
        const p = await prefillFn({ data: { orderId: fromOrderId } });
        if (p.characters.length > 0) {
          setCharacters(
            p.characters.map((c) => ({
              name: c.name,
              age: c.age != null ? String(c.age) : "",
              role: c.role,
              description: c.description,
              photoPath: c.photo_path,
              photoPreview: null,
              uploading: false,
            })),
          );
        }
        setMoods(p.moods.length ? p.moods : ["adventure"]);
        setInstructions(p.custom_instructions);
        setPages(p.page_count);
        setQualityTier(p.image_quality_tier);
        setTier(p.tier);
        setPdfOrientation(p.pdf_orientation);
        setLang(p.language);
        toast.success("تم تعبئة النموذج من قصتك السابقة — عدّل ما تشاء ثم أرسل الطلب");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّرت التعبئة");
      }
    })();
  }, [fromOrderId, prefillFn, setLang]);




  function updateChar(i: number, patch: Partial<CharacterDraft>) {
    setCharacters((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addChar() {
    if (characters.length >= maxChars) {
      toast.error(`الحد الأقصى ${maxChars} شخصيات`);
      return;
    }
    setCharacters((cs) => [...cs, { name: "", age: "", role: "friend", description: "", photoPath: null, photoPreview: null, uploading: false }]);
  }
  function removeChar(i: number) {
    if (i === 0) return;
    setCharacters((cs) => cs.filter((_, idx) => idx !== i));
  }

  async function onPickPhoto(i: number, file: File | null) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("حجم الصورة كبير جداً (الحد 4MB)");
      return;
    }
    updateChar(i, { uploading: true });
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await uploadPhoto({ data: { draftId: draftIdRef.current, characterIndex: i, dataUrl } });
      updateChar(i, { photoPath: res.path, photoPreview: res.previewUrl ?? dataUrl, uploading: false });
    } catch (e) {
      updateChar(i, { uploading: false });
      toast.error(e instanceof Error ? e.message : "فشل رفع الصورة");
    }
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

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!characters[0].name.trim()) return toast.error("اكتب اسم البطل الرئيسي");
    if (moods.length === 0) return toast.error("اختر جواً واحداً على الأقل");
    if (artStyles.length > 0 && !artStyleCategory) return toast.error("اختر أسلوب الرسم");
    if (artStyles.length > 0 && artStyleCategory === "cartoon" && !artStyleSlug) return toast.error("اختر نمط الرسم الكرتوني");
    if (!acceptedDisclaimer) return toast.error("يرجى الموافقة على إخلاء المسؤولية للمتابعة");
    setConfirmOpen(true);
  }

  async function doCreate() {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Resolve slug: if realistic, use the single realistic style's slug.
      const finalSlug = artStyleCategory === "realistic"
        ? (realisticStyle?.slug ?? null)
        : artStyleSlug;
      const res = await create({
        data: {
          characters: characters.map((c) => ({
            name: c.name.trim(),
            age: c.age ? Number(c.age) : null,
            role: c.role,
            description: c.description.trim(),
            photo_path: c.photoPath,
          })),
          moods,
          custom_instructions: instructions.trim(),
          language: lang,
          page_count: pages,
          image_quality_tier: qualityTier,
          tier,
          pdf_orientation: pdfOrientation,
          art_style_category: artStyleCategory,
          art_style_slug: finalSlug,
          draft_id: draftIdRef.current,
          disclaimer_accepted: true,
          coupon_code: couponCode.trim() || undefined,
        },
      });
      setConfirmOpen(false);
      // Open WhatsApp with the full order details, then send the user to /my-orders.
      if (res.whatsapp_url) window.open(res.whatsapp_url, "_blank");
      toast.success("تم إنشاء الطلب. يرجى إكمال الدفع عبر واتساب.");
      navigate({ to: "/my-orders" });
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

                <div className="flex gap-3">
                  {/* Photo uploader */}
                  <label className="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 text-primary hover:bg-primary/10">
                    {c.photoPreview ? (
                      <>
                        <img src={c.photoPreview} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            updateChar(i, { photoPath: null, photoPreview: null });
                          }}
                          className="absolute top-1 end-1 z-10 grid size-5 place-items-center rounded-full bg-background/90 text-destructive shadow"
                          aria-label={t("remove_photo")}
                        >
                          <X className="size-3" />
                        </button>
                      </>
                    ) : c.uploading ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <div className="flex flex-col items-center gap-0.5 text-[10px] font-medium">
                        <Camera className="size-5" />
                        <span>{t("upload_photo")}</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 z-0 cursor-pointer opacity-0"
                      onChange={(e) => onPickPhoto(i, e.target.files?.[0] ?? null)}
                    />
                  </label>

                  <div className="flex-1 space-y-2">
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
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{t(`role_${r}` as never)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

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

        {/* Art style — realistic vs cartoon (+ cartoon substyle) */}
        {artStyles.length > 0 && (
          <div>
            <label className="mb-2 block text-sm font-bold">أسلوب الرسم</label>
            <p className="mb-2 text-[11px] text-muted-foreground">
              كيف تريد أن تظهر شخصية الطفل في القصة؟ يُطبَّق نفس الأسلوب على كل الصفحات.
            </p>
            <div className="grid grid-cols-2 gap-2 text-center text-sm">
              {([
                { v: "realistic" as const, label: "واقعي", hint: "صور واقعية" },
                { v: "cartoon" as const, label: "كرتوني", hint: "رسوم كرتونية" },
              ]).map((o) => (
                <button
                  type="button"
                  key={o.v}
                  onClick={() => {
                    setArtStyleCategory(o.v);
                    if (o.v === "realistic") setArtStyleSlug(realisticStyle?.slug ?? null);
                    else setArtStyleSlug(null);
                  }}
                  aria-pressed={artStyleCategory === o.v}
                  className={`rounded-xl border p-3 transition ${
                    artStyleCategory === o.v ? "border-primary bg-primary/10 font-bold" : "border-muted bg-secondary/30"
                  }`}
                >
                  <div>{o.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{o.hint}</div>
                </button>
              ))}
            </div>

            {artStyleCategory === "cartoon" && cartoonStyles.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold text-primary">اختر نمط الرسم:</p>
                <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                  {cartoonStyles.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setArtStyleSlug(s.slug)}
                      aria-pressed={artStyleSlug === s.slug}
                      className={`rounded-xl border p-2.5 transition ${
                        artStyleSlug === s.slug ? "border-primary bg-primary/10 font-bold" : "border-muted bg-secondary/30 hover:bg-secondary"
                      }`}
                    >
                      {s.name_ar}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
          {characters[0]?.age && Number(characters[0].age) >= 18 && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              <strong>حرية إبداعية للبالغين:</strong> اكتب بأيّ أسلوب أو مستوى صراحة تريده (رومانسي، حسّي،
              جنسي، تحرري، تأمل، شفاء…) بالفصحى أو باللهجة العامية. المحتوى للبالغين يمرّ بمراجعة إدارية
              سريعة قبل التوليد. الخطوط الحمراء الوحيدة: لا عنف/تعذيب/دم صريح، لا محتوى سياسي، ولا محتوى
              يشمل قاصرين تحت أيّ ظرف.{" "}
              <a href="/content-policy" target="_blank" className="underline">اقرأ السياسة</a>
            </div>
          )}
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
            {(["pdf", "printed", "video"] as const).map((tv) => {
              const disabled = tv === "video" && !videoEnabled;
              const active = tier === tv;
              return (
                <button
                  key={tv}
                  type="button"
                  onClick={() => !disabled && setTier(tv)}
                  disabled={disabled}
                  className={`rounded-lg p-2 transition text-start ${active ? "border-2 border-primary bg-primary/10 font-bold" : "border border-transparent"} ${disabled ? "cursor-not-allowed" : ""}`}
                  aria-pressed={active}
                >
                  <div className="text-muted-foreground text-center">{t(`tier_${tv}` as never)}</div>
                  <div className="font-bold text-primary text-center">{estimates[tv].toLocaleString()} {t("iqd")}</div>
                  {disabled && <div className="mt-1 text-[10px] text-amber-600 dark:text-amber-400 text-center">قريباً</div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quality tier — affects both text richness and image fidelity across the whole story */}
        <div>
          <label className="block text-sm font-bold mb-2">الجودة</label>
          <p className="mb-2 text-[11px] text-muted-foreground">
            الجودة الاحترافية تضاعف تفاصيل النص والصور لكل صفحة وكل شخصية — والتكلفة تُحسب بنفس المضاعِف.
          </p>
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            {([
              { v: "standard", label: "قياسي", hint: "جودة جيدة للاستخدام اليومي" },
              { v: "premium", label: "احترافي", hint: "أعلى تفاصيل بالنص والصور" },
            ] as const).map((o) => (
              <button
                type="button"
                key={o.v}
                onClick={() => setQualityTier(o.v)}
                className={`rounded-xl border p-2 transition ${qualityTier === o.v ? "border-primary bg-primary/10 font-bold" : "border-muted bg-secondary/30"}`}
              >
                <div>{o.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{o.hint}</div>
              </button>
            ))}
          </div>
        </div>


        {/* PDF orientation — no price difference */}
        <div>
          <label className="block text-sm font-bold mb-2">اتجاه ملف القصة</label>
          <p className="mb-2 text-[11px] text-muted-foreground">
            اختر شكل الصفحات في ملف PDF — بدون فرق في السعر.
          </p>
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            {([
              { v: "portrait", label: "عمودي", hint: "الشكل الكلاسيكي — مناسب للطباعة" },
              { v: "landscape", label: "أفقي", hint: "مساحة أوسع للصور — مناسب للعرض" },
            ] as const).map((o) => (
              <button
                type="button"
                key={o.v}
                onClick={() => setPdfOrientation(o.v)}
                aria-pressed={pdfOrientation === o.v}
                className={`rounded-xl border p-3 transition ${pdfOrientation === o.v ? "border-primary bg-primary/10 font-bold" : "border-muted bg-secondary/30"}`}
              >
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`border-2 ${pdfOrientation === o.v ? "border-primary" : "border-muted-foreground/40"} rounded-sm bg-background`}
                    style={o.v === "portrait" ? { width: 22, height: 30 } : { width: 30, height: 22 }}
                  />
                  <div>{o.label}</div>
                  <div className="text-[10px] text-muted-foreground">{o.hint}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Story language — the whole story (title, pages, question) will be written in this language */}
        <div>
          <label className="block text-sm font-bold mb-2">لغة القصة</label>
          <p className="mb-2 text-[11px] text-muted-foreground">
            ستُكتب القصة كاملةً (العنوان، النصوص، السؤال الختامي) باللغة التي تختارها.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {([
              { v: "ar", label: "العربية" },
              { v: "en", label: "English" },
              { v: "ku", label: "کوردی" },
            ] as const).map((o) => (
              <button
                type="button"
                key={o.v}
                onClick={() => setLang(o.v)}
                aria-pressed={lang === o.v}
                className={`rounded-xl border p-3 transition ${lang === o.v ? "border-primary bg-primary/10 font-bold" : "border-muted bg-secondary/30"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>


        <div>
          <label className="mb-2 block text-sm font-bold">{t("coupon_field")}</label>
          <div className="relative">
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="CODE2025"
              maxLength={40}
              className="w-full rounded-lg border bg-background px-3 py-2 pe-9 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 end-2">
              {couponState.status === "checking" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              {couponState.status === "valid" && <CheckCircle2 className="size-5 text-emerald-500" />}
              {couponState.status === "invalid" && <XCircle className="size-5 text-destructive" />}
            </div>
          </div>
          {couponState.status === "valid" && (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
              كوبون فعّال — الخصم: {discount.toLocaleString()} {t("iqd")}
            </p>
          )}
          {couponState.status === "invalid" && (
            <p className="mt-1 text-xs text-destructive">{couponState.reason}</p>
          )}
          <div className="mt-2 rounded-lg border bg-secondary/30 p-2 text-xs flex justify-between">
            <span className="text-muted-foreground">المبلغ النهائي</span>
            <span className="font-bold text-primary">{finalAmount.toLocaleString()} {t("iqd")}</span>
          </div>
        </div>



        {/* Disclaimer acceptance — required before creating */}
        <label className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed">
          <input
            type="checkbox"
            checked={acceptedDisclaimer}
            onChange={(e) => setAcceptedDisclaimer(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span>
            <span className="font-bold text-amber-700 dark:text-amber-400">إخلاء مسؤولية:</span>{" "}
            «بصمة حكاية» أداة ذكاء اصطناعي مخصّصة لهذه الفكرة بدون أي تدخّل بشري. المستخدم هو المسؤول الوحيد عن كل المُدخلات والنتائج،
            بعد تسديد المبالغ لا يتم استرجاعها. تحتفظ الإدارة بحق قبول أو رفض الطلب.
          </span>
        </label>

        {/* Free sample preview — no AI calls, no tokens. Pure client-side template. */}
        <button
          type="button"
          onClick={() => setSamplePreviewOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary/40 bg-primary/5 py-3 text-sm font-bold text-primary hover:bg-primary/10"
        >
          <Eye className="size-4" />
          معاينة نموذج مجاني (بدون أي تكلفة)
        </button>

        <button
          type="submit"
          disabled={submitting || !acceptedDisclaimer || (tier === "video" && !videoEnabled)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-3.5 text-base font-bold text-primary-foreground shadow-warm disabled:opacity-60"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {tier === "video" && !videoEnabled ? "قريباً" : submitting ? t("creating_now") : t("submit_create")}
        </button>
      </form>

      {/* Confirmation dialog — prevents accidental submissions and consumption */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !submitting && setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-extrabold">{t("confirm_title")}</h2>
            <p className="mb-5 text-sm text-muted-foreground leading-relaxed">{t("confirm_body")}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                {t("confirm_back")}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={doCreate}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-warm disabled:opacity-60"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {submitting ? t("creating_now") : t("confirm_yes")}
              </button>
            </div>
          </div>
        </div>
      )}

      {samplePreviewOpen && (
        <SamplePreviewModal
          onClose={() => setSamplePreviewOpen(false)}
          lang={lang}
          heroName={characters[0].name}
          mood={moods[0] ?? ""}
          pageCount={pages}
          orientation={pdfOrientation}
        />
      )}
    </div>
  );
}

function SamplePreviewModal({
  onClose, lang, heroName, mood, pageCount, orientation,
}: {
  onClose: () => void;
  lang: "ar" | "en" | "ku";
  heroName: string;
  mood: string;
  pageCount: number;
  orientation: "portrait" | "landscape";
}) {
  const isRtl = lang !== "en";
  const listFn = useServerFn(listPublicPreviewTemplates);
  const tplQ = useQuery({
    queryKey: ["preview-templates-public", lang, mood],
    queryFn: () => listFn({ data: { language: lang, moods: mood ? [mood] : [], storyType: null } }),
    staleTime: 5 * 60_000,
  });

  const templates = (tplQ.data ?? []) as PreviewTemplate[];
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = templates.find((t) => t.id === pickedId) ?? templates[0] ?? null;
  const usingTemplate = Boolean(picked);

  // Fallback (no admin templates yet): pure client-side sample.
  const fallback = buildSampleStory({ lang, heroName, mood, pageCount });

  const effectiveOrientation = picked?.orientation ?? orientation;
  const pageStyle: React.CSSProperties = effectiveOrientation === "landscape"
    ? { aspectRatio: "4 / 3" }
    : { aspectRatio: "3 / 4" };

  const title = picked?.title
    ? picked.title.replaceAll("{{hero}}", heroName || "").replaceAll("{{mood}}", mood || "")
    : fallback.title;
  const intro = usingTemplate
    ? (lang === "en"
        ? "This is a real sample from our library — your story will be crafted uniquely after payment."
        : lang === "ku"
          ? "ئەمە نموونەیەکی ڕاستەقینەیە لە کتێبخانەکەمان — چیرۆکەکەت بە شێوەیەکی تایبەت دوای پارەدان دروست دەکرێت."
          : "هذا نموذج حقيقي من مكتبتنا — قصتك ستُصنع خصيصاً بعد الدفع.")
    : fallback.intro;
  const reflective = picked?.reflective_question
    ? picked.reflective_question.replaceAll("{{hero}}", heroName || "")
    : fallback.reflectiveQuestion;

  const pages = usingTemplate && picked
    ? picked.pages.slice(0, picked.page_count).map((p, i) => ({
        number: i + 1,
        text: (p.text ?? "").replaceAll("{{hero}}", heroName || "").replaceAll("{{mood}}", mood || ""),
        imageUrl: (picked.page_urls ?? [])[i] ?? null,
      }))
    : fallback.pages.map((p) => ({ number: p.number, text: p.text, imageUrl: null, emoji: p.emoji, gradient: p.gradient }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:p-6"
      dir={isRtl ? "rtl" : "ltr"}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border bg-card p-4 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-primary">{title}</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
              {intro}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-full border hover:bg-secondary"
            aria-label="close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Template picker (only when we have >1) */}
        {templates.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPickedId(t.id)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  (pickedId ?? templates[0].id) === t.id ? "border-primary bg-primary/10 text-primary font-bold" : "hover:bg-secondary"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        {/* Cover */}
        <div
          className="mb-4 overflow-hidden rounded-xl border-4 border-primary"
          style={pageStyle}
        >
          {usingTemplate && picked?.cover_url ? (
            <img src={picked.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-6xl" style={{ background: fallback.cover.gradient }}>
              <span>{fallback.cover.emoji}</span>
            </div>
          )}
        </div>

        {/* Pages */}
        <div className="space-y-4">
          {pages.map((p) => (
            <div key={p.number} className="rounded-xl border bg-background p-3">
              <div className="mb-3 overflow-hidden rounded-lg border-2 border-primary/60" style={pageStyle}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-5xl" style={{ background: (p as { gradient?: string }).gradient ?? "linear-gradient(135deg,#7DD3FC,#818CF8)" }}>
                    <span>{(p as { emoji?: string }).emoji ?? "📖"}</span>
                  </div>
                )}
              </div>
              <div className="text-xs font-bold text-primary mb-1">
                {lang === "en" ? `Page ${p.number}` : lang === "ku" ? `لاپەڕە ${p.number}` : `صفحة ${p.number}`}
              </div>
              <p className="text-sm leading-loose text-foreground">{p.text}</p>
            </div>
          ))}
        </div>

        {/* Reflective question */}
        <div className="mt-4 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 p-4">
          <div className="text-xs font-bold text-primary mb-1">
            {lang === "en" ? "A question for you" : lang === "ku" ? "پرسیارێک بۆ تۆ" : "سؤال لك يا بطل"}
          </div>
          <p className="text-sm font-medium">{reflective}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
        >
          {lang === "en" ? "Close preview" : lang === "ku" ? "داخستنی پێشبینین" : "إغلاق المعاينة"}
        </button>
      </div>
    </div>
  );
}
