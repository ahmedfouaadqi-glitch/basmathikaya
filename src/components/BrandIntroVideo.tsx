import { useEffect, useRef, useState } from "react";
import { brandIntroVideos } from "../lib/brand";

/**
 * Plays the brand intro videos one after another in a loop.
 * Muted + autoplay so it works on mobile without user interaction.
 */
export function BrandIntroVideo({ className = "" }: { className?: string }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.load();
    v.play().catch(() => { /* autoplay blocked — keep poster */ });
  }, [idx]);

  return (
    <video
      ref={ref}
      key={idx}
      className={className}
      src={brandIntroVideos[idx]}
      autoPlay
      muted
      playsInline
      preload="auto"
      onEnded={() => setIdx((i) => (i + 1) % brandIntroVideos.length)}
    />
  );
}
