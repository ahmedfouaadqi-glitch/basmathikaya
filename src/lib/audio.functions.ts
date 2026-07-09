// Public server functions for the audio system (mini music player + UI SFX).
// Anon-safe: returns only active items with short-lived signed URLs.
import { createServerFn } from "@tanstack/react-start";

const SIGNED_URL_TTL_SEC = 60 * 60 * 6; // 6 hours

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type AudioRow = {
  id: string;
  kind: "music" | "sfx";
  slot: string | null;
  title_ar: string;
  file_path: string;
  duration_sec: number | null;
  volume_default: number;
  display_order: number;
};

type AudioItem = AudioRow & { url: string };

async function signRow(row: AudioRow): Promise<AudioItem | null> {
  // file_path may be a full https URL (e.g. an existing brand video) or a storage key.
  if (row.file_path.startsWith("http://") || row.file_path.startsWith("https://")) {
    return { ...row, url: row.file_path };
  }
  const s = await db();
  const { data, error } = await s.storage.from("audio-library").createSignedUrl(row.file_path, SIGNED_URL_TTL_SEC);
  if (error || !data) return null;
  return { ...row, url: data.signedUrl };
}

/** Returns active music tracks + the current audio feature-flag state (public). */
export const getAudioBootstrap = createServerFn({ method: "GET" }).handler(async () => {
  const s = await db();

  const [flagsRes, musicRes, sfxRes] = await Promise.all([
    s.from("feature_flags").select("key,enabled").in("key", [
      "music_player_enabled",
      "ui_sfx_enabled",
      "music_source_promo_video",
    ]),
    s.from("audio_library").select("id,kind,slot,title_ar,file_path,duration_sec,volume_default,display_order")
      .eq("kind", "music").eq("is_active", true).order("display_order").order("created_at"),
    s.from("audio_library").select("id,kind,slot,title_ar,file_path,duration_sec,volume_default,display_order")
      .eq("kind", "sfx").eq("is_active", true),
  ]);

  const flagMap = Object.fromEntries((flagsRes.data ?? []).map((f) => [f.key, f.enabled])) as Record<string, boolean>;

  const music = (
    await Promise.all(((musicRes.data ?? []) as AudioRow[]).map(signRow))
  ).filter((x): x is AudioItem => x !== null);

  const sfxItems = (
    await Promise.all(((sfxRes.data ?? []) as AudioRow[]).map(signRow))
  ).filter((x): x is AudioItem => x !== null);

  const sfx: Record<string, AudioItem> = {};
  for (const item of sfxItems) {
    if (item.slot) sfx[item.slot] = item;
  }

  return {
    flags: {
      musicPlayerEnabled: !!flagMap["music_player_enabled"],
      uiSfxEnabled: !!flagMap["ui_sfx_enabled"],
      musicSourcePromoVideo: !!flagMap["music_source_promo_video"],
    },
    music,
    sfx,
  };
});
