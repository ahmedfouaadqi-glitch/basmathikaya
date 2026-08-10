import { useT } from "../lib/i18n";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { tiktokUrl, FOOTER_TAGLINE_AR, FOOTER_TAGLINE_EN } from "../lib/brand";
import { getHomeContent, DEFAULT_HOME_CONTENT } from "../lib/site-content.functions";

export function SiteFooter() {
  const { lang, t } = useT();
  const tagline = lang === "ar" ? FOOTER_TAGLINE_AR : FOOTER_TAGLINE_EN;
  const fn = useServerFn(getHomeContent);
  const q = useQuery({ queryKey: ["site-home"], queryFn: () => fn(), staleTime: 60_000 });
  const c = q.data ?? DEFAULT_HOME_CONTENT;
  const disclaimer = lang === "ar" ? c.disclaimer_ar : c.disclaimer_en;

  return (
    <footer className="mt-16 border-t bg-card/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-6 text-center text-sm text-muted-foreground md:flex-row md:justify-between md:text-start">
        <div>
          <div className="font-bold text-foreground">{tagline}</div>
          <div className="mt-0.5 text-xs">© {new Date().getFullYear()} {t("brand")}</div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            to="/privacy"
            className="rounded-md px-3 py-1.5 text-xs font-medium hover:bg-secondary"
          >
            سياسة الخصوصية
          </Link>
          <a
            href={tiktokUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-background px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <TikTokIcon className="size-4" />
            {t("tiktok_follow")}
          </a>
        </div>
      </div>
      <div className="border-t bg-background/60">
        <div className="mx-auto max-w-6xl px-4 py-3 text-[11px] leading-relaxed text-muted-foreground text-center">
          {disclaimer}
        </div>
      </div>
    </footer>
  );
}

export function TikTokIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M16.5 3a5.5 5.5 0 0 0 5 5v3a8.5 8.5 0 0 1-5-1.62V15a6 6 0 1 1-6-6c.34 0 .68.03 1 .09v3.16a3 3 0 1 0 2 2.83V3h3z" />
    </svg>
  );
}
