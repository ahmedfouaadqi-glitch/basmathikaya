// Client-only: build a beautifully laid-out, Arabic-shaped story PDF in the browser.
// Strategy: render real HTML (browser handles Arabic shaping/bidi natively),
// snapshot each page with html2canvas-pro, assemble with jsPDF.
import { brandLogoUrl } from "./brand";

export type StoryPdfAssets = {
  title: string;
  language: "ar" | "en" | "ku";
  customerName: string;
  moods: string[];
  coverUrl: string | null;
  pages: Array<{ number: number; text: string; imageUrl: string | null }>;
  accentColor?: string | null;
  orderNumber?: number | null;
  disclaimer?: string | null;
  frameStyle?: "classic" | "arabesque" | "ribbon" | "stars" | "floral" | "geometric" | "none" | null;
  palette?: string[] | null;
  orientation?: "portrait" | "landscape" | null;
  reflectiveQuestion?: string | null;
};

// A4 at 96dpi: 794 x 1123 px (portrait) — swapped for landscape below.
const PORTRAIT_W = 794;
const PORTRAIT_H = 1123;
let PAGE_W = PORTRAIT_W;
let PAGE_H = PORTRAIT_H;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { credentials: "omit", mode: "cors" });
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => rej(new Error("read"));
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Pre-decode + downscale + JPEG-compress a large remote image so html2canvas
 * doesn't blow up iOS memory. Keeps native aspect ratio (no cropping).
 */
async function loadAndCompressImage(
  url: string | null,
  opts: { maxEdge: number; quality: number },
): Promise<string | null> {
  if (!url) return null;
  const raw = await loadImageAsDataUrl(url);
  if (!raw) return null;
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("img"));
      i.src = raw;
    });
    const { width: w, height: h } = img;
    const scale = Math.min(1, opts.maxEdge / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    if (scale >= 1 && raw.length < 600_000) return raw; // already small enough
    const c = document.createElement("canvas");
    c.width = tw; c.height = th;
    const ctx = c.getContext("2d");
    if (!ctx) return raw;
    ctx.fillStyle = "#F0E6D2";
    ctx.fillRect(0, 0, tw, th);
    ctx.drawImage(img, 0, 0, tw, th);
    return c.toDataURL("image/jpeg", opts.quality);
  } catch {
    return raw;
  }
}

async function ensureTajawal(): Promise<void> {
  if (!document.getElementById("tajawal-pdf-font")) {
    const link = document.createElement("link");
    link.id = "tajawal-pdf-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap";
    document.head.appendChild(link);
  }
  // Wait for fonts to actually load before we snapshot — critical on iOS Safari.
  try {
    const f = (document as any).fonts;
    if (f?.load) {
      await Promise.all([
        f.load('900 42px "Tajawal"'),
        f.load('700 22px "Tajawal"'),
        f.load('500 22px "Tajawal"'),
        f.load('400 16px "Tajawal"'),
      ]);
    }
    await f?.ready;
    // double rAF: ensure layout settles after font swap
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
  } catch { /* ignore */ }
}

