// Client-only: build a beautifully laid-out, Arabic-shaped story PDF in the browser.
// Strategy: render real HTML (browser handles Arabic shaping/bidi natively),
// snapshot each page with html2canvas-pro, assemble with jsPDF.
import { brandLogoUrl } from "./brand";

export type StoryPdfAssets = {
  title: string;
  language: "ar" | "en";
  customerName: string;
  moods: string[];
  coverUrl: string | null;
  pages: Array<{ number: number; text: string; imageUrl: string | null }>;
  accentColor?: string | null;
  orderNumber?: number | null;
};

// A4 at 96dpi: 794 x 1123 px
const PAGE_W = 794;
const PAGE_H = 1123;

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

function buildCoverHtml(a: StoryPdfAssets, opts: { accent: string; gold: string; logo: string | null; coverData: string | null }) {
  const isAr = a.language === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const title = escapeHtml(a.title || (isAr ? "حكايتي" : "My Story"));
  const sub = a.customerName
    ? (isAr ? `حكاية مخصّصة لـ ${a.customerName}` : `A story crafted for ${a.customerName}`)
    : (isAr ? "حكاية مخصّصة لك" : "A story crafted for you");
  const chips = (a.moods || []).map((m) => `<span style="background:${opts.gold}22;color:${opts.gold};padding:6px 12px;border-radius:999px;font-weight:700;font-size:13px;margin:0 4px;display:inline-block;">${escapeHtml(m)}</span>`).join("");
  const brand = isAr ? "بصمة حكاية" : "Basma Hekaya";
  const tag = isAr ? "بصمة حكاية — جزء من نظام معروف" : "Basma Hekaya — part of the Maaroof system";
  const cover = opts.coverData
    ? `<img src="${opts.coverData}" alt="" crossorigin="anonymous" style="width:100%;height:100%;object-fit:contain;background:#F0E6D2;display:block;" />`
    : `<div style="width:100%;height:100%;background:#F0E6D2;"></div>`;
  const logoImg = opts.logo
    ? `<img src="${opts.logo}" alt="" crossorigin="anonymous" style="width:60px;height:60px;object-fit:contain;display:block;margin:0 auto 6px;" />`
    : "";

  return `
  <div dir="${dir}" style="
    width:${PAGE_W}px;height:${PAGE_H}px;
    background:#FFFBF5;
    font-family:'Tajawal',sans-serif;
    color:#1a2128;
    box-sizing:border-box;
    position:relative;display:flex;flex-direction:column;
  ">
    <div style="height:18px;background:${opts.accent};"></div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;padding:36px 44px 0;">
      <div style="
        width:100%;height:560px;border-radius:18px;overflow:hidden;
        border:4px solid ${opts.accent};
        box-shadow:0 10px 28px rgba(0,0,0,.12);
      ">
        ${cover}
      </div>
      <h1 style="
        margin:34px 0 8px;font-size:42px;font-weight:900;
        color:${opts.accent};text-align:center;line-height:1.2;
      ">${title}</h1>
      <p style="margin:0 0 16px;font-size:16px;color:#6b7079;text-align:center;">${escapeHtml(sub)}</p>
      <div style="text-align:center;">${chips}</div>
    </div>
    <div style="text-align:center;padding:16px 0 28px;">
      ${logoImg}
      <div style="font-size:14px;font-weight:700;color:${opts.accent};">${brand}</div>
      <div style="font-size:11px;color:${opts.gold};margin-top:4px;">${tag}</div>
    </div>
    <div style="height:12px;background:${opts.gold};"></div>
  </div>`;
}

function buildPageHtml(p: { number: number; text: string; imageUrl: string | null }, total: number, a: StoryPdfAssets, opts: { accent: string; gold: string; logo: string | null; imgData: string | null }) {
  const isAr = a.language === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const align = isAr ? "right" : "left";
  const brand = isAr ? "بصمة حكاية" : "Basma Hekaya";
  const pageLabel = isAr ? `صفحة ${p.number} من ${total}` : `Page ${p.number} of ${total}`;
  const tag = isAr ? "بصمة حكاية — جزء من نظام معروف" : "Basma Hekaya — part of the Maaroof system";
  const img = opts.imgData
    ? `<img src="${opts.imgData}" alt="" crossorigin="anonymous" style="width:100%;height:100%;object-fit:contain;background:#F0E6D2;display:block;" />`
    : `<div style="width:100%;height:100%;background:#F0E6D2;"></div>`;
  const logoImg = opts.logo
    ? `<img src="${opts.logo}" alt="" crossorigin="anonymous" style="width:22px;height:22px;object-fit:contain;display:inline-block;vertical-align:middle;margin:0 6px;" />`
    : "";
  const text = escapeHtml(p.text || "").replace(/\n+/g, "<br/>");

  return `
  <div dir="${dir}" lang="${a.language}" style="
    width:${PAGE_W}px;height:${PAGE_H}px;
    background:#FFFBF5;
    font-family:'Tajawal',sans-serif;
    color:#1a2128;
    box-sizing:border-box;
    position:relative;display:flex;flex-direction:column;
  ">
    <div style="height:14px;background:${opts.accent};"></div>
    <div style="flex:1;display:flex;flex-direction:column;padding:26px 44px 0;min-height:0;">
      <div style="
        width:100%;height:430px;border-radius:16px;overflow:hidden;
        border:3px solid ${opts.accent};
        box-shadow:0 8px 20px rgba(0,0,0,.10);
        flex-shrink:0;background:#F0E6D2;
      ">
        ${img}
      </div>
      <div style="height:2px;background:linear-gradient(to ${isAr ? "left" : "right"}, ${opts.gold}, transparent);margin:18px 0 14px;"></div>
      <div style="
        font-size:22px;line-height:2.05;font-weight:500;
        text-align:${isAr ? "justify" : "justify"};
        text-justify:inter-word;
        color:#1a2128;
        flex:1;
        word-wrap:break-word;
        overflow-wrap:break-word;
      ">${text}</div>
    </div>
    <div style="
      padding:10px 44px 0;
      border-top:1px solid ${opts.accent}55;
      display:flex;justify-content:space-between;align-items:center;
      font-size:12px;color:#6b7079;
    ">
      <span>${pageLabel}</span>
      <span style="font-weight:700;color:${opts.accent};display:inline-flex;align-items:center;">
        ${logoImg}${brand}
      </span>
    </div>
    <div style="text-align:center;font-size:10px;color:${opts.gold};padding:6px 0 10px;">${tag}</div>
    <div style="height:10px;background:${opts.gold};"></div>
  </div>`;
}

