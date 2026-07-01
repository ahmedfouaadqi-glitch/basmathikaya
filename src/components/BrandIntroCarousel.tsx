import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Volume2, VolumeX } from "lucide-react";
import { brandIntroVideos } from "../lib/brand";
import { listPromoVideos, type PromoVideo } from "../lib/promo-videos.functions";

/**
 * Plays admin-uploaded promo videos in sequence and loops.
 * Falls back to the bundled default intro clips when none are configured.
 * Muted-by-default respects the admin flag; user can toggle sound.
 */
export function BrandIntroCarousel({ className = "" }: { className?: string }) {
  const fn = useServerFn(listPromoVideos);
  const q = useQuery({ queryKey: ["promo-videos"], queryFn: () => fn(), staleTime: 5 * 60_000 });
  const list = q.data ?? [];

  const sources: Array<{ url: string; mutedDefault: boolean }> =
    list.length > 0
      ? list.map((v: PromoVideo) => ({ url: v.url, mutedDefault: v.muted_default }))
      : brandIntroVideos.map((u) => ({ url: u, mutedDefault: true }));

  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState<boolean>(sources[0]?.mutedDefault ?? true);
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setMuted(sources[idx]?.mutedDefault ?? true);
    const v = ref.current;
    if (!v) return;
    v.load();
    v.play().catch(() => {/* autoplay blocked */});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, sources.length]);

  if (sources.length === 0) return null;

  return (
    <div className={`relative ${className}`}>
      <video
        ref={ref}
        key={`${idx}-${sources[idx]?.url}`}
        className="h-full w-full rounded-xl object-cover bg-background"
        src={sources[idx].url}
        autoPlay
        muted={muted}
        playsInline
        preload="auto"
        onEnded={() => setIdx((i) => (i + 1) % sources.length)}
      />
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        className="absolute bottom-2 end-2 z-10 grid size-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/70"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>
      {sources.length > 1 && (
        <div className="absolute top-2 start-2 z-10 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white">
          {idx + 1} / {sources.length}
        </div>
      )}
    </div>
  );
}