// Localized strings for PDF chrome (cover / page / thanks).
type PdfLang = "ar" | "en" | "ku";
type PdfStrings = {
  defaultTitle: string;
  subWith: (name: string) => string;
  subNoName: string;
  brand: string;
  tag: string;
  pageLabel: (n: number, total: number) => string;
  thanks: string;
  note: string;
  disclaimerTitle: string;
  certTitle: string;
  certLine: string;
  questionTitle: string;
  signature: string;
  heroFallback: string;
};
const STRINGS: Record<PdfLang, PdfStrings> = {
  ar: {
    defaultTitle: "حكايتي",
    subWith: (n) => `حكاية مخصّصة لـ ${n}`,
    subNoName: "حكاية مخصّصة لك",
    brand: "بصمة حكاية",
    tag: "بصمة حكاية — جزء من نظام معروف",
    pageLabel: (n, t) => `صفحة ${n} من ${t}`,
    thanks: "شكراً لاختياركم بصمة حكاية",
    note: "تابعونا على تيكتوك واكتبوا لنا فكرة حكايتكم القادمة.",
    disclaimerTitle: "إخلاء مسؤولية",
    certTitle: "شهادة البطل",
    certLine: "هذه الحكاية من نصيب البطل",
    questionTitle: "سؤال لك يا بطل",
    signature: "توقيع: بصمة حكاية",
    heroFallback: "بطلنا",
  },
  en: {
    defaultTitle: "My Story",
    subWith: (n) => `A story crafted for ${n}`,
    subNoName: "A story crafted for you",
    brand: "Basma Hekaya",
    tag: "Basma Hekaya — part of the Maaroof system",
    pageLabel: (n, t) => `Page ${n} of ${t}`,
    thanks: "Thank you for choosing Basma Hekaya",
    note: "Follow us on TikTok and tell us your next story idea.",
    disclaimerTitle: "Disclaimer",
    certTitle: "Hero Certificate",
    certLine: "This story belongs to",
    questionTitle: "A question for you, hero",
    signature: "Signed: Basma Hekaya",
    heroFallback: "our hero",
  },
  ku: {
    defaultTitle: "چیرۆکەکەم",
    subWith: (n) => `چیرۆکێکی تایبەت بۆ ${n}`,
    subNoName: "چیرۆکێکی تایبەت بۆ تۆ",
    brand: "بەسمە حیکایە",
    tag: "بەسمە حیکایە — بەشێک لە سیستەمی مەعروف",
    pageLabel: (n, t) => `لاپەڕە ${n} لە ${t}`,
    thanks: "سوپاس بۆ هەڵبژاردنی بەسمە حیکایە",
    note: "لە تیکتۆک شوێنمان بکەون و بیرۆکەی چیرۆکی داهاتوومان بۆ بنێرن.",
    disclaimerTitle: "ڕوونکردنەوەی بەرپرسیارێتی",
    certTitle: "بڕوانامەی پاڵەوان",
    certLine: "ئەم چیرۆکە بۆ ئەم پاڵەوانەیە",
    questionTitle: "پرسیارێک بۆ تۆ ئەی پاڵەوان",
    signature: "واژۆ: بەسمە حیکایە",
    heroFallback: "پاڵەوانمان",
  },
};

function buildCoverHtml(a: StoryPdfAssets, opts: { accent: string; gold: string; logo: string | null; coverData: string | null }) {
  const isRtl = a.language !== "en";
  const isLandscape = a.orientation === "landscape";
  const dir = isRtl ? "rtl" : "ltr";
  const s = STRINGS[a.language as PdfLang] ?? STRINGS.ar;
  const title = escapeHtml(a.title || s.defaultTitle);
  const sub = a.customerName ? s.subWith(a.customerName) : s.subNoName;
  const chips = (a.moods || []).map((m) => `<span style="background:${opts.gold}22;color:${opts.gold};padding:6px 12px;border-radius:999px;font-weight:700;font-size:13px;margin:0 4px;display:inline-block;">${escapeHtml(m)}</span>`).join("");
  const cover = opts.coverData
    ? `<img src="${opts.coverData}" alt="" crossorigin="anonymous" style="width:100%;height:100%;object-fit:contain;background:#F0E6D2;display:block;" />`
    : `<div style="width:100%;height:100%;background:#F0E6D2;"></div>`;
  const logoImg = opts.logo
    ? `<img src="${opts.logo}" alt="" crossorigin="anonymous" style="width:60px;height:60px;object-fit:contain;display:block;margin:0 auto 6px;" />`
    : "";

  // Ratio-based heights so portrait and landscape look equally polished.
  const coverH = Math.round(PAGE_H * (isLandscape ? 0.72 : 0.55));
  const padX = isLandscape ? 64 : 44;
  const bandTop = Math.max(14, Math.round(PAGE_H * 0.016));
  const bandBottom = Math.max(10, Math.round(PAGE_H * 0.012));
  const titleSize = isLandscape ? 36 : 42;

  return `
  <div dir="${dir}" style="
    width:${PAGE_W}px;height:${PAGE_H}px;
    background:#FFFBF5;
    font-family:'Tajawal',sans-serif;
    color:#1a2128;
    box-sizing:border-box;
    position:relative;display:flex;flex-direction:column;
  ">
    <div style="height:${bandTop}px;background:${opts.accent};"></div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;padding:${isLandscape ? 24 : 36}px ${padX}px 0;">
      <div style="
        width:100%;height:${coverH}px;border-radius:${isLandscape ? 14 : 18}px;overflow:hidden;
        border:4px solid ${opts.accent};
        box-shadow:0 10px 28px rgba(0,0,0,.12);
      ">
        ${cover}
      </div>
      <h1 style="
        margin:${isLandscape ? 20 : 34}px 0 8px;font-size:${titleSize}px;font-weight:900;
        color:${opts.accent};text-align:center;line-height:1.2;
      ">${title}</h1>
      <p style="margin:0 0 12px;font-size:16px;color:#6b7079;text-align:center;">${escapeHtml(sub)}</p>
      <div style="text-align:center;">${chips}</div>
    </div>
    <div style="text-align:center;padding:${isLandscape ? 8 : 16}px 0 ${isLandscape ? 14 : 28}px;">
      ${logoImg}
      <div style="font-size:14px;font-weight:700;color:${opts.accent};">${escapeHtml(s.brand)}</div>
      <div style="font-size:11px;color:${opts.gold};margin-top:4px;">${escapeHtml(s.tag)}</div>
    </div>
    <div style="height:${bandBottom}px;background:${opts.gold};"></div>
  </div>`;
}

