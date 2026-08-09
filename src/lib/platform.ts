/**
 * Runtime platform helpers.
 *
 * Used to distinguish a native Android/iOS shell (Capacitor or TWA)
 * from a normal mobile browser, so browser-only UI such as the
 * "install this app" gate never shows inside the packaged app.
 */

const NATIVE_FLAG_KEY = "bh-native-app";

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;

  try {
    // 1) Capacitor bridge
    const cap = (window as any).Capacitor;
    if (cap) {
      if (typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) return true;
      if (cap.isNative === true) return true;
      if (typeof cap.getPlatform === "function" && cap.getPlatform() !== "web") return true;
    }

    // 2) Capacitor / Cordova custom schemes
    const proto = window.location.protocol;
    if (proto === "capacitor:" || proto === "ionic:" || proto === "file:") return true;

    // 3) Trusted Web Activity (Android app opening the site)
    if (typeof document !== "undefined" && document.referrer.startsWith("android-app://")) return true;

    // 4) Explicit override: ?native=1 (persisted for the session)
    const params = new URLSearchParams(window.location.search);
    if (params.get("native") === "1") {
      try { localStorage.setItem(NATIVE_FLAG_KEY, "1"); } catch {}
      return true;
    }
    if (params.get("native") === "0") {
      try { localStorage.removeItem(NATIVE_FLAG_KEY); } catch {}
      return false;
    }
    try {
      if (localStorage.getItem(NATIVE_FLAG_KEY) === "1") return true;
    } catch {}
  } catch {
    return false;
  }

  return false;
}
