import { ArrowRight } from "lucide-react";
import { Reveal, SectionHeading } from "./Reveal";
import { TypewriterOnView } from "./Typewriter";
import { useTranslation } from "@/lib/i18n";

export function ProductStory() {
  const { t } = useTranslation();

  const formFields = [
    [t("builder.text", "Full Name"), "Ana Whitfield"],
    [t("builder.email", "Email"), "ana@formcraft.io"],
    [t("builder.number", "Age"), "24"],
    [t("builder.dropdown", "Course"), "Applied Data Science"],
    [t("builder.file", "Driving License"), "DL-4471-8823"],
  ];

  const indicators = [
    t("dashboard.createForm", "Builder"),
    t("landing.statValidation", "Validation"),
    t("landing.statConditional", "Logic"),
    t("dashboard.responses", "Responses"),
  ];

  return (
    <section className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8 lg:px-10 md:py-20">
      <Reveal>
        <SectionHeading
          lead={t("landing.storyLead", "From blank canvas")}
          muted={t("landing.storyMuted", "to working form.")}
        />
      </Reveal>

      <Reveal delay={0.06}>
        <div className="mt-8 grid gap-3 rounded-[22px] border border-border p-3 sm:p-5 lg:grid-cols-2">
          {/* Form preview */}
          <div className="rounded-[18px] border border-border bg-background p-5">
            <p className="text-[12.5px] font-medium tracking-[-0.01em]">{t("dashboard.modalFormTitle", "Registration Form")}</p>
            <div className="mt-4 space-y-2.5">
              {formFields.map(([l, v], i) => (
                <div key={l}>
                  <p className="text-[10.5px] text-muted-foreground">{l}</p>
                  <div className="mt-1 flex h-8 items-center rounded-lg border border-border bg-surface/60 px-3 text-[11.5px] text-foreground/80">
                    <TypewriterOnView text={v ?? ""} startDelay={300 + i * 850} />
                  </div>
                </div>
              ))}
            </div>
            <button
              disabled
              className="mt-5 inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-muted px-3.5 py-2 text-[11.5px] font-medium text-muted-foreground"
            >
              {t("publicForm.submit", "Submit Application")} <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Info panel */}
          <div className="flex flex-col justify-between rounded-[18px] bg-surface p-5 sm:p-6">
            <p className="max-w-sm text-lg font-medium leading-snug tracking-[-0.02em] sm:text-xl">
              {t("landing.storySubtitle", "Build structured forms in minutes, then control exactly how they behave.")}
            </p>
            <ul className="mt-6 divide-y divide-border border-y border-border">
              {[
                [t("landing.statFields", "Fields"), t("landing.step1Desc", "Ten field types, arranged in any order.")],
                [t("landing.statValidation", "Rules"), t("landing.feature2Desc", "Validation attached per field, enforced server-side.")],
                [t("landing.statConditional", "Logic"), t("landing.feature1Desc", "Fields adapt dynamically based on previous responses.")],
                [t("dashboard.responses", "Responses"), t("landing.feature6Desc", "Filter, analyse and export submissions as CSV.")],
              ].map(([title, d]) => (
                <li key={title} className="flex gap-4 py-2.5">
                  <span className="w-20 shrink-0 text-[11.5px] font-medium">{title}</span>
                  <span className="text-[11.5px] leading-relaxed text-muted-foreground">{d}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
              {indicators.map((tag, i) => (
                <div
                  key={tag}
                  className={`bg-background px-2.5 py-2.5 text-center text-[11px] ${
                    i === 0 ? "text-primary font-medium" : "text-muted-foreground"
                  }`}
                >
                  {tag}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

