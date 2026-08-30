import { Check } from "lucide-react";
import { Reveal, SectionHeading } from "./Reveal";
import { useTranslation } from "@/lib/i18n";

export function ValidationShowcase() {
  const { t } = useTranslation();

  const rules = [
    [t("builder.email", "Email"), t("landing.valRuleEmail", "Valid email format")],
    [t("builder.number", "Age"), t("landing.valRuleAge", "Minimum: 18 · Maximum: 65")],
    [t("builder.text", "Name"), t("landing.valRuleName", "Letters only")],
  ];

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8 sm:py-24 lg:px-10 md:py-32">
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
        <Reveal>
          <SectionHeading
            lead={t("landing.validationHeadingLead", "Validate before")}
            muted={t("landing.validationHeadingMuted", "the response arrives.")}
          />
          <p className="mt-3.5 sm:mt-5 max-w-md text-[13.5px] sm:text-[14.5px] leading-relaxed text-muted-foreground">
            {t(
              "landing.validationSubtitle",
              "Every submission is checked on the server against the rules you configured, so bad data never reaches your response table."
            )}
          </p>
        </Reveal>

        <div className="rounded-2xl sm:rounded-[24px] border border-border bg-background p-4 sm:p-6 shadow-xs">
          {rules.map(([field, rule], i) => (
            <Reveal key={field} delay={i * 0.1}>
              <div className="flex items-center justify-between border-b border-border py-3 sm:py-4 last:border-0">
                <p className="text-[13px] sm:text-[13.5px] font-medium">{field}</p>
                <p className="flex items-center gap-1.5 sm:gap-2 text-[11.5px] sm:text-[12.5px] text-muted-foreground text-right">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/12">
                    <Check className="h-2.5 w-2.5 text-primary" />
                  </span>
                  <span>{rule}</span>
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

  );
}

