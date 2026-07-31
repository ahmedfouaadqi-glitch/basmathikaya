import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";

const Galaxy = lazy(() => import("./Galaxy"));

// Routes where the animated starfield would compete with content
// (admin dashboards, story readers, PDF preview).
const EXCLUDED_PREFIXES = ["/admin", "/preview", "/s/", "/v/"];

export function GalaxyBackground() {
  const location = useLocation();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const weakDevice =
      (navigator.hardwareConcurrency ?? 4) <= 2 ||
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory !== undefined &&
        ((navigator as Navigator & { deviceMemory?: number }).deviceMemory as number) <= 2;
    const hasWebGL = (() => {
      try {
        const c = document.createElement("canvas");
        return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
      } catch {
        return false;
      }
    })();
    setEnabled(!reduced && !weakDevice && hasWebGL);
  }, []);

  const path = location.pathname;
  const excluded = EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(p));

  if (!enabled || excluded) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: -1 }}
    >
      <Suspense fallback={null}>
        <div className="h-full w-full opacity-45 dark:opacity-70">
          <Galaxy
            mouseInteraction={false}
            mouseRepulsion={false}
            hueShift={35}
            saturation={0.35}
            density={0.8}
            glowIntensity={0.25}
            twinkleIntensity={0.4}
            starSpeed={0.3}
            rotationSpeed={0.04}
            speed={0.6}
            transparent
          />
        </div>
      </Suspense>
      {/* Soft veil keeps Arabic text fully legible over the starfield */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/55 to-background/80" />
    </div>
  );
}
