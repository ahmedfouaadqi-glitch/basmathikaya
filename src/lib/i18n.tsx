import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

type Dict = Record<string, { ar: string; en: string }>;

const D: Dict = {
  brand: { ar: "بصمة حكاية", en: "Basma Hekaya" },
  tagline: { ar: "حكايتك أنت، لا تشبه أحداً", en: "Your one-of-a-kind story" },
  nav_create: { ar: "ابدأ حكايتك", en: "Start your story" },
  nav_admin: { ar: "الإدارة", en: "Admin" },
  cta_start: { ar: "اصنع حكايتي الآن", en: "Create my story now" },
  hero_lead: {
    ar: "ارفع صورتك، اختر جوّك، واحصل على حكاية مرسومة بملامحك. كل حكاية فريدة، كبصمتك تماماً.",
    en: "Upload your photo, pick a vibe, get a story drawn with your features. As unique as your fingerprint.",
  },
  feat_1_t: { ar: "ملامحك في القصة", en: "Your face in the story" },
  feat_1_d: { ar: "غلاف ومشاهد تستوحي شكلك الحقيقي", en: "Cover & scenes drawn from your real photo" },
  feat_2_t: { ar: "نص يشبهك", en: "A tale that fits you" },
  feat_2_d: { ar: "حكاية مصممة لاسمك وعمرك ومزاجك", en: "Story tuned to your name, age & mood" },
  feat_3_t: { ar: "تسليم سريع", en: "Quick delivery" },
  feat_3_d: { ar: "PDF فوري أو نسخة مطبوعة للباب", en: "Instant PDF or printed to your door" },
  form_title: { ar: "ابدأ حكايتك", en: "Start your story" },
  form_subtitle: { ar: "ثلاث خطوات بسيطة، والباقي علينا", en: "Three simple steps, we handle the rest" },
  field_name: { ar: "اسم البطل", en: "Hero's name" },
  field_age: { ar: "العمر", en: "Age" },
  field_phone: { ar: "رقم الواتساب", en: "WhatsApp number" },
  field_phone_hint: { ar: "نحتاجه لإكمال الطلب", en: "We need it to complete the order" },
  field_mood: { ar: "جو الحكاية", en: "Story vibe" },
  field_image: { ar: "صورة البطل", en: "Hero's photo" },
  field_image_hint: { ar: "صورة واضحة للوجه، JPG أو PNG", en: "A clear face photo, JPG or PNG" },
  submit_create: { ar: "اصنع المعاينة", en: "Create preview" },
  mood_adventure: { ar: "مغامرة", en: "Adventure" },
  mood_fantasy: { ar: "خيال", en: "Fantasy" },
  mood_space: { ar: "فضاء", en: "Space" },
  mood_history: { ar: "تاريخ", en: "History" },
  mood_comedy: { ar: "كوميديا", en: "Comedy" },
  mood_mystery: { ar: "غموض", en: "Mystery" },
  preview_loading: { ar: "نحوك حكايتك… ثوانٍ من فضلك", en: "Weaving your story… a few seconds" },
  preview_done: { ar: "ها هي معاينة حكايتك", en: "Here's a peek of your story" },
  preview_first_para: { ar: "الفقرة الأولى", en: "First paragraph" },
  choose_tier: { ar: "اختر طريقة استلامك", en: "Pick your delivery" },
  tier_pdf: { ar: "PDF فوري", en: "Instant PDF" },
  tier_printed: { ar: "نسخة مطبوعة", en: "Printed copy" },
  tier_video: { ar: "فيديو فاخر", en: "Premium video" },
  tier_pdf_d: { ar: "قصة كاملة جاهزة للقراءة فوراً", en: "Full story, ready to read instantly" },
  tier_printed_d: { ar: "كتاب مطبوع يصل إلى بابك", en: "Printed book delivered to your door" },
  tier_video_d: { ar: "فيديو مع تحريك الشفاه — قريباً", en: "Video with lip-sync — coming soon" },
  confirm_whatsapp: { ar: "تأكيد الطلب عبر واتساب", en: "Confirm via WhatsApp" },
  iqd: { ar: "د.ع", en: "IQD" },
  admin_login_title: { ar: "دخول الإدارة", en: "Admin login" },
  admin_phone: { ar: "رقم الهاتف", en: "Phone number" },
  admin_code: { ar: "رمز الدخول", en: "Access code" },
  admin_login_btn: { ar: "دخول", en: "Enter" },
  admin_login_err: { ar: "بيانات غير صحيحة", en: "Invalid credentials" },
  admin_orders: { ar: "الطلبات", en: "Orders" },
  admin_analytics: { ar: "الإحصائيات", en: "Analytics" },
  admin_settings: { ar: "الإعدادات", en: "Settings" },
  admin_logout: { ar: "خروج", en: "Logout" },
  status_pending: { ar: "بانتظار الدفع", en: "Pending" },
  status_paid: { ar: "مدفوع", en: "Paid" },
  status_delivered: { ar: "مُسلَّم", en: "Delivered" },
  status_cancelled: { ar: "ملغى", en: "Cancelled" },
  col_order: { ar: "الطلب", en: "Order" },
  col_customer: { ar: "العميل", en: "Customer" },
  col_tier: { ar: "الباقة", en: "Tier" },
  col_status: { ar: "الحالة", en: "Status" },
  col_revenue: { ar: "الإيراد", en: "Revenue" },
  col_cost: { ar: "التكلفة", en: "Cost" },
  col_profit: { ar: "الربح", en: "Profit" },
  col_margin: { ar: "الهامش", en: "Margin" },
  col_actions: { ar: "إجراءات", en: "Actions" },
  mark_paid: { ar: "تأكيد الدفع", en: "Mark paid" },
  mark_delivered: { ar: "تأكيد التسليم", en: "Mark delivered" },
  view: { ar: "عرض", en: "View" },
  cost_events: { ar: "سجل التكاليف", en: "Cost events" },
  total_revenue: { ar: "إجمالي الإيراد", en: "Total revenue" },
  total_cost: { ar: "إجمالي التكلفة", en: "Total cost" },
  total_profit: { ar: "إجمالي الربح", en: "Total profit" },
  total_orders: { ar: "عدد الطلبات", en: "Orders" },
  settings_pricing: { ar: "إعدادات الأسعار", en: "Pricing settings" },
  save: { ar: "حفظ", en: "Save" },
  saved: { ar: "تم الحفظ", en: "Saved" },
  back_home: { ar: "العودة للرئيسية", en: "Back home" },
  no_orders: { ar: "لا توجد طلبات بعد", en: "No orders yet" },
  generating_cover: { ar: "جاري رسم الغلاف…", en: "Drawing the cover…" },
  cover_failed: { ar: "تعذّر توليد الغلاف، حاول مجدداً", en: "Couldn't generate the cover" },
  whatsapp_msg_open: { ar: "ستُفتح محادثة واتساب جاهزة", en: "A WhatsApp chat will open" },
  field_pages: { ar: "عدد صفحات القصة", en: "Number of pages" },
  field_pages_hint: { ar: "كلما زادت الصفحات، زادت تفاصيل القصة والتكلفة", en: "More pages = richer story & higher price" },
  pages_label: { ar: "صفحات", en: "pages" },
  estimated_price: { ar: "السعر التقديري", en: "Estimated price" },
  story_pages: { ar: "صفحات القصة", en: "Story pages" },
  page_n: { ar: "صفحة", en: "Page" },
  download_pdf: { ar: "تحميل القصة PDF", en: "Download PDF" },
  regenerate_image: { ar: "إعادة توليد الصورة", en: "Regenerate image" },
  building_pdf: { ar: "جاري تجهيز ملف القصة…", en: "Preparing your PDF…" },
  story_progress: { ar: "جاري رسم القصة", en: "Drawing your story" },
  pages_ready: { ar: "صفحة جاهزة", en: "pages ready" },
  preview_blurb: { ar: "هذه معاينة مصغّرة — القصة الكاملة ستصلك PDF بعد إتمام الطلب.", en: "This is a teaser preview — the full story arrives as a PDF after you confirm your order." },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: keyof typeof D) => string;
};

const LangContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && (localStorage.getItem("basma-lang") as Lang)) || "ar";
    setLangState(saved);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  function setLang(l: Lang) {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("basma-lang", l);
  }

  function t(k: keyof typeof D) {
    return (D[k] && D[k][lang]) || String(k);
  }

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useT() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useT must be inside LanguageProvider");
  return ctx;
}
