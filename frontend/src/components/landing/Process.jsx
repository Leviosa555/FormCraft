import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "./Reveal";
import { useTranslation } from "@/lib/i18n";

export function Process() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const steps = [
    ["01", t("landing.stepBuild", "Build"), t("landing.stepBuildDesc", "Create your form.")],
    ["02", t("landing.stepConfigure", "Configure"), t("landing.stepConfigureDesc", "Add validation and logic.")],
    ["03", t("landing.stepPublish", "Publish"), t("landing.stepPublishDesc", "Share your form.")],
    ["04", t("landing.stepCollect", "Collect"), t("landing.stepCollectDesc", "Manage responses.")],
  ];

  return (
    <section id="how-it-works" className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8 sm:py-24 lg:px-10 md:py-32">
      <Reveal>
        <h2 className="text-2xl font-medium leading-[1.1] tracking-[-0.03em] sm:text-4xl md:text-5xl">
          {t("landing.processHeadingLead", "How it works.")}
          <br />
          <span className="text-muted-foreground">{t("landing.processHeadingMuted", "Four deliberate steps.")}</span>
        </h2>
      </Reveal>

      <div className="relative mt-8 sm:mt-14">
        {/* desktop line */}
        <div className="absolute left-0 right-0 top-[5px] hidden h-px bg-border md:block">
          <motion.span
            className="block h-px bg-primary"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            style={{ transformOrigin: "left" }}
            transition={{ duration: reduce ? 0 : 1.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        {/* mobile line */}
        <div className="absolute bottom-2 left-[5px] top-2 w-px bg-border md:hidden" />

        <div className="grid gap-6 md:grid-cols-4 md:gap-6">
          {steps.map(([n, title, desc], i) => (
            <Reveal key={n} delay={i * 0.1}>
              <div className="relative flex gap-4 sm:gap-5 pl-5 sm:pl-6 md:block md:pl-0">
                <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border border-primary bg-background md:relative md:top-0 md:mb-6 md:block" />
                <div>
                  <p className="font-mono text-[11px] text-muted-foreground">{n}</p>
                  <h3 className="mt-1 sm:mt-2 text-[14.5px] sm:text-[15px] font-medium tracking-[-0.01em]">{title}</h3>
                  <p className="mt-1 sm:mt-1.5 text-[13px] sm:text-[13.5px] text-muted-foreground">{desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

  );
}

