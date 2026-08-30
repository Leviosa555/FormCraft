import {
  LayoutTemplate,
  ShieldCheck,
  GitBranch,
  Type,
  Inbox,
  Share2,
} from "lucide-react";
import { Reveal, SectionHeading } from "./Reveal";
import { useTranslation } from "@/lib/i18n";

export function FeaturesGrid() {
  const { t } = useTranslation();

  const features = [
    { n: "01", icon: GitBranch, title: t("landing.feature1Title", "Conditional Field Logic"), body: t("landing.feature1Desc", "Create intelligent forms that adapt in real time. Show, hide, or require fields dynamically based on responses.") },
    { n: "02", icon: ShieldCheck, title: t("landing.feature2Title", "Server-Enforced Validation"), body: t("landing.feature2Desc", "Strict type, range, regex, and file size checks guarantee that only clean, compliant data enters your database.") },
    { n: "03", icon: Share2, title: t("landing.feature3Title", "Real-Time Email OTP Verification"), body: t("landing.feature3Desc", "Ensure verified respondents and prevent spam with instant 6-digit email OTP verification codes.") },
    { n: "04", icon: LayoutTemplate, title: t("landing.feature4Title", "AI Form Studio"), body: t("landing.feature4Desc", "Describe any form in natural language and let Google Gemini / Sarvam AI generate full schemas with rules in seconds.") },
    { n: "05", icon: Type, title: t("landing.feature5Title", "Single-Use One-Time Links"), body: t("landing.feature5Desc", "Generate tamper-proof single-use links that automatically lock out respondents after a single submission.") },
    { n: "06", icon: Inbox, title: t("landing.feature6Title", "Instant CSV & JSON Exports"), body: t("landing.feature6Desc", "Inspect submissions in real time, filter by fields, and download full datasets in standard CSV and JSON.") },
  ];

  return (
    <section id="features" className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8 sm:py-24 lg:px-10 md:py-32">
      <Reveal>
        <SectionHeading lead={t("landing.featuresHeading", "Everything you need")} muted={t("landing.featuresSubheading", "to build better forms.")} />
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-8 sm:mt-12 grid overflow-hidden rounded-2xl sm:rounded-[24px] border border-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.n}
              className="group relative -mt-px -ml-px border-t border-l border-border p-5 sm:p-7 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/25 hover:bg-surface/60"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-8.5 w-8.5 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-border bg-background transition-transform duration-300 group-hover:-translate-y-0.5">
                  <f.icon className="h-4 w-4 text-primary" />
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">{f.n}</span>
              </div>
              <h3 className="mt-4 sm:mt-6 text-[14.5px] sm:text-[15px] font-medium tracking-[-0.01em]">{f.title}</h3>
              <p className="mt-1.5 sm:mt-2 text-[13px] sm:text-[13.5px] leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>

  );
}

