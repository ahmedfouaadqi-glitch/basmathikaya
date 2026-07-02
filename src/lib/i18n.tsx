import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

type Dict = Record<string, { ar: string; en: string }>;

const D: Dict = {
  brand: { ar: "بصمة حكاية", en: "Basma Hekaya" },
  tagline: { ar: "حكايتك أنت، لا تشبه أحداً", en: "Your one-of-a-kind story" },
  nav_create: { ar: "ابدأ حكايتك", en: "Start your story" },
  nav_admin: { ar: "الإدارة", en: "Admin" },
  nav_my_orders: { ar: "طلباتي", en: "My orders" },
  nav_login: { ar: "تسجيل الدخول", en: "Sign in" },
  nav_logout: { ar: "خروج", en: "Sign out" },
  cta_start: { ar: "اصنع حكايتي الآن", en: "Create my story now" },
  hero_lead: {
    ar: "اختر شخصياتك، حدد جوّك، أضف لمستك الخاصة، واحصل على حكاية فريدة. كل حكاية كبصمتك.",
    en: "Pick your characters, set the vibe, add your personal touch — get a story unique as your fingerprint.",
  },
  feat_1_t: { ar: "شخصيات متعددة", en: "Many characters" },
  feat_1_d: { ar: "أضف العائلة والأصدقاء في نفس الحكاية", en: "Add family and friends to the same tale" },
  feat_2_t: { ar: "نص يشبهك", en: "A tale that fits you" },
  feat_2_d: { ar: "حكاية مصممة بأجواء واتجاه تختاره أنت", en: "Story tuned to the vibes & direction you choose" },
  feat_3_t: { ar: "تسليم سريع", en: "Quick delivery" },
  feat_3_d: { ar: "PDF فوري بعد الدفع أو نسخة مطبوعة للباب", en: "Instant PDF after payment or printed to your door" },

  // Auth
  auth_title: { ar: "تسجيل دخول", en: "Sign in" },
  auth_subtitle: { ar: "أدخل اسمك ورقم هاتفك، نرسل لك رمز تحقق", en: "Enter your name and phone number; we'll send a code" },
  auth_full_name: { ar: "الاسم الصريح", en: "Full name" },
  auth_phone: { ar: "رقم الواتساب", en: "WhatsApp number" },
  auth_phone_placeholder: { ar: "07XXXXXXXXX", en: "07XXXXXXXXX" },
  auth_send_code: { ar: "إرسال رمز التحقق", en: "Send code" },
  auth_code: { ar: "رمز التحقق (6 أرقام)", en: "Verification code (6 digits)" },
  auth_verify: { ar: "تحقق ودخول", en: "Verify & sign in" },
  auth_resend: { ar: "إعادة إرسال", en: "Resend" },
  auth_change_phone: { ar: "تغيير الرقم", en: "Change number" },
  auth_required: { ar: "سجّل دخولك أولاً لإنشاء حكايتك", en: "Please sign in to create your story" },

  form_title: { ar: "ابدأ حكايتك", en: "Start your story" },
  form_subtitle: { ar: "حدد الشخصيات والأجواء، ودع البقية علينا", en: "Set up characters & vibes, we handle the rest" },
  field_phone_hint: { ar: "نحتاجه لإكمال الطلب", en: "We need it to complete the order" },
  field_mood: { ar: "أجواء الحكاية (يمكن اختيار أكثر من جو)", en: "Story vibes (pick one or more)" },
  field_mood_limit: { ar: "اختر حتى 3 أجواء", en: "Up to 3 vibes" },
  field_instructions: { ar: "تعليمات إضافية للقصة (اختياري)", en: "Additional story notes (optional)" },
  field_instructions_placeholder: {
    ar: "مثال: الأحداث في كركوك، البطل يحب كرة القدم، أضف عبرة عن الصدق…",
    en: "e.g. set it in Baghdad, the hero loves football, add a moral about honesty…",
  },

  // Characters
  characters_title: { ar: "شخصيات القصة", en: "Story characters" },
  characters_hint: { ar: "شخصية رئيسية واحدة + شخصيات إضافية (تزداد التكلفة لكل شخصية)", en: "One main hero + extra characters (price grows per character)" },
  character_n: { ar: "شخصية", en: "Character" },
  character_main: { ar: "البطل الرئيسي", en: "Main hero" },
  character_name: { ar: "الاسم", en: "Name" },
  character_age: { ar: "العمر (اختياري)", en: "Age (optional)" },
  character_role: { ar: "العلاقة بالبطل", en: "Role" },
  character_description: { ar: "وصف بصري (اختياري)", en: "Visual description (optional)" },
  character_description_ph: { ar: "ملابس، شعر، لون البشرة، ميزات…", en: "Clothing, hair, skin, distinctive features…" },
  add_character: { ar: "+ إضافة شخصية", en: "+ Add character" },
  remove_character: { ar: "حذف", en: "Remove" },
  role_protagonist: { ar: "البطل", en: "Protagonist" },
  role_friend: { ar: "صديق", en: "Friend" },
  role_family: { ar: "فرد من العائلة", en: "Family" },
  role_pet: { ar: "حيوان أليف", en: "Pet" },
  role_other: { ar: "أخرى", en: "Other" },

  submit_create: { ar: "اصنع حكايتي", en: "Create my story" },
  confirm_title: { ar: "تأكيد إنشاء الحكاية", en: "Confirm story creation" },
  confirm_body: {
    ar: "سيتم إنشاء قصة مخصصة باستخدام المعلومات والصور التي قمت بإدخالها. هل ترغب بالمتابعة؟",
    en: "We'll create a personalized story from the info and photos you provided. Continue?",
  },
  confirm_yes: { ar: "نعم، اصنع حكايتي", en: "Yes, create my story" },
  confirm_back: { ar: "رجوع للتعديل", en: "Back to edit" },
  creating_now: { ar: "جاري إنشاء الحكاية، يرجى الانتظار...", en: "Creating your story, please wait..." },
  loading_step_write: { ar: "نكتب أحداث القصة…", en: "Writing the story events…" },
  loading_step_design: { ar: "نصمم الشخصيات…", en: "Designing characters…" },
  loading_step_draw: { ar: "نرسم المشاهد…", en: "Sketching scenes…" },
  loading_step_review: { ar: "نراجع الحكاية…", en: "Reviewing the tale…" },
  loading_making_story: { ar: "نقوم الآن بصناعة حكايتك الخاصة...", en: "Now creating your unique story..." },
  coupon_field: { ar: "كود خصم (اختياري)", en: "Discount code (optional)" },
  coupon_apply: { ar: "تطبيق", en: "Apply" },
  coupon_ok: { ar: "تم تطبيق الخصم", en: "Discount applied" },
  coupon_bad: { ar: "الكود غير صالح", en: "Invalid code" },
  mood_pricing_hint: { ar: "الجو الأول مجاني — بعده يُحتسب سعر إضافي لكل جو", en: "First vibe is free — extra vibes are billed" },
  redownload_request: { ar: "طلب إعادة تحميل مدفوع", en: "Request paid re-download" },
  redownload_pending: { ar: "طلبك قيد المراجعة", en: "Your request is under review" },
  redownload_price_hint: { ar: "بعد تأكيد الدفع من الإدارة يظهر لك زر التحميل", en: "The download button appears after admin confirms payment" },
  rejected_notice: { ar: "تم رفض الطلب", en: "Order rejected" },
  admin_coupons: { ar: "الكوبونات", en: "Coupons" },
  admin_reject: { ar: "رفض الطلب", en: "Reject order" },
  admin_reject_reason: { ar: "سبب الرفض (يُرسل للعميل)", en: "Rejection reason (sent to the customer)" },
  admin_delete_order: { ar: "حذف الطلب", en: "Delete order" },
  admin_suspend: { ar: "تعليق", en: "Suspend" },
  admin_ban: { ar: "حظر", en: "Ban" },
  admin_unblock: { ar: "إلغاء", en: "Unblock" },
  admin_delete_user: { ar: "حذف", en: "Delete" },
  admin_confirm_redownload: { ar: "تأكيد دفع إعادة التحميل", en: "Confirm re-download payment" },
  user_status_active: { ar: "نشط", en: "Active" },
  user_status_suspended: { ar: "موقوف", en: "Suspended" },
  user_status_banned: { ar: "محظور", en: "Banned" },

  reject_order: { ar: "رفض الطلب", en: "Reject order" },
  delete_order: { ar: "حذف الطلب", en: "Delete order" },
  reopen_order: { ar: "إعادة فتح الطلب", en: "Reopen order" },
  reject_reason_hint: { ar: "اكتب السبب — سيُرسل للعميل مع إشعار الرفض.", en: "Write the reason — it will be sent to the customer." },
  reject_reason_placeholder: { ar: "مثال: المحتوى لا يتوافق مع الشروط…", en: "e.g. Content violates our terms…" },
  confirm_reject: { ar: "تأكيد الرفض", en: "Confirm rejection" },
  order_rejected: { ar: "تم رفض هذا الطلب", en: "This order was rejected" },
  rejected: { ar: "مرفوض", en: "Rejected" },
  status_rejected: { ar: "مرفوض", en: "Rejected" },
  status_cancelled: { ar: "ملغى", en: "Cancelled" },
  amount_due: { ar: "المبلغ المستحق", en: "Amount due" },
  redownload_request_pending: { ar: "طلب إعادة تحميل قيد الانتظار", en: "Re-download request pending" },
  confirm_redownload_payment: { ar: "تأكيد استلام مبلغ إعادة التحميل", en: "Confirm re-download payment" },
  redownload_awaiting_admin: { ar: "طلب إعادة التحميل قيد المراجعة من الإدارة", en: "Re-download request under admin review" },
  redownload_ready: { ar: "تم تأكيد الدفع — يمكنك التحميل الآن", en: "Payment confirmed — you can download now" },
  request_paid_redownload: { ar: "طلب إعادة تحميل مدفوع", en: "Request paid re-download" },
  confirm_request_redownload: { ar: "هل تريد إرسال طلب إعادة تحميل للإدارة؟", en: "Send a re-download request to admin?" },
  redownload_requested_ok: { ar: "تم إرسال الطلب للإدارة", en: "Request sent to admin" },

  mood_adventure: { ar: "مغامرة", en: "Adventure" },
  mood_fantasy: { ar: "خيال", en: "Fantasy" },
  mood_space: { ar: "فضاء", en: "Space" },
  mood_history: { ar: "تاريخ", en: "History" },
  mood_comedy: { ar: "كوميديا", en: "Comedy" },
  mood_mystery: { ar: "غموض", en: "Mystery" },

  preview_loading: { ar: "نحوك حكايتك… ثوانٍ من فضلك", en: "Weaving your story… a few seconds" },
  preview_done: { ar: "ها هي معاينة حكايتك", en: "Here's a peek of your story" },
  preview_first_para: { ar: "الفقرة الأولى", en: "First paragraph" },
  preview_blurb_no_images: {
    ar: "هذه معاينة نصية فقط. ستُرسم الصور والغلاف بعد تأكيد الدفع من الإدارة.",
    en: "This is a text-only preview. Cover & illustrations are generated after admin confirms payment.",
  },
  awaiting_payment: { ar: "بانتظار تأكيد الدفع", en: "Awaiting payment confirmation" },
  images_generating: { ar: "جاري رسم الغلاف والصفحات…", en: "Drawing the cover & pages…" },
  story_ready: { ar: "تم تأكيد الدفع — قصتك جاهزة!", en: "Payment confirmed — your story is ready!" },

  choose_tier: { ar: "اختر طريقة استلامك", en: "Pick your delivery" },
  tier_pdf: { ar: "PDF فوري", en: "Instant PDF" },
  tier_printed: { ar: "نسخة مطبوعة", en: "Printed copy" },
  tier_video: { ar: "فيديو فاخر", en: "Premium video" },
  tier_pdf_d: { ar: "قصة كاملة بصور وغلاف بعد الدفع", en: "Full illustrated story (post-payment)" },
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
  admin_users: { ar: "العملاء", en: "Customers" },
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
  col_orders_count: { ar: "عدد الطلبات", en: "Orders" },
  col_spent: { ar: "إجمالي الإنفاق", en: "Total spent" },
  col_last_login: { ar: "آخر دخول", en: "Last login" },
  mark_paid: { ar: "تأكيد الدفع", en: "Mark paid" },
  mark_paid_generate: { ar: "تأكيد الدفع وبدء رسم القصة", en: "Confirm payment & generate" },
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
  characters_label: { ar: "شخصيات", en: "characters" },
  estimated_price: { ar: "السعر التقديري", en: "Estimated price" },
  story_pages: { ar: "صفحات القصة", en: "Story pages" },
  page_n: { ar: "صفحة", en: "Page" },
  download_pdf: { ar: "تحميل القصة PDF", en: "Download PDF" },
  regenerate_image: { ar: "إعادة توليد الصورة", en: "Regenerate image" },
  building_pdf: { ar: "جاري تجهيز ملف القصة…", en: "Preparing your PDF…" },

  my_orders: { ar: "طلباتي", en: "My orders" },
  no_my_orders: { ar: "ليس لديك طلبات بعد", en: "You have no orders yet" },
  export_csv: { ar: "تصدير CSV", en: "Export CSV" },

  upload_photo: { ar: "صورة", en: "Photo" },
  remove_photo: { ar: "إزالة", en: "Remove" },
  tiktok_follow: { ar: "تابعنا على تيكتوك", en: "Follow on TikTok" },
  search_customers: { ar: "ابحث بالاسم أو الرقم…", en: "Search by name or phone…" },
  search_orders: { ar: "ابحث برقم الطلب أو العميل…", en: "Search by order # or customer…" },
  admin_themes: { ar: "ثيمات المواسم", en: "Seasonal themes" },
  theme_new: { ar: "إنشاء ثيم جديد", en: "Create new theme" },
  theme_name: { ar: "اسم الثيم", en: "Theme name" },
  theme_dates: { ar: "الفترة", en: "Period" },
  theme_start: { ar: "تاريخ البداية", en: "Start date" },
  theme_end: { ar: "تاريخ النهاية", en: "End date" },
  theme_accent: { ar: "لون مميز (CSS color)", en: "Accent color (CSS)" },
  theme_banner_ar: { ar: "نص الشريط (عربي)", en: "Banner text (Arabic)" },
  theme_banner_en: { ar: "نص الشريط (إنجليزي)", en: "Banner text (English)" },
  theme_banner_url: { ar: "رابط الشريط (اختياري)", en: "Banner link (optional)" },
  theme_active: { ar: "مُفعّل", en: "Active" },
  theme_on: { ar: "مُفعّل", en: "On" },
  theme_off: { ar: "متوقف", en: "Off" },
  edit: { ar: "تعديل", en: "Edit" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  download_cover: { ar: "تحميل الغلاف", en: "Download cover" },
  download_all_images: { ar: "تحميل كل الصور", en: "Download all images" },
  customer_photos: { ar: "صور العميل المرفقة", en: "Customer reference photos" },

  // Install gate
  install_title: { ar: "ثبّت تطبيق بصمة حكاية", en: "Install Basma Hekaya" },
  install_subtitle: {
    ar: "لتجربة أفضل وأسرع، ثبّت التطبيق على شاشتك الرئيسية وتمتّع بحكاياتك في أي وقت.",
    en: "For the best experience, install the app to your home screen and enjoy your stories anytime.",
  },
  install_button: { ar: "تثبيت التطبيق الآن", en: "Install the app now" },
  install_installing: { ar: "جاري التثبيت…", en: "Installing…" },
  install_hint_menu: {
    ar: "افتح قائمة المتصفح (⋮) ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».",
    en: "Open your browser menu (⋮) and tap “Install app” or “Add to Home screen”.",
  },
  install_desktop_hint: {
    ar: "أو افتح الموقع من جهاز كمبيوتر لتجربته دون تثبيت.",
    en: "Or open this site on a desktop to use it without installing.",
  },
  install_benefit_fast: { ar: "أسرع", en: "Faster" },
  install_benefit_app: { ar: "كتطبيق", en: "App-like" },
  install_benefit_home: { ar: "أيقونة على شاشتك", en: "On your home" },
  install_ios_title: { ar: "للتثبيت على iPhone / iPad", en: "Install on iPhone / iPad" },
  install_ios_step1: { ar: "اضغط زر المشاركة", en: "Tap the Share button" },
  install_ios_step2: { ar: "اختر «إضافة إلى الشاشة الرئيسية»", en: "Choose “Add to Home Screen”" },
  install_ios_step3: { ar: "ثم اضغط «إضافة» في الأعلى.", en: "Then tap “Add” at the top." },
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