function buildPageHtml(p: { number: number; text: string; imageUrl: string | null }, total: number, a: StoryPdfAssets, opts: { accent: string; gold: string; logo: string | null; imgData: string | null; disclaimer: string }) {
  const isRtl = a.language !== "en";
  const isLandscape = a.orientation === "landscape";
  const dir = isRtl ? "rtl" : "ltr";
  const s = STRINGS[a.language as PdfLang] ?? STRINGS.ar;
  const img = opts.imgData
    ? `<img src="${opts.imgData}" alt="" crossorigin="anonymous" style="width:100%;height:100%;object-fit:contain;background:#F0E6D2;display:block;" />`
    : `<div style="width:100%;height:100%;background:#F0E6D2;"></div>`;
  const logoImg = opts.logo
    ? `<img src="${opts.logo}" alt="" crossorigin="anonymous" style="width:22px;height:22px;object-fit:contain;display:inline-block;vertical-align:middle;margin:0 6px;" />`
    : "";
  const text = escapeHtml(p.text || "").replace(/\n+/g, "<br/>");

  const padX = isLandscape ? 64 : 44;
  const bandTop = Math.max(10, Math.round(PAGE_H * 0.013));
  const bandBottom = Math.max(6, Math.round(PAGE_H * 0.008));

  // Landscape: image + text side-by-side. Portrait: stacked.
  const body = isLandscape
    ? `
      <div style="flex:1;display:flex;flex-direction:${isRtl ? "row" : "row"};gap:22px;padding:20px ${padX}px 0;min-height:0;">
        <div style="
          width:45%;border-radius:16px;overflow:hidden;
          border:3px solid ${opts.accent};
          box-shadow:0 8px 20px rgba(0,0,0,.10);
          background:#F0E6D2;flex-shrink:0;
        ">${img}</div>
        <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
          <div style="height:2px;background:linear-gradient(to ${isRtl ? "left" : "right"}, ${opts.gold}, transparent);margin:6px 0 14px;"></div>
          <div style="
            font-size:20px;line-height:1.95;font-weight:500;
            text-align:justify;text-justify:inter-word;color:#1a2128;
            flex:1;word-wrap:break-word;overflow-wrap:break-word;
          ">${text}</div>
        </div>
      </div>`
    : `
      <div style="flex:1;display:flex;flex-direction:column;padding:26px ${padX}px 0;min-height:0;">
        <div style="
          width:100%;height:${Math.round(PAGE_H * 0.42)}px;border-radius:16px;overflow:hidden;
          border:3px solid ${opts.accent};
          box-shadow:0 8px 20px rgba(0,0,0,.10);
          flex-shrink:0;background:#F0E6D2;
        ">${img}</div>
        <div style="height:2px;background:linear-gradient(to ${isRtl ? "left" : "right"}, ${opts.gold}, transparent);margin:18px 0 14px;"></div>
        <div style="
          font-size:22px;line-height:2.05;font-weight:500;
          text-align:justify;text-justify:inter-word;color:#1a2128;
          flex:1;word-wrap:break-word;overflow-wrap:break-word;
        ">${text}</div>
      </div>`;

  return `
  <div dir="${dir}" lang="${a.language}" style="
    width:${PAGE_W}px;height:${PAGE_H}px;
    background:#FFFBF5;
    font-family:'Tajawal',sans-serif;
    color:#1a2128;
    box-sizing:border-box;
    position:relative;display:flex;flex-direction:column;
  ">
    <div style="height:${bandTop}px;background:${opts.accent};"></div>
    ${body}
    <div style="
      padding:8px ${padX}px 0;
      border-top:1px solid ${opts.accent}55;
      display:flex;justify-content:space-between;align-items:center;
      font-size:12px;color:#6b7079;
    ">
      <span>${escapeHtml(s.pageLabel(p.number, total))}</span>
      <span style="font-weight:700;color:${opts.accent};display:inline-flex;align-items:center;">
        ${logoImg}${escapeHtml(s.brand)}
      </span>
    </div>
    <div style="text-align:center;font-size:10px;color:${opts.gold};padding:4px ${padX}px 2px;">${escapeHtml(s.tag)}</div>
    <div style="font-size:8.5px;line-height:1.5;color:#8a8f96;padding:0 ${padX}px 6px;text-align:center;">
      ${escapeHtml((opts.disclaimer ?? "").slice(0, 220))}
    </div>
    <div style="height:${bandBottom}px;background:${opts.gold};"></div>
  </div>`;
}

