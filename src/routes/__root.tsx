import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LanguageProvider, useT, type Lang } from "../lib/i18n";
import { Toaster } from "../components/ui/sonner";
import { brandLogoUrl } from "../lib/brand";
import { SiteFooter } from "../components/SiteFooter";
import { InstallGate } from "../components/InstallGate";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "../lib/auth.functions";
import { getActiveTheme } from "../lib/themes.functions";
import { UserCircle } from "lucide-react";
import { useLocation } from "@tanstack/react-router";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-muted-foreground">الصفحة غير موجودة / Page not found</p>
        <Link to="/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground">
          العودة / Home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">حدث خطأ غير متوقع</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">إعادة المحاولة</button>
          <a href="/" className="rounded-md border px-4 py-2">الرئيسية</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#169CA3" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "بصمة حكاية" },
      { name: "application-name", content: "بصمة حكاية" },
      { title: "بصمة حكاية — حكايتك أنت، لا تشبه أحداً" },
      { name: "description", content: "منصة لإنشاء قصص مخصصة بملامحك أنت. ارفع صورتك، اختر جوّك، واحصل على حكاية فريدة." },
      { property: "og:title", content: "بصمة حكاية — حكايتك أنت، لا تشبه أحداً" },
      { property: "og:description", content: "منصة لإنشاء قصص مخصصة بملامحك أنت. ارفع صورتك، اختر جوّك، واحصل على حكاية فريدة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "بصمة حكاية — حكايتك أنت، لا تشبه أحداً" },
      { name: "twitter:description", content: "منصة لإنشاء قصص مخصصة بملامحك أنت. ارفع صورتك، اختر جوّك، واحصل على حكاية فريدة." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/T5QwGL7BdxM22WLZokA0sQbrC1F2/social-images/social-1782599705849-شعار_بصمة_حكاية_.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/T5QwGL7BdxM22WLZokA0sQbrC1F2/social-images/social-1782599705849-شعار_بصمة_حكاية_.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { rel: "icon", href: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png", sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function ThemeBanner() {
  const { lang } = useT();
  const fn = useServerFn(getActiveTheme);
  const q = useQuery({ queryKey: ["active-theme"], queryFn: () => fn(), staleTime: 5 * 60_000 });
  const theme = q.data as
    | (null | {
        accent_color: string | null;
        banner_text_ar: string | null; banner_text_en: string | null;
        banner_url: string | null;
        header_title_ar: string | null; header_title_en: string | null;
        header_size: string | null;
        palette: string[] | null;
      });
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (theme?.accent_color) {
      document.documentElement.style.setProperty("--accent", theme.accent_color);
    } else {
      document.documentElement.style.removeProperty("--accent");
    }
  }, [theme?.accent_color]);
  if (!theme) return null;
  const bannerText = lang === "ar" ? theme.banner_text_ar : theme.banner_text_en;
  const headerTitle = lang === "ar" ? theme.header_title_ar : theme.header_title_en;
  if (!bannerText && !headerTitle) return null;
  const size = theme.header_size ?? "md";
  const titleClass =
    size === "xl" ? "text-2xl md:text-3xl"
    : size === "lg" ? "text-xl md:text-2xl"
    : size === "sm" ? "text-sm md:text-base"
    : "text-base md:text-lg";
  const palette = theme.palette ?? [];
  const gradient = palette.length >= 2
    ? `linear-gradient(to right, ${palette[0]}22, ${palette[Math.min(2, palette.length - 1)]}33, ${palette[palette.length - 1]}22)`
    : undefined;
  return (
    <div
      className="border-b text-center py-2 px-3"
      style={{
        background: gradient,
        borderColor: theme.accent_color ? `${theme.accent_color}44` : undefined,
      }}
    >
      {headerTitle && (
        <div className={`${titleClass} font-extrabold`} style={{ color: theme.accent_color ?? undefined }}>
          {headerTitle}
        </div>
      )}
      {bannerText && (
        <div className="mt-0.5 text-xs font-medium text-foreground/80">
          {bannerText}{" "}
          {theme.banner_url && (
            <a href={theme.banner_url} className="underline text-primary" target="_blank" rel="noopener noreferrer">
              {lang === "ar" ? "اعرف أكثر" : "Learn more"}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function Header() {
  const { lang, setLang, t } = useT();
  const meFn = useServerFn(getCurrentUser);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn(), staleTime: 30_000 });
  const me = meQ.data;
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const links = (
    <>
      <Link to="/create" className="rounded-md px-3 py-2 hover:bg-secondary font-medium">{t("nav_create")}</Link>
      {me ? (
        <Link to="/my-orders" className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 hover:bg-secondary font-medium">
          <UserCircle className="size-4" />
          {t("nav_my_orders")}
        </Link>
      ) : (
        <Link to="/auth" className="rounded-md px-3 py-2 hover:bg-secondary font-medium">{t("nav_login")}</Link>
      )}
      {/* Admin link intentionally hidden — accessible only via direct URL /admin/login */}
    </>
  );

  return (
    <header
      className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto grid min-h-[60px] max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 lg:flex lg:justify-between">
        <Link to="/" className="flex min-w-0 items-center gap-2 font-bold">
          <img
            src={brandLogoUrl}
            alt=""
            className="h-12 w-12 shrink-0 object-contain drop-shadow-md animate-logo-float sm:h-14 sm:w-14 md:h-16 md:w-16"
          />
          <span className="truncate text-sm text-foreground sm:text-base md:text-lg lg:text-xl">{t("brand")}</span>
        </Link>

        {/* Desktop nav (≥lg to give tablets room) */}
        <nav className="hidden items-center gap-1 text-sm lg:flex">
          {links}
          <LangSwitch lang={lang} setLang={setLang} />
        </nav>

        {/* Mobile + tablet actions */}
        <div className="flex shrink-0 items-center gap-1 lg:hidden">
          <LangSwitch lang={lang} setLang={setLang} compact />
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border p-2 hover:bg-secondary"
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile/tablet dropdown */}
      {open && (
        <div className="border-t bg-background lg:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-3 py-2 text-sm">
            {links}
          </nav>
        </div>
      )}
    </header>
  );
}

const LANG_OPTIONS: { code: Lang; short: string; label: string }[] = [
  { code: "ar", short: "ع", label: "العربية" },
  { code: "en", short: "EN", label: "English" },
  { code: "ku", short: "ک", label: "کوردی" },
];

function LangSwitch({ lang, setLang, compact = false }: { lang: Lang; setLang: (l: Lang) => void; compact?: boolean }) {
  return (
    <div
      role="group"
      aria-label="Language"
      className={`inline-flex items-center overflow-hidden rounded-md border ${compact ? "text-[11px]" : "text-xs"}`}
    >
      {LANG_OPTIONS.map((o) => {
        const active = lang === o.code;
        return (
          <button
            key={o.code}
            type="button"
            onClick={() => setLang(o.code)}
            className={`${compact ? "px-1.5 py-1" : "px-2 py-1.5"} font-medium transition ${active ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            aria-pressed={active}
            title={o.label}
          >
            {compact ? o.short : o.label}
          </button>
        );
      })}
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <InstallGate>
          <ThemeBanner />
          <Header />
          <main className="min-h-[calc(100vh-220px)]">
            <Outlet />
          </main>
          <SiteFooter />
        </InstallGate>
        <Toaster richColors position="top-center" />
      </LanguageProvider>
    </QueryClientProvider>
  );
}
