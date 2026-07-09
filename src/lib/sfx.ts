// Lightweight client-side SFX + music helpers.
// - Preloads active items via getAudioBootstrap().
// - Respects per-user mute preferences (localStorage).
// - Guarded against SSR (window checks) and autoplay policies.

export type SfxSlot = "click" | "success" | "error" | "notify" | "nav";

export type AudioBootstrap = {
  flags: {
    musicPlayerEnabled: boolean;
    uiSfxEnabled: boolean;
    musicSourcePromoVideo: boolean;
  };
  music: Array<{
    id: string; title_ar: string; url: string;
    duration_sec: number | null; volume_default: number;
  }>;
  sfx: Record<string, {
    id: string; slot: string | null; title_ar: string; url: string; volume_default: number;
  }>;
};

const SFX_MUTE_KEY = "bh_sfx_muted";
const MUSIC_MUTE_KEY = "bh_music_muted";

let bootstrap: AudioBootstrap | null = null;
const sfxBuffers = new Map<SfxSlot, HTMLAudioElement>();

export function setBootstrap(b: AudioBootstrap) {
  bootstrap = b;
  if (typeof window === "undefined") return;
  // Warm up sfx audio elements.
  for (const slot of ["click", "success", "error", "notify", "nav"] as const) {
    const item = b.sfx[slot];
    if (!item) continue;
    const a = new Audio(item.url);
    a.preload = "auto";
    a.volume = item.volume_default;
    sfxBuffers.set(slot, a);
  }
}

export function getBootstrap(): AudioBootstrap | null { return bootstrap; }

export function isSfxMuted(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SFX_MUTE_KEY) === "1";
}
export function setSfxMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SFX_MUTE_KEY, muted ? "1" : "0");
  window.dispatchEvent(new CustomEvent("bh:audio-prefs-changed"));
}

export function isMusicMuted(): boolean {
  if (typeof window === "undefined") return true;
  // Default = muted (autoplay policies).
  const v = window.localStorage.getItem(MUSIC_MUTE_KEY);
  return v === null ? true : v === "1";
}
export function setMusicMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUSIC_MUTE_KEY, muted ? "1" : "0");
  window.dispatchEvent(new CustomEvent("bh:audio-prefs-changed"));
}

/** Play a UI sound. Fails silently if disabled or unavailable. */
export function playSfx(slot: SfxSlot) {
  if (typeof window === "undefined") return;
  if (!bootstrap?.flags.uiSfxEnabled) return;
  if (isSfxMuted()) return;
  const a = sfxBuffers.get(slot);
  if (!a) return;
  try {
    a.currentTime = 0;
    void a.play().catch(() => { /* autoplay blocked */ });
  } catch { /* noop */ }
}

/** Convenience wrapper: hooks sfx onto any click without wrappers. */
export function withSfx<T extends (...args: never[]) => unknown>(slot: SfxSlot, fn?: T) {
  return ((...args: Parameters<T>) => {
    playSfx(slot);
    return fn?.(...args);
  }) as T;
}