function buildThanksHtml(a: StoryPdfAssets, opts: { accent: string; gold: string; logo: string | null; disclaimer: string }) {
  const isRtl = a.language !== "en";
  const dir = isRtl ? "rtl" : "ltr";
  const s = STRINGS[a.language as PdfLang] ?? STRINGS.ar;
  const thanks = s.thanks;
  const note = s.note;
  const tag = s.tag;
  const disclaimerTitle = s.disclaimerTitle;
  const certTitle = s.certTitle;
  const certLine = s.certLine;
  const questionTitle = s.questionTitle;
  const signature = s.signature;
  const heroName = a.customerName || s.heroFallback;
  const orderNum = a.orderNumber ? `#${a.orderNumber}` : "";
  const locale = a.language === "ar" ? "ar-IQ" : a.language === "ku" ? "ckb-IQ" : "en-US";
  const dateStr = new Date().toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
  const question = (a.reflectiveQuestion ?? "").trim();
  const logoImg = opts.logo
    ? `<img src="${opts.logo}" alt="" crossorigin="anonymous" style="width:70px;height:70px;object-fit:contain;display:block;margin:0 auto 8px;" />`
    : "";
  const logoSmall = opts.logo
    ? `<img src="${opts.logo}" alt="" crossorigin="anonymous" style="width:34px;height:34px;object-fit:contain;display:inline-block;vertical-align:middle;margin:0 8px;" />`
    : "";

  // Decorative corner ornaments (pure CSS — no external assets).
  const corner = (pos: string) => `<div style="position:absolute;${pos};width:38px;height:38px;border:3px solid ${opts.gold};border-radius:6px;opacity:.85;"></div>`;

  return `
  <div dir="${dir}" style="
    width:${PAGE_W}px;height:${PAGE_H}px;
    background:#FFFBF5;
    font-family:'Tajawal',sans-serif;
    color:#1a2128;
    box-sizing:border-box;
    display:flex;flex-direction:column;position:relative;
  ">
    <div style="height:18px;background:${opts.accent};"></div>

    <!-- Outer decorative frame -->
    <div style="flex:1;padding:22px 30px;display:flex;flex-direction:column;">
      <div style="
        flex:1;position:relative;
        border:3px double ${opts.accent};
        border-radius:16px;
        padding:26px 34px;
        background:linear-gradient(180deg, ${opts.accent}05, ${opts.gold}05);
        display:flex;flex-direction:column;gap:14px;
      ">
        ${corner("top:8px;inset-inline-start:8px")}
        ${corner("top:8px;inset-inline-end:8px")}
        ${corner("bottom:8px;inset-inline-start:8px")}
        ${corner("bottom:8px;inset-inline-end:8px")}

        <div style="text-align:center;">
          ${logoImg}
          <div style="font-size:24px;font-weight:900;color:${opts.accent};margin-bottom:4px;">${escapeHtml(thanks)}</div>
          <div style="font-size:12px;color:#6b7079;">${escapeHtml(note)}</div>
          <div style="font-size:12px;font-weight:700;color:${opts.gold};margin-top:2px;">@basmathikaya1 · tiktok.com</div>
        </div>

        <!-- Hero Certificate -->
        <div style="
          border:2px solid ${opts.gold};
          border-radius:14px;
          padding:16px 20px;
          background:${opts.gold}10;
          text-align:center;
        ">
          <div style="font-size:11px;font-weight:900;color:${opts.gold};letter-spacing:2px;margin-bottom:6px;text-transform:uppercase;">${escapeHtml(certTitle)}</div>
          <div style="font-size:13px;color:#3a3f47;margin-bottom:4px;">${escapeHtml(certLine)}</div>
          <div style="font-size:26px;font-weight:900;color:${opts.accent};margin:2px 0 8px;">« ${escapeHtml(heroName)} »</div>
          <div style="font-size:11px;color:#6b7079;">${escapeHtml(dateStr)}${orderNum ? ` · <span style="font-family:monospace">${orderNum}</span>` : ""}</div>
          <div style="margin-top:8px;font-size:11px;color:${opts.accent};font-weight:700;">${logoSmall}${escapeHtml(signature)}</div>
        </div>

        ${question ? `
        <!-- Reflective question -->
        <div style="
          border:2px dashed ${opts.accent}66;
          border-radius:14px;
          padding:14px 18px;
          background:${opts.accent}08;
          text-align:${isRtl ? "right" : "left"};
        ">
          <div style="font-size:11px;font-weight:900;color:${opts.accent};letter-spacing:1px;margin-bottom:6px;text-transform:uppercase;">${escapeHtml(questionTitle)}</div>
          <div style="font-size:15px;line-height:1.9;color:#1a2128;font-weight:500;">${escapeHtml(question)}</div>
        </div>` : ""}

        <!-- Disclaimer -->
        <div style="
          border:1px solid ${opts.accent}44;
          border-radius:12px;
          padding:12px 16px;
          background:#FFFFFF80;
          text-align:${isRtl ? "right" : "left"};
        ">
          <div style="font-size:10px;font-weight:900;color:${opts.accent};margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(disclaimerTitle)}</div>
          <div style="font-size:11px;line-height:1.75;color:#3a3f47;">${escapeHtml(opts.disclaimer)}</div>
        </div>
      </div>
    </div>

    <div style="text-align:center;font-size:12px;font-weight:700;color:${opts.accent};padding:8px 0;">${tag}</div>
    <div style="height:12px;background:${opts.gold};"></div>
  </div>`;
}