function buildThanksHtml(a: StoryPdfAssets, opts: { accent: string; gold: string; logo: string | null }) {
  const isAr = a.language === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const thanks = isAr ? "شكراً لاختياركم بصمة حكاية" : "Thank you for choosing Basma Hekaya";
  const note = isAr ? "تابعونا على تيكتوك واكتبوا لنا فكرة حكايتكم القادمة." : "Follow us on TikTok and tell us your next story idea.";
  const tag = isAr ? "بصمة حكاية — جزء من نظام معروف" : "Basma Hekaya — part of the Maaroof system";
  const logoImg = opts.logo
    ? `<img src="${opts.logo}" alt="" crossorigin="anonymous" style="width:140px;height:140px;object-fit:contain;display:block;margin:0 auto 24px;" />`
    : "";

  return `
  <div dir="${dir}" style="
    width:${PAGE_W}px;height:${PAGE_H}px;
    background:#FFFBF5;
    font-family:'Tajawal',sans-serif;
    color:#1a2128;
    box-sizing:border-box;
    display:flex;flex-direction:column;
  ">
    <div style="height:18px;background:${opts.accent};"></div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 60px;text-align:center;">
      ${logoImg}
      <div style="font-size:32px;font-weight:900;color:${opts.accent};margin-bottom:14px;">${escapeHtml(thanks)}</div>
      <div style="font-size:16px;color:#6b7079;margin-bottom:18px;">${escapeHtml(note)}</div>
      <div style="font-size:16px;font-weight:700;color:${opts.gold};">@basmathikaya1 · tiktok.com</div>
    </div>
    <div style="text-align:center;font-size:13px;font-weight:700;color:${opts.accent};padding:14px 0;">${tag}</div>
    <div style="height:12px;background:${opts.gold};"></div>
  </div>`;
}

export async function buildAndDownloadStoryPdf(a: StoryPdfAssets): Promise<void> {
  const accent = (a.accentColor && /^#[0-9a-fA-F]{6}$/.test(a.accentColor.trim())) ? a.accentColor.trim() : "#169CA3";
  const gold = "#D4A537";

  await ensureTajawal();

  // Preload images as data URLs (avoids CORS-tainted canvas).
  const [coverData, logoData, ...pageImgs] = await Promise.all([
    a.coverUrl ? loadImageAsDataUrl(a.coverUrl) : Promise.resolve(null),
    loadImageAsDataUrl(brandLogoUrl),
    ...a.pages.map((p) => (p.imageUrl ? loadImageAsDataUrl(p.imageUrl) : Promise.resolve(null))),
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
    const opts = { accent, gold, logo: logoData };
    const htmlParts: string[] = [
      buildCoverHtml(a, { ...opts, coverData }),
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

    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    const pageEls = Array.from(host.querySelectorAll<HTMLElement>("[data-pdf-page]"));
    for (let i = 0; i < pageEls.length; i++) {
      const el = pageEls[i];
      // Cap scale on mobile to avoid iOS Safari memory crashes; use 2 on desktop.
      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
      const isMobile = typeof window !== "undefined" && window.matchMedia?.("(max-width: 768px)").matches;
      const scale = isMobile ? Math.min(1.5, dpr) : 2;
      const canvas = await html2canvas(el, {
        scale,
        useCORS: true,
        backgroundColor: "#FFFBF5",
        logging: false,
        width: PAGE_W,
        height: PAGE_H,
        windowWidth: PAGE_W,
        windowHeight: PAGE_H,
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) pdf.addPage();
      pdf.addImage(dataUrl, "JPEG", 0, 0, pdfW, pdfH, undefined, "FAST");
    }

    const safeTitle = (a.title || "story").replace(/[^\p{L}\p{N}\s-]+/gu, "").trim().slice(0, 40) || "story";
    const filename = `basma-hekaya-${a.orderNumber ?? ""}-${safeTitle}.pdf`;
    pdf.save(filename);
  } finally {
    host.remove();
  }
}
