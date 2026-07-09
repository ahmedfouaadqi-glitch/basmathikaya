// Loads audio bootstrap once and installs global sonner toast interceptors so
// success/error toasts also trigger UI sounds.
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAudioBootstrap } from "@/lib/audio.functions";
import { setBootstrap, playSfx } from "@/lib/sfx";

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const fn = useServerFn(getAudioBootstrap);
  const q = useQuery({
    queryKey: ["audio-bootstrap"],
    queryFn: () => fn(),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (q.data) setBootstrap(q.data);
  }, [q.data]);

  // Wrap sonner's success/error so toasts play the matching sfx.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Idempotent — only patch once.
    const w = window as unknown as { __bhSonnerPatched?: boolean };
    if (w.__bhSonnerPatched) return;
    w.__bhSonnerPatched = true;

    const origSuccess = toast.success.bind(toast);
    const origError = toast.error.bind(toast);
    const origInfo = toast.info.bind(toast);

    toast.success = ((...args: Parameters<typeof toast.success>) => {
      playSfx("success");
      return origSuccess(...args);
    }) as typeof toast.success;

    toast.error = ((...args: Parameters<typeof toast.error>) => {
      playSfx("error");
      return origError(...args);
    }) as typeof toast.error;

    toast.info = ((...args: Parameters<typeof toast.info>) => {
      playSfx("notify");
      return origInfo(...args);
    }) as typeof toast.info;
  }, []);

  return <>{children}</>;
}
