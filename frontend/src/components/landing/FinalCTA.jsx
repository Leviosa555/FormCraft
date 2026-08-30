import { ArrowRight, ChevronUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Reveal } from "./Reveal";
import { useTranslation } from "@/lib/i18n";

export function FinalCTA() {
  const { t } = useTranslation();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section id="cta" className="relative overflow-hidden bg-ink text-ink-foreground">
      {/* Subtle ambient lighting */}
      <div className="pointer-events-none absolute left-1/2 top-0 -z-0 h-64 w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-[1400px] px-4 py-10 sm:px-8 sm:py-14 lg:px-10 md:py-18">
        <Reveal>
          <div className="grid gap-6 sm:gap-8 rounded-2xl sm:rounded-[24px] border border-ink-border bg-white/[0.02] p-5 sm:p-10 backdrop-blur-xs md:grid-cols-2 md:items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-ink-border bg-white/[0.04] px-3 py-0.5 text-[10.5px] sm:text-[11px] font-medium text-primary">
                <span>{t("landing.badge", "Modern Form Platform")}</span>
              </div>
              <h2 className="mt-3 sm:mt-4 text-2xl font-medium leading-[1.1] tracking-[-0.03em] sm:text-4xl md:text-5xl">
                {t("landing.ctaHeading", "Ready to build smarter forms?")}
              </h2>
            </div>

            <div>
              <p className="max-w-md text-[13px] sm:text-[14px] leading-relaxed text-ink-muted">
                {t("landing.ctaSubheading", "Join thousands of builders collecting clean, validated data with dynamic conditional logic and AI automation.")}
              </p>

              <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-3">
                <Link
                  to="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 shadow-xs"
                >
                  {t("landing.ctaButton", "Create Your Free Workspace")} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Minimal clean footer strip */}
        <div className="mt-8 sm:mt-12 flex flex-col items-center justify-between gap-4 border-t border-ink-border pt-6 sm:flex-row text-[11.5px] sm:text-[12px] text-ink-muted text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <span>© {new Date().getFullYear()} FormCraft. {t("landing.footerRights", "All rights reserved.")}</span>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 text-[11.5px] sm:text-[12px]">
            <a href="#product" className="transition-colors hover:text-ink-foreground">{t("nav.product", "Product")}</a>
            <a href="#features" className="transition-colors hover:text-ink-foreground">{t("nav.features", "Features")}</a>
            <a href="#how-it-works" className="transition-colors hover:text-ink-foreground">{t("nav.howItWorks", "How it Works")}</a>
            <button
              onClick={scrollToTop}
              className="inline-flex items-center gap-1 text-ink-muted transition-colors hover:text-ink-foreground"
            >
              <span>Top</span>
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>

  );
}

