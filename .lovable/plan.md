# Stage 6 — Share Cards (Satori + resvg)

Generate branded PNG share cards for completed orders so parents can share a beautiful preview on WhatsApp/Instagram instead of a raw link. Uses the existing `share_cards` table and `share_tokens` already wired in Stage 4's `generate_share_cards` runner.

## Scope

- Real image generation via **Satori** (JSX → SVG) + **@resvg/resvg-wasm** (SVG → PNG). Both are Worker-compatible (pure JS + WASM), unlike sharp/canvas.
- Public share page at `/s/$token` that renders the story preview and exposes the PNG via `og:image` / `twitter:image` for social crawlers.
- Server route `/api/public/share-cards/$token.png` that returns the PNG bytes (generates on first hit, caches to `story-covers` storage bucket).
- Wire "شارك" button in `/my-orders` for delivered orders → copies share URL.

Non-goals: custom card templates per theme (single default template), video share cards, per-page cards.

## Files

**New**
- `src/lib/share-cards.server.ts` — `renderShareCardPng({ title, childName, coverUrl, theme })`:
  - Loads Arabic font (Cairo/Tajawal) from `story-covers` bucket or bundled asset via `fetch`.
  - Calls `satori()` with a JSX layout (title, child name, cover thumbnail, brand mark, 1200×630).
  - Runs `Resvg` (from `@resvg/resvg-wasm`) to rasterize. Loads WASM once, cached in module scope.
- `src/lib/share-cards.functions.ts` — `getShareCardMeta({ token })` server fn: reads `share_cards` + joins `orders` to return `{ title, childName, coverUrl, orderNumber }` for the public page. No auth required (public token).
- `src/routes/s.$token.tsx` — public route (SSR). Loader calls `getShareCardMeta`. `head()` sets `og:image` / `twitter:image` to absolute `/api/public/share-cards/$token.png`. Body renders a clean preview with "اطلب مثلها" CTA linking to `/create`.
- `src/routes/api/public/share-cards/$token.png.ts` — server route. Verifies token exists in `share_cards`, checks if `image_path` already set → 302 to signed URL; otherwise generates via `renderShareCardPng`, uploads to `story-covers/share-cards/$token.png`, updates row, returns PNG with `Cache-Control: public, max-age=86400`.

**Modified**
- `src/routes/my-orders.tsx` — add "شارك" button per delivered order. Calls new `ensureShareToken({ orderId })` server fn (creates token if missing, returns URL). Copies `${origin}/s/$token` to clipboard.
- `src/lib/orders.functions.ts` — add small `ensureShareToken` server fn (auth-scoped: verifies order belongs to user, sets `share_token` if null, upserts `share_cards` row with `image_path: null`). Nothing else in orders touched.

**Packages**
- `bun add satori @resvg/resvg-wasm` — both pure-JS/WASM, Worker-safe.

## Principles

- Fail-open: if PNG generation fails, `/s/$token` still renders (just no rich `og:image`); the endpoint returns a 500 that social crawlers gracefully skip.
- Cache aggressively: first hit generates + stores, subsequent hits redirect to signed URL from `story-covers`.
- Public route reads only safe columns (title, child name, cover thumbnail path). No PII (phone, address) on the share page.
- No changes to existing order flow, PDF generation, or admin.

## Verification

- `bunx tsgo --noEmit`
- Manual: mark a test order delivered → click "شارك" → open URL in incognito → confirm page renders and `curl -I <png-url>` returns image/png.
- Meta debug: paste `/s/$token` into WhatsApp/Twitter preview tool.

Confirm to proceed.
