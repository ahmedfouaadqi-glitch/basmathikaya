// Floating mini music player. Anchored bottom-right, respects safe-area.
// Mute-by-default (browsers block autoplay). One-click unmute.
import { useEffect, useRef, useState } from "react";
import { Music, Play, Pause, SkipForward, VolumeX, Volume2, ChevronDown } from "lucide-react";
import { getBootstrap, isMusicMuted, setMusicMuted, playSfx } from "@/lib/sfx";
import { brandIntroVideos } from "@/lib/brand";

type Track = { id: string; title_ar: string; url: string; volume_default: number };

export function MiniMusicPlayer() {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [muted, setMutedState] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [enabled, setEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Wait for bootstrap.
  useEffect(() => {
    let t: ReturnType<typeof setInterval>;
    const check = () => {
      const b = getBootstrap();
      if (!b) return;
      setEnabled(b.flags.musicPlayerEnabled);
      if (b.flags.musicSourcePromoVideo) {
        setTracks(brandIntroVideos.map((url, i) => ({
          id: `promo-${i}`, title_ar: `مقطع الترويسة ${i + 1}`, url, volume_default: 0.5,
        })));
      } else {
        setTracks(b.music.map((m) => ({
          id: m.id, title_ar: m.title_ar, url: m.url, volume_default: m.volume_default,
        })));
      }
      setMutedState(isMusicMuted());
      setReady(true);
      clearInterval(t);
    };
    check();
    t = setInterval(check, 500);
    return () => clearInterval(t);
  }, []);

  // Load track when idx changes.
  useEffect(() => {
    if (!audioRef.current || tracks.length === 0) return;
    const track = tracks[idx];
    audioRef.current.src = track.url;
    audioRef.current.volume = track.volume_default;
    audioRef.current.muted = muted;
    if (playing && !muted) {
      audioRef.current.play().catch(() => setPlaying(false));
    }
  }, [idx, tracks, muted, playing]);

  if (!ready || !enabled || tracks.length === 0) return null;

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMusicMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
    if (!next && !playing) {
      setPlaying(true);
      audioRef.current?.play().catch(() => setPlaying(false));
    }
    playSfx("click");
  };

  const togglePlay = () => {
    playSfx("click");
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.muted = false;
      setMutedState(false);
      setMusicMuted(false);
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const next = () => {
    playSfx("click");
    setIdx((i) => (i + 1) % tracks.length);
  };

  return (
    <>
      <audio
        ref={audioRef}
        loop={tracks.length === 1}
        onEnded={() => setIdx((i) => (i + 1) % tracks.length)}
      />
      <div
        className="fixed z-30 bottom-4 left-4 select-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        dir="ltr"
      >
        {open ? (
          <div className="w-64 rounded-2xl border bg-card/95 backdrop-blur-md shadow-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Music className="size-3.5" />
                <span>موسيقى الخلفية</span>
              </div>
              <button onClick={() => { playSfx("click"); setOpen(false); }} className="p-1 rounded hover:bg-secondary" aria-label="طي">
                <ChevronDown className="size-4" />
              </button>
            </div>
            <div className="truncate text-sm font-medium mb-2" dir="rtl">{tracks[idx]?.title_ar}</div>
            <div className="flex items-center gap-1">
              <button onClick={togglePlay} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground py-1.5 text-sm hover:opacity-90">
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                {playing ? "إيقاف" : "تشغيل"}
              </button>
              {tracks.length > 1 && (
                <button onClick={next} className="rounded-md border p-2 hover:bg-secondary" aria-label="التالي">
                  <SkipForward className="size-4" />
                </button>
              )}
              <button onClick={toggleMute} className="rounded-md border p-2 hover:bg-secondary" aria-label={muted ? "إلغاء الكتم" : "كتم"}>
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { playSfx("click"); setOpen(true); }}
            className="rounded-full border bg-card/90 backdrop-blur-md shadow-lg p-3 hover:bg-secondary transition"
            aria-label="مشغل الموسيقى"
            title="مشغل الموسيقى"
          >
            <Music className={`size-4 ${playing && !muted ? "text-primary animate-pulse" : ""}`} />
          </button>
        )}
      </div>
    </>
  );
}
