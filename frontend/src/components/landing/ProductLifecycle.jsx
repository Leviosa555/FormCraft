import { LayoutTemplate, ShieldCheck, GitBranch, Inbox } from "lucide-react";
import { Reveal } from "./Reveal";
import { useTranslation } from "@/lib/i18n";

export function ProductLifecycle() {
  const { t } = useTranslation();

  const steps = [
    { icon: LayoutTemplate, tag: t("dashboard.createForm", "Form Builder"), body: t("landing.step1Desc", "Compose fields visually and arrange your form structure in minutes.") },
    { icon: ShieldCheck, tag: t("landing.statValidation", "Validation"), body: t("landing.feature2Desc", "Attach rules per field — required, formats, ranges, lengths and dates.") },
    { icon: GitBranch, tag: t("landing.statConditional", "Conditional Logic"), body: t("landing.feature1Desc", "Fields show, hide, or become required based on earlier answers.") },
    { icon: Inbox, tag: t("dashboard.responses", "Submission"), body: t("landing.step3Desc", "Every response is validated server-side, stored, analysed and exportable.") },
  ];

  return (
    <section className="bg-surface py-14 sm:py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-8 lg:px-10">
        <Reveal>
          <h2 className="text-center text-2xl font-medium leading-[1.1] tracking-[-0.03em] sm:text-4xl md:text-5xl">
            {t("landing.lifecycleLead", "Simple on the surface.")}
            <br />
            <span className="text-muted-foreground">{t("landing.lifecycleMuted", "Powerful underneath.")}</span>
          </h2>
        </Reveal>

        <div className="relative mt-10 sm:mt-14">
          <div className="absolute bottom-6 left-5 sm:left-6 top-6 w-px bg-border md:left-8" />
          <div className="space-y-3 sm:space-y-4">
            {steps.map((s, i) => (
              <Reveal key={s.tag} delay={i * 0.08}>
                <div className="relative flex gap-3.5 sm:gap-5 rounded-2xl md:rounded-[22px] border border-border bg-background p-4 sm:p-5 md:gap-7 md:p-6">
                  <span className="relative z-10 flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface">
                    <s.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  </span>
                  <div>
                    <p className="text-[10px] sm:text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      {s.tag}
                    </p>
                    <p className="mt-1 sm:mt-2 text-[13px] sm:text-[14px] leading-relaxed text-foreground/85">{s.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>

  );
}

