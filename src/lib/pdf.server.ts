// Server-only: build a printable story PDF.
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
// @ts-expect-error - no types
import { ArabicShaper } from "arabic-persian-reshaper";
import { TAJAWAL_REGULAR_B64, TAJAWAL_BOLD_B64 } from "./tajawal-fonts.server";

const ARABIC_RE = /[\u0600-\u06FF]/;

function b64ToBytes(b64: string): Uint8Array {
  const buf = Buffer.from(b64, "base64");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

function shapeLine(text: string, isAr: boolean): string {
  if (!isAr) return text;
  // Reshape Arabic glyphs into their contextual forms, then reverse for visual RTL order.
  const reshaped: string = ArabicShaper.convertArabic(text);
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
    lines.push(""); // paragraph break
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export type StoryPdfInput = {
  title: string;
  language: "ar" | "en";
  coverPng?: Uint8Array | null;
  pages: Array<{ number: number; text: string; imagePng?: Uint8Array | null }>;
  customerName: string;
};

export async function buildStoryPdfBytes(input: StoryPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const regular = await doc.embedFont(b64ToBytes(TAJAWAL_REGULAR_B64), { subset: true });
  const bold = await doc.embedFont(b64ToBytes(TAJAWAL_BOLD_B64), { subset: true });
  const fallback = await doc.embedFont(StandardFonts.Helvetica);

  const isAr = input.language === "ar";
  const W = 595.28; // A4
  const H = 841.89;
  const margin = 48;

  // === Cover page ===
  {
    const page = doc.addPage([W, H]);
    if (input.coverPng) {
      try {
        const img = await doc.embedPng(input.coverPng);
        const scale = Math.min((W - margin * 2) / img.width, (H * 0.62) / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: (W - w) / 2, y: H - margin - h, width: w, height: h });
      } catch { /* ignore */ }
    }
    const titleSize = 28;
    const titleShaped = shapeLine(input.title, isAr);
    const titleFont = isAr ? bold : fallback;
    const titleWidth = titleFont.widthOfTextAtSize(titleShaped, titleSize);
    page.drawText(titleShaped, {
      x: (W - titleWidth) / 2,
      y: H * 0.28,
      size: titleSize,
      font: titleFont,
      color: rgb(0.05, 0.25, 0.30),
    });
    const sub = isAr ? `حكاية مخصصة لـ ${input.customerName}` : `A story for ${input.customerName}`;
    const subShaped = shapeLine(sub, isAr);
    const subFont = isAr ? regular : fallback;
    const subSize = 14;
    const subWidth = subFont.widthOfTextAtSize(subShaped, subSize);
    page.drawText(subShaped, {
      x: (W - subWidth) / 2,
      y: H * 0.22,
      size: subSize,
      font: subFont,
      color: rgb(0.4, 0.4, 0.4),
    });
    const brand = "بصمة حكاية · Basma Hekaya";
    const brandShaped = shapeLine(brand, true);
    page.drawText(brandShaped, {
      x: (W - bold.widthOfTextAtSize(brandShaped, 11)) / 2,
      y: 32,
      size: 11,
      font: bold,
      color: rgb(0.55, 0.42, 0.0),
    });
  }

  // === Story pages ===
  for (const p of input.pages) {
    const page = doc.addPage([W, H]);
    // Image at top half
    if (p.imagePng) {
      try {
        const img = await doc.embedPng(p.imagePng);
        const maxW = W - margin * 2;
        const maxH = H * 0.46;
        const scale = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: (W - w) / 2, y: H - margin - h, width: w, height: h });
      } catch { /* ignore */ }
    }

    // Text below image
    const textTop = H * 0.46;
    const textSize = 14;
    const lineGap = 8;
    const usesArabic = isAr || ARABIC_RE.test(p.text);
    const font = usesArabic ? regular : fallback;

    const rawLines = wrapText(p.text, font, textSize, W - margin * 2);
    const shapedLines = rawLines.map((l) => shapeLine(l, usesArabic));

    let y = textTop - textSize;
    for (const line of shapedLines) {
      if (y < margin + 30) break;
      const w = font.widthOfTextAtSize(line, textSize);
      const x = usesArabic ? W - margin - w : margin;
      page.drawText(line, { x, y, size: textSize, font, color: rgb(0.1, 0.1, 0.1) });
      y -= textSize + lineGap;
    }

    // Footer
    const footer = isAr ? `صفحة ${p.number}` : `Page ${p.number}`;
    const footerShaped = shapeLine(footer, isAr);
    page.drawText(footerShaped, {
      x: (W - regular.widthOfTextAtSize(footerShaped, 10)) / 2,
      y: 24,
      size: 10,
      font: regular,
      color: rgb(0.55, 0.55, 0.55),
    });
  }

  return doc.save();
}
