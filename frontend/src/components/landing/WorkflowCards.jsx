import { Reveal } from "./Reveal";
import { useTranslation } from "@/lib/i18n";

export function WorkflowCards() {
  const { t } = useTranslation();

  const cards = [
    ["01", t("landing.wf1Title", "Contact"), t("landing.wf1Desc", "Simple inbound enquiries routed into one response inbox.")],
    ["02", t("landing.wf2Title", "Registration"), t("landing.wf2Desc", "Collect attendee details with age and eligibility rules.")],
    ["03", t("landing.wf3Title", "Application"), t("landing.wf3Desc", "Multi-field applications with documents and file uploads.")],
    ["04", t("landing.wf4Title", "Feedback"), t("landing.wf4Desc", "Structured ratings and comments, ready for CSV export.")],
  ];

  return (
    <section id="resources" className="bg-surface py-14 sm:py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-10">
        <Reveal>
          <h2 className="text-2xl font-medium leading-[1.1] tracking-[-0.03em] sm:text-4xl md:text-5xl">
            {t("landing.workflowHeadingLead", "One builder.")}
            <br />
            <span className="text-muted-foreground">
              {t("landing.workflowHeadingMuted", "Countless workflows.")}
            </span>
          </h2>
        </Reveal>

        <div className="mt-8 sm:mt-12 grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([n, title, desc], i) => (
            <Reveal key={n} delay={i * 0.06}>
              <div
                className="group flex h-full flex-col rounded-2xl md:rounded-[22px] border border-border bg-background p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:bg-card"
              >
                <span className="font-mono text-[11px] text-primary">{n}</span>
                <h3 className="mt-4 sm:mt-8 text-[14.5px] sm:text-[15px] font-medium tracking-[-0.01em]">{title}</h3>
                <p className="mt-1.5 sm:mt-2 text-[12.5px] sm:text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

  );
}

