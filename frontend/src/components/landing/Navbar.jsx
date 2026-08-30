import { useEffect, useState } from "react";
import { ArrowRight, Menu, Smartphone, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "@/lib/i18n";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { triggerPWAInstall } from "@/components/common/InstallPWA";


export function Navbar() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const links = [
    { label: t("nav.product", "Product"), href: "#product" },
    { label: t("nav.features", "Features"), href: "#features" },
    { label: t("nav.howItWorks", "How it Works"), href: "#how-it-works" },
    { label: t("nav.resources", "Resources"), href: "#resources" },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-xl shadow-xs"
          : "border-b border-transparent bg-background/0"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 sm:px-8 lg:px-10">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-[11px] font-semibold tracking-tight text-primary-foreground">
            FC
          </span>
          <span className="text-[15px] font-medium tracking-[-0.02em]">FormCraft</span>
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <LanguageSelector />
          <Link
            to="/login"
            className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("nav.login", "Log in")}
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {t("nav.getStarted", "Get Started")} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <LanguageSelector />
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-b border-border bg-background/95 backdrop-blur-2xl px-5 py-4 md:hidden shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-3.5">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-[14px] font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                {l.label}
              </a>
            ))}
            <div className="h-px bg-border/60 my-1" />
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  triggerPWAInstall();
                }}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-xs font-medium text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 transition-colors shadow-2xs"
              >
                <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                <span>{t("pwa.installApp", "Install App")}</span>
              </button>

              <Link
                to="/login"

                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-xl border border-border py-2.5 text-xs font-medium text-foreground hover:bg-surface transition-colors"
              >
                {t("nav.login", "Log in")}
              </Link>
              <Link
                to="/register"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-medium text-primary-foreground shadow-xs hover:opacity-90 transition-opacity"
              >
                {t("nav.getStarted", "Get Started")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

          </div>
        </div>
      )}
    </header>
  );
}
