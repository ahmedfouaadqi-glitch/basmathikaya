import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LanguageProvider, useT } from "../lib/i18n";
import { Toaster } from "../components/ui/sonner";
import { brandLogoUrl } from "../lib/brand";
import { SiteFooter } from "../components/SiteFooter";
import { InstallGate } from "../components/InstallGate";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "../lib/auth.functions";
import { getActiveTheme } from "../lib/themes.functions";
import { UserCircle } from "lucide-react";

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
  const theme = q.data;
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (theme?.accent_color) {
      document.documentElement.style.setProperty("--accent", theme.accent_color);
    } else {
      document.documentElement.style.removeProperty("--accent");
    }
  }, [theme?.accent_color]);
  if (!theme) return null;
  const text = lang === "ar" ? theme.banner_text_ar : theme.banner_text_en;
  if (!text) return null;
  return (
    <div className="bg-gradient-to-r from-accent/30 via-primary/15 to-accent/30 border-b text-center text-xs font-medium text-foreground py-1.5 px-3">
      {text}{" "}
      {theme.banner_url && (
        <a href={theme.banner_url} className="underline text-primary" target="_blank" rel="noopener noreferrer">
          {lang === "ar" ? "اعرف أكثر" : "Learn more"}
        </a>
      )}
    </div>
  );
}

function Header() {
  const { lang, setLang, t } = useT();
  const meFn = useServerFn(getCurrentUser);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn(), staleTime: 30_000 });
  const me = meQ.data;
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5 font-bold text-lg">
          <img src={brandLogoUrl} alt="" className="h-14 w-14 object-contain md:h-16 md:w-16 drop-shadow-sm" />
          <span className="text-foreground text-base md:text-lg">{t("brand")}</span>
        </Link>
        <nav className="flex items-center gap-1.5 text-sm">
          <Link to="/create" className="rounded-md px-3 py-1.5 hover:bg-secondary font-medium">{t("nav_create")}</Link>
          {me ? (
            <Link to="/my-orders" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary font-medium">
              <UserCircle className="size-4" />
              {t("nav_my_orders")}
            </Link>
          ) : (
            <Link to="/auth" className="rounded-md px-3 py-1.5 hover:bg-secondary font-medium">{t("nav_login")}</Link>
          )}
          <Link to="/admin" className="rounded-md px-3 py-1.5 hover:bg-secondary text-muted-foreground">{t("nav_admin")}</Link>
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
            aria-label="Toggle language"
          >
            {lang === "ar" ? "EN" : "ع"}
          </button>
        </nav>
      </div>
    </header>
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
