// Client-only: build a beautifully laid-out, Arabic-shaped story PDF in the browser.
// Avoids Cloudflare Worker bundler interop issues with @pdf-lib/fontkit + tslib.
import { brandLogoUrl } from "./brand";

const ARABIC_RE = /[\u0600-\u06FF]/;

export type StoryPdfAssets = {
  title: string;
  language: "ar" | "en";
  customerName: string;
  moods: string[];
  coverUrl: string | null;
  pages: Array<{ number: number; text: string; imageUrl: string | null }>;
  accentColor?: string | null; // hex / css color of active seasonal theme
  orderNumber?: number | null;
};

// ---------- helpers ----------

async function fetchBytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url, { credentials: "omit" });
  if (!r.ok) throw new Error(`fetch ${url} ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

function hexToRgb(hex: string | null | undefined, fallback: [number, number, number]): [number, number, number] {
  if (!hex) return fallback;
  const s = hex.trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(s)) return fallback;
  const n = parseInt(s, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function shapeArabic(text: string): string {
  // Lazy import to keep main bundle slim.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("arabic-persian-reshaper") as { ArabicShaper: { convertArabic: (s: string) => string } };
  const reshaped = mod.ArabicShaper.convertArabic(text);
  // pdf-lib draws LTR; reverse so the visual order is right-to-left.
  return reshaped.split("").reverse().join("");
}

function wrapText(
  text: string,
  font: import("pdf-lib").PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const paragraphs = text.split(/\n+/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    let current = "";
    for (const w of words) {
      const probe = current ? `${current} ${w}` : w;
      const width = font.widthOfTextAtSize(probe, size);
      if (width <= maxWidth) {
        current = probe;
      } else {
        if (current) lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
    lines.push("");
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

async function urlToPngBytes(url: string): Promise<Uint8Array | null> {
  try {
    const bytes = await fetchBytes(url);
    // pdf-lib accepts PNG or JPEG; we'll try PNG first then JPEG via dynamic embed call.
    return bytes;
  } catch {
    return null;
  }
}

// ---------- main entry ----------

export async function buildAndDownloadStoryPdf(a: StoryPdfAssets): Promise<void> {
  const [{ PDFDocument, rgb, StandardFonts }, fontkitMod] = await Promise.all([
    import("pdf-lib"),
    import("@pdf-lib/fontkit"),
  ]);
  const fontkit = (fontkitMod as unknown as { default?: unknown }).default ?? fontkitMod;

  const isAr = a.language === "ar";
  const accent = hexToRgb(a.accentColor ?? null, [0.087, 0.612, 0.639]); // #169CA3
  const gold: [number, number, number] = [0.831, 0.647, 0.215]; // #D4A537
  const ink: [number, number, number] = [0.10, 0.13, 0.16];
  const muted: [number, number, number] = [0.45, 0.48, 0.52];
  const cream: [number, number, number] = [1.0, 0.984, 0.961]; // #FFFBF5

  // Load fonts.
  const [tajawalReg, tajawalBold, logoBytes] = await Promise.all([
    fetchBytes("/fonts/tajawal-400.ttf"),
    fetchBytes("/fonts/tajawal-700.ttf"),
    urlToPngBytes(brandLogoUrl),
  ]);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit as Parameters<typeof doc.registerFontkit>[0]);

  const arRegular = await doc.embedFont(tajawalReg, { subset: true });
  const arBold = await doc.embedFont(tajawalBold, { subset: true });
  const enRegular = await doc.embedFont(StandardFonts.Helvetica);
  const enBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Brand logo for footer / cover corner.
  let logoImg: import("pdf-lib").PDFImage | null = null;
  if (logoBytes) {
    try {
      logoImg = await doc.embedPng(logoBytes);
    } catch {
      try { logoImg = await doc.embedJpg(logoBytes); } catch { logoImg = null; }
    }
  }

  // A4 portrait
  const W = 595.28;
  const H = 841.89;
  const margin = 42;

  function shape(text: string, ar: boolean): string {
    return ar ? shapeArabic(text) : text;
  }

  // ---------- COVER ----------
  {
    const page = doc.addPage([W, H]);
    // soft cream background
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(cream[0], cream[1], cream[2]) });
    // accent ribbon at top
    page.drawRectangle({ x: 0, y: H - 14, width: W, height: 14, color: rgb(accent[0], accent[1], accent[2]) });
    // gold underline ribbon at bottom
    page.drawRectangle({ x: 0, y: 0, width: W, height: 10, color: rgb(gold[0], gold[1], gold[2]) });

    // Cover image card
    const cardX = margin;
    const cardW = W - margin * 2;
    const cardH = H * 0.55;
    const cardY = H - 60 - cardH;
    page.drawRectangle({
      x: cardX - 2, y: cardY - 2, width: cardW + 4, height: cardH + 4,
      color: rgb(accent[0], accent[1], accent[2]),
    });
    if (a.coverUrl) {
      const bytes = await urlToPngBytes(a.coverUrl);
      if (bytes) {
        try {
          let img: import("pdf-lib").PDFImage;
          try { img = await doc.embedPng(bytes); } catch { img = await doc.embedJpg(bytes); }
          const scale = Math.min(cardW / img.width, cardH / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          page.drawImage(img, { x: cardX + (cardW - w) / 2, y: cardY + (cardH - h) / 2, width: w, height: h });
        } catch { /* ignore */ }
      }
    } else {
      page.drawRectangle({ x: cardX, y: cardY, width: cardW, height: cardH, color: rgb(0.94, 0.91, 0.84) });
    }

    // Title
    const titleSize = 30;
    const titleFont = isAr ? arBold : enBold;
    const titleShaped = shape(a.title || (isAr ? "حكايتي" : "My Story"), isAr);
    const titleW = titleFont.widthOfTextAtSize(titleShaped, titleSize);
    page.drawText(titleShaped, {
      x: (W - titleW) / 2,
      y: cardY - 50,
      size: titleSize,
      font: titleFont,
      color: rgb(accent[0], accent[1], accent[2]),
    });

    // Subtitle
    const sub = a.customerName
      ? (isAr ? `حكاية مخصّصة لـ ${a.customerName}` : `A story crafted for ${a.customerName}`)
      : (isAr ? "حكاية مخصّصة لك" : "A story crafted for you");
    const subFont = isAr ? arRegular : enRegular;
    const subSize = 14;
    const subShaped = shape(sub, isAr);
    const subW = subFont.widthOfTextAtSize(subShaped, subSize);
    page.drawText(subShaped, {
      x: (W - subW) / 2,
      y: cardY - 78,
      size: subSize,
      font: subFont,
      color: rgb(muted[0], muted[1], muted[2]),
    });

    // Mood chips
    if (a.moods && a.moods.length) {
      const chipFont = isAr ? arBold : enBold;
      const chipSize = 10;
      const gap = 8;
      const padX = 10, padY = 5;
      const shapedChips = a.moods.map((m) => shape(m, isAr || ARABIC_RE.test(m)));
      const widths = shapedChips.map((s) => chipFont.widthOfTextAtSize(s, chipSize) + padX * 2);
      const totalW = widths.reduce((s, w) => s + w, 0) + gap * (shapedChips.length - 1);
      let x = (W - totalW) / 2;
      const y = cardY - 120;
      shapedChips.forEach((s, i) => {
        const w = widths[i];
        const h = chipSize + padY * 2;
        page.drawRectangle({
          x, y: y - padY, width: w, height: h,
          color: rgb(gold[0], gold[1], gold[2]),
          opacity: 0.18,
        });
        page.drawText(s, {
          x: x + padX, y, size: chipSize, font: chipFont,
          color: rgb(gold[0] * 0.55, gold[1] * 0.55, gold[2] * 0.55),
        });
        x += w + gap;
      });
    }

    // Brand block at bottom
    if (logoImg) {
      const lw = 36;
      const scale = lw / logoImg.width;
      const lh = logoImg.height * scale;
      page.drawImage(logoImg, { x: (W - lw) / 2, y: 32, width: lw, height: lh });
    }
    const brandLine = isAr ? "بصمة حكاية" : "Basma Hekaya";
    const bs = shape(brandLine, isAr);
    const bf = isAr ? arBold : enBold;
    const bw = bf.widthOfTextAtSize(bs, 12);
    page.drawText(bs, {
      x: (W - bw) / 2, y: 20, size: 12, font: bf,
      color: rgb(accent[0], accent[1], accent[2]),
    });
  }

  // ---------- STORY PAGES ----------
  const total = a.pages.length;
  for (const p of a.pages) {
    const page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(cream[0], cream[1], cream[2]) });

    // Image card (top half)
    const imgCardY = H - margin - H * 0.46;
    const imgCardH = H * 0.46;
    const imgCardW = W - margin * 2;
    page.drawRectangle({
      x: margin - 2, y: imgCardY - 2, width: imgCardW + 4, height: imgCardH + 4,
      color: rgb(accent[0], accent[1], accent[2]),
    });
    if (p.imageUrl) {
      const bytes = await urlToPngBytes(p.imageUrl);
      if (bytes) {
        try {
          let img: import("pdf-lib").PDFImage;
          try { img = await doc.embedPng(bytes); } catch { img = await doc.embedJpg(bytes); }
          const scale = Math.min(imgCardW / img.width, imgCardH / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          page.drawImage(img, {
            x: margin + (imgCardW - w) / 2,
            y: imgCardY + (imgCardH - h) / 2,
            width: w, height: h,
          });
        } catch {
          page.drawRectangle({ x: margin, y: imgCardY, width: imgCardW, height: imgCardH, color: rgb(0.94, 0.91, 0.84) });
        }
      }
    } else {
      page.drawRectangle({ x: margin, y: imgCardY, width: imgCardW, height: imgCardH, color: rgb(0.94, 0.91, 0.84) });
    }

    // Text below image
    const textSize = 14;
    const lineGap = 8;
    const usesArabic = isAr || ARABIC_RE.test(p.text);
    const font = usesArabic ? arRegular : enRegular;

    const rawLines = wrapText(p.text || "", font, textSize, W - margin * 2);
    const shapedLines = rawLines.map((l) => shape(l, usesArabic));

    let y = imgCardY - 28;
    const textBottom = 70; // leave room for footer
    for (const line of shapedLines) {
      if (y < textBottom) break;
      const w = font.widthOfTextAtSize(line, textSize);
      const x = usesArabic ? W - margin - w : margin;
      page.drawText(line, { x, y, size: textSize, font, color: rgb(ink[0], ink[1], ink[2]) });
      y -= textSize + lineGap;
    }

    // Footer separator
    page.drawLine({
      start: { x: margin, y: 56 },
      end: { x: W - margin, y: 56 },
      thickness: 0.7,
      color: rgb(accent[0], accent[1], accent[2]),
      opacity: 0.45,
    });

    // Page number (left in AR layout = end of reading)
    const numLabel = isAr ? `صفحة ${p.number} من ${total}` : `Page ${p.number} of ${total}`;
    const numFont = isAr ? arRegular : enRegular;
    const numShaped = shape(numLabel, isAr);
    page.drawText(numShaped, {
      x: margin, y: 40, size: 10, font: numFont,
      color: rgb(muted[0], muted[1], muted[2]),
    });

    // Brand corner (logo + name)
    let bx = W - margin;
    const brandTxt = isAr ? "بصمة حكاية" : "Basma Hekaya";
    const bts = shape(brandTxt, isAr);
    const btf = isAr ? arBold : enBold;
    const btw = btf.widthOfTextAtSize(bts, 10);
    bx -= btw;
    page.drawText(bts, {
      x: bx, y: 40, size: 10, font: btf,
      color: rgb(accent[0], accent[1], accent[2]),
    });
    if (logoImg) {
      const lw = 18;
      const scale = lw / logoImg.width;
      const lh = logoImg.height * scale;
      bx -= (lw + 4);
      page.drawImage(logoImg, { x: bx, y: 36, width: lw, height: lh });
    }

    // Tagline under footer
    const tag = isAr ? "بصمة حكاية — جزء من نظام معروف" : "Basma Hekaya — part of the Maaroof system";
    const tagShaped = shape(tag, isAr);
    const tagFont = isAr ? arRegular : enRegular;
    const tagW = tagFont.widthOfTextAtSize(tagShaped, 8);
    page.drawText(tagShaped, {
      x: (W - tagW) / 2, y: 22, size: 8, font: tagFont,
      color: rgb(gold[0] * 0.7, gold[1] * 0.7, gold[2] * 0.7),
    });
  }

  // ---------- THANK YOU ----------
  {
    const page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(cream[0], cream[1], cream[2]) });
    page.drawRectangle({ x: 0, y: H - 14, width: W, height: 14, color: rgb(accent[0], accent[1], accent[2]) });
    page.drawRectangle({ x: 0, y: 0, width: W, height: 10, color: rgb(gold[0], gold[1], gold[2]) });

    if (logoImg) {
      const lw = 110;
      const scale = lw / logoImg.width;
      const lh = logoImg.height * scale;
      page.drawImage(logoImg, { x: (W - lw) / 2, y: H * 0.62, width: lw, height: lh });
    }
    const thanks = isAr ? "شكراً لاختياركم بصمة حكاية" : "Thank you for choosing Basma Hekaya";
    const tf = isAr ? arBold : enBold;
    const ts = shape(thanks, isAr);
    const tw = tf.widthOfTextAtSize(ts, 22);
    page.drawText(ts, {
      x: (W - tw) / 2, y: H * 0.52, size: 22, font: tf,
      color: rgb(accent[0], accent[1], accent[2]),
    });

    const note = isAr
      ? "تابعونا على تيكتوك واكتبوا لنا فكرة حكايتكم القادمة."
      : "Follow us on TikTok and tell us your next story idea.";
    const nf = isAr ? arRegular : enRegular;
    const ns = shape(note, isAr);
    const nw = nf.widthOfTextAtSize(ns, 12);
    page.drawText(ns, {
      x: (W - nw) / 2, y: H * 0.46, size: 12, font: nf,
      color: rgb(muted[0], muted[1], muted[2]),
    });

    const tk = "@basmathikaya1 · tiktok.com";
    const tkW = enBold.widthOfTextAtSize(tk, 12);
    page.drawText(tk, {
      x: (W - tkW) / 2, y: H * 0.42, size: 12, font: enBold,
      color: rgb(gold[0] * 0.6, gold[1] * 0.6, gold[2] * 0.6),
    });

    const tag = isAr ? "بصمة حكاية — جزء من نظام معروف" : "Basma Hekaya — part of the Maaroof system";
    const tagShaped = shape(tag, isAr);
    const tagFont = isAr ? arBold : enBold;
    const tagW = tagFont.widthOfTextAtSize(tagShaped, 11);
    page.drawText(tagShaped, {
      x: (W - tagW) / 2, y: 50, size: 11, font: tagFont,
      color: rgb(accent[0], accent[1], accent[2]),
    });
  }

  const bytes = await doc.save();
  // Wrap underlying ArrayBuffer with a slice into a fresh ArrayBuffer to satisfy DOM types.
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeTitle = (a.title || "story").replace(/[^\p{L}\p{N}\s-]+/gu, "").trim().slice(0, 40) || "story";
  link.download = `basma-hekaya-${a.orderNumber ?? ""}-${safeTitle}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
