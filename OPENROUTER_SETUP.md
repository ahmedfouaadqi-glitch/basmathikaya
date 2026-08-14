# OpenRouter setup

The application now routes text, multimodal analysis, and configured image-generation tasks through OpenRouter.

## Required environment variables

```env
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_SITE_URL=https://urstory.space
OPENROUTER_APP_NAME=Basmathikaya
```

The server gateway uses `https://openrouter.ai/api/v1` by default. Set `OPENROUTER_BASE_URL` only when using a compatible private gateway.

## Optional Lovable fallback

Lovable is not used by default. To enable it as a technical fallback only, set both variables:

```env
ENABLE_LOVABLE_FALLBACK=true
LOVABLE_API_KEY=your-lovable-key
```

Do not set `ENABLE_LOVABLE_FALLBACK` if all requests must remain on OpenRouter.

## Model presets

The migration `20260815000001_openrouter_models.sql` adds OpenRouter presets for story generation, polishing, QA, image analysis, covers, interior images, and character sheets. The free text preset is `google/gemma-4-31b-it:free`; image generation availability depends on the selected OpenRouter provider and account access.

## Gallery categories

The migration `20260815000000_gallery_categories.sql` adds `orders.gallery_category` with `kids`, `adults`, and `general`. Administrators classify delivered stories from `/admin/gallery`. The public gallery defaults to children’s stories and asks for adult confirmation before querying the adult category.

Apply both SQL migrations in Supabase before relying on the new gallery filters.

## Security

Keep all keys server-side. Do not expose them through `VITE_*` variables or browser code. Adult content routing is not enabled as an unrestricted path; a future provider can be added behind a separate adult-only model and policy route after review.
