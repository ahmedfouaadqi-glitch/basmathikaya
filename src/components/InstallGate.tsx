import { useEffect, useState, type ReactNode } from "react";
import { useT } from "../lib/i18n";
import { brandLogoUrl } from "../lib/brand";
import { Share2, Plus, Smartphone, Sparkles, Zap, Home } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "basma-install-dismissed-at"; // only for non-installable Android fallback throttle

function isPreviewHost(host: string) {
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

function detectEnv() {
  if (typeof window === "undefined") {
    return { gateAllowed: false, isMobile: false, isIOS: false, isStandalone: false };
  }
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isTablet = /Tablet|iPad/i.test(ua) || (isAndroid && !/Mobile/i.test(ua));
  const isPhone = /Mobi/i.test(ua) && !isTablet;
  const isMobile = isIOS || isAndroid || isPhone || isTablet || window.innerWidth < 900;

  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches ||
    (navigator as any).standalone === true;

  const inIframe = window.self !== window.top;
  const params = new URLSearchParams(window.location.search);
  const swOff = params.get("sw") === "off" || params.get("install") === "off";

  const gateAllowed = isMobile && !isStandalone && !inIframe && !isPreviewHost(window.location.hostname) && !swOff;

  return { gateAllowed, isMobile, isIOS, isStandalone };
}

export function InstallGate({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const { lang, t } = useT();

  useEffect(() => {
    const env = detectEnv();
    setIsIOS(env.isIOS);
    setShow(env.gateAllowed);
    if (!env.gateAllowed) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setBip(e as BIPEvent);
    };
    const onInstalled = () => {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
      setShow(false);
    };
    window.addEventListener("beforeinstallprompt", onBip as any);
    window.addEventListener("appinstalled", onInstalled);

    const mq = window.matchMedia("(display-mode: standalone)");
    const onMq = () => { if (mq.matches) setShow(false); };
    mq.addEventListener?.("change", onMq);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip as any);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener?.("change", onMq);
    };
  }, []);

  if (!show) return <>{children}</>;

  async function doInstall() {
    if (!bip) return;
    setInstalling(true);
    try {
      await bip.prompt();
      const res = await bip.userChoice;
      if (res.outcome === "accepted") {
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
        setShow(false);
      }
    } finally {
      setInstalling(false);
      setBip(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-gradient-to-br from-[#FFFBF5] via-[#FFF3DF] to-[#CDEEF0]"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md text-center">
          <img
            src={brandLogoUrl}
            alt="بصمة حكاية"
            className="mx-auto h-32 w-32 object-contain drop-shadow-lg"
          />
          <h1 className="mt-4 text-2xl font-extrabold text-[#0B5B60]">
            {t("install_title")}
          </h1>
          <p className="mt-2 text-sm text-foreground/70 leading-relaxed">
            {t("install_subtitle")}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2 text-[11px]">
            <Benefit icon={<Zap className="size-5" />} label={t("install_benefit_fast")} />
            <Benefit icon={<Sparkles className="size-5" />} label={t("install_benefit_app")} />
            <Benefit icon={<Home className="size-5" />} label={t("install_benefit_home")} />
          </div>

          {isIOS ? (
            <IOSInstructions t={t} lang={lang} />
          ) : (
            <div className="mt-7 space-y-3">
              <button
                onClick={doInstall}
                disabled={!bip || installing}
                className="w-full rounded-xl bg-[#169CA3] px-6 py-3.5 text-base font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
              >
                <Smartphone className="inline-block size-5 -mt-0.5 me-2" />
                {installing ? t("install_installing") : t("install_button")}
              </button>
              {!bip && (
                <p className="text-xs text-foreground/60 leading-relaxed">
                  {t("install_hint_menu")}
                </p>
              )}
            </div>
          )}

          <p className="mt-8 text-[11px] text-foreground/50">
            {t("install_desktop_hint")}
          </p>
        </div>
      </div>
    </div>
  );
}

function Benefit({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="rounded-xl bg-white/70 backdrop-blur p-3 flex flex-col items-center gap-1 text-foreground/80">
      <span className="text-[#D4A537]">{icon}</span>
      <span className="font-semibold leading-tight">{label}</span>
    </div>
  );
}

function IOSInstructions({ t, lang }: { t: (k: any) => string; lang: "ar" | "en" | "ku" }) {
  return (
    <div className="mt-7 rounded-2xl bg-white/80 backdrop-blur p-4 text-start">
      <p className="text-sm font-bold text-[#0B5B60] text-center mb-3">
        {t("install_ios_title")}
      </p>
      <ol className="space-y-3 text-sm">
        <li className="flex items-start gap-3">
          <span className="flex-none mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-[#169CA3] text-white text-xs font-bold">1</span>
          <span className="flex-1 flex items-center gap-2">
            {t("install_ios_step1")}
            <Share2 className="size-5 text-[#169CA3]" />
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex-none mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-[#169CA3] text-white text-xs font-bold">2</span>
          <span className="flex-1 flex items-center gap-2">
            {t("install_ios_step2")}
            <Plus className="size-5 text-[#169CA3]" />
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex-none mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-[#169CA3] text-white text-xs font-bold">3</span>
          <span className="flex-1">{t("install_ios_step3")}</span>
        </li>
      </ol>
      <p className="mt-3 text-[11px] text-foreground/60 text-center">
        {lang === "ar"
          ? "افتح الموقع في Safari إن كنت داخل تطبيق آخر."
          : "Open this site in Safari if you're inside another app."}
      </p>
    </div>
  );
}