export async function buildAndDownloadStoryPdf(a: StoryPdfAssets): Promise<void> {
  const accent = (a.accentColor && /^#[0-9a-fA-F]{6}$/.test(a.accentColor.trim())) ? a.accentColor.trim() : "#169CA3";
  const gold = "#D4A537";

  const isLandscape = a.orientation === "landscape";
  PAGE_W = isLandscape ? PORTRAIT_H : PORTRAIT_W;
  PAGE_H = isLandscape ? PORTRAIT_W : PORTRAIT_H;

  await ensureTajawal();

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isMobile = typeof window !== "undefined" && window.matchMedia?.("(max-width: 768px)").matches;
  // Per-device caps to keep canvas memory under iOS Safari's ~224MB limit.
  const imgMaxEdge = isIOS ? 1100 : isMobile ? 1300 : 1600;
  const imgQuality = isIOS ? 0.82 : 0.9;

  // Preload images (compressed) as data URLs.
  const [coverData, logoData, ...pageImgs] = await Promise.all([
    loadAndCompressImage(a.coverUrl, { maxEdge: imgMaxEdge, quality: imgQuality }),
    loadImageAsDataUrl(brandLogoUrl),
    ...a.pages.map((p) => loadAndCompressImage(p.imageUrl, { maxEdge: imgMaxEdge, quality: imgQuality })),
  ]);

  // Offscreen host
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `
    position:fixed;left:-100000px;top:0;
    width:${PAGE_W}px;
    background:#FFFBF5;
    z-index:-1;pointer-events:none;
    font-family:'Tajawal',sans-serif;
  `;
  document.body.appendChild(host);

  try {
    const disclaimer =
      a.disclaimer ??
      (a.language === "ar"
        ? "إخلاء مسؤولية: «بصمة حكاية» أداة ذكاء اصطناعي مخصّصة لهذه الفكرة بدون أي تدخّل بشري. المستخدم هو المسؤول الوحيد عن كل المُدخلات والنتائج، بعد تسديد المبالغ لا يتم استرجاعها. تحتفظ الإدارة بحق قبول أو رفض الطلب."
        : "Disclaimer: Basma Hekaya is an AI tool built for this concept with no human involvement. The user is solely responsible for all inputs and outputs; paid amounts are non-refundable. The admin reserves the right to accept or reject any order.");
    const opts = { accent, gold, logo: logoData, disclaimer };
    const htmlParts: string[] = [
      buildCoverHtml(a, { accent, gold, logo: logoData, coverData }),
      ...a.pages.map((p, i) => buildPageHtml(p, a.pages.length, a, { ...opts, imgData: pageImgs[i] })),
      buildThanksHtml(a, opts),
    ];

    host.innerHTML = htmlParts.map((h, i) => `<div data-pdf-page="${i}">${h}</div>`).join("");

    // Wait one paint frame.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    // Wait for any remaining images inside the host to fully decode.
    const allImgs = Array.from(host.querySelectorAll("img"));
    await Promise.all(allImgs.map((img) => {
      if ((img as HTMLImageElement).complete) return Promise.resolve();
      return new Promise((res) => {
        img.addEventListener("load", () => res(null), { once: true });
        img.addEventListener("error", () => res(null), { once: true });
      });
    }));

    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas-pro"),
    ]);

    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: isLandscape ? "landscape" : "portrait" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    const pageEls = Array.from(host.querySelectorAll<HTMLElement>("[data-pdf-page]"));
    // Adaptive raster scale per device. iOS Safari has a hard ~16MP/canvas cap.
    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    const scale = isIOS ? 1.4 : isMobile ? Math.min(1.6, dpr) : 2;
    const jpegQuality = isIOS ? 0.82 : 0.9;

    for (let i = 0; i < pageEls.length; i++) {
      const el = pageEls[i];
      const canvas = await html2canvas(el, {
        scale,
        useCORS: true,
        backgroundColor: "#FFFBF5",
        logging: false,
        width: PAGE_W,
        height: PAGE_H,
        windowWidth: PAGE_W,
        windowHeight: PAGE_H,
        imageTimeout: 15000,
      });
      const dataUrl = canvas.toDataURL("image/jpeg", jpegQuality);
      // Free canvas memory immediately (matters on iOS for ≥5 pages).
      canvas.width = 0; canvas.height = 0;
      if (i > 0) pdf.addPage();
      pdf.addImage(dataUrl, "JPEG", 0, 0, pdfW, pdfH, undefined, "FAST");
      // Yield to the event loop so Safari can reclaim memory between pages.
      await new Promise((r) => setTimeout(r, 0));
    }

    const safeTitle = (a.title || "story").replace(/[^\p{L}\p{N}\s-]+/gu, "").trim().slice(0, 40) || "story";
    const filename = `basma-hekaya-${a.orderNumber ?? ""}-${safeTitle}.pdf`;
    pdf.save(filename);
  } finally {
    host.remove();
  }
}
