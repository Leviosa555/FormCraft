import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "./Reveal";
import { useTranslation } from "@/lib/i18n";

export function LogicShowcase() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const nodes = [
    t("landing.nodeAge", "Age"),
    t("landing.nodeGreaterThan", "Greater than"),
    "18",
    t("landing.nodeShow", "Show"),
    t("landing.nodeLicense", "Driving License Number"),
  ];

  return (
    <section className="bg-ink py-14 sm:py-24 text-ink-foreground md:py-32">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8 lg:px-10">
        <Reveal>
          <h2 className="text-2xl font-medium leading-[1.1] tracking-[-0.03em] sm:text-4xl md:text-5xl">
            {t("landing.logicHeadingLead", "Make every form")}
            <br />
            <span className="text-ink-muted">
              {t("landing.logicHeadingMuted", "respond intelligently.")}
            </span>
          </h2>
          <p className="mt-3.5 sm:mt-5 max-w-lg text-[13.5px] sm:text-[14.5px] leading-relaxed text-ink-muted">
            {t("landing.logicSubtitle", "Show, hide, or require fields based on what your users enter.")}
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="relative mt-8 sm:mt-14 overflow-hidden rounded-2xl sm:rounded-[24px] border border-ink-border p-4 sm:p-10">
            <div className="relative flex flex-col items-stretch gap-2.5 sm:gap-3 md:flex-row md:items-center">
              {/* animated travelling line */}
              <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden h-px bg-ink-border md:block">
                {!reduce && (
                  <motion.span
                    className="absolute top-1/2 h-px w-24 -translate-y-1/2 bg-primary"
                    initial={{ left: "0%", opacity: 0 }}
                    whileInView={{ left: ["0%", "100%"], opacity: [0, 1, 0] }}
                    viewport={{ once: false }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </div>

              {nodes.map((n, i) => (
                <div key={n} className="relative z-10 flex items-center gap-2.5 sm:gap-3 md:flex-1">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: i * 0.1 }}
                    className={`w-full rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3 text-center text-[11.5px] sm:text-[12.5px] ${
                      i === nodes.length - 1
                        ? "border-primary/50 text-ink-foreground"
                        : "border-ink-border bg-ink text-ink-foreground/85"
                    }`}
                    style={
                      i === nodes.length - 1
                        ? { backgroundColor: "color-mix(in oklch, var(--primary) 20%, var(--ink))" }
                        : {}
                    }
                  >
                    {n}
                  </motion.div>
                </div>
              ))}
            </div>
            <p className="mt-5 sm:mt-8 text-center font-mono text-[10.5px] sm:text-[11px] text-ink-muted">
              IF age &gt; 18 → SHOW driving_license_number
            </p>
          </div>
        </Reveal>
      </div>
    </section>

  );
}

