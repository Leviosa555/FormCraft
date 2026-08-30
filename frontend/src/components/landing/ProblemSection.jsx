import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { AlertCircle, Check, GitBranch } from "lucide-react";
import { Reveal, SectionHeading } from "./Reveal";
import { useTranslation } from "@/lib/i18n";


const points = [
  ["01", "Rigid Forms", "Static forms cannot adapt to what users enter."],
  ["02", "Weak Validation", "Bad data creates problems long after submission."],
  ["03", "Scattered Responses", "Responses should be easy to manage."],
];

function FormWireframe() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const show = inView ? "show" : "hidden";

  return (
    <div ref={ref} className="rounded-[22px] border border-border bg-secondary/40 p-5">
      <div className="flex items-center justify-between">
        <div className="h-2 w-24 rounded-full bg-foreground/15" />
        <span className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          preview
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {/* adapts to input */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-xl border border-border bg-background p-3"
        >
          <div className="h-1.5 w-16 rounded-full bg-foreground/15" />
          <motion.div
            initial={{ boxShadow: "0 0 0 0px color-mix(in oklab, var(--primary) 0%, transparent)" }}
            animate={inView ? { boxShadow: ["0 0 0 0px color-mix(in oklab, var(--primary) 0%, transparent)", "0 0 0 3px color-mix(in oklab, var(--primary) 18%, transparent)", "0 0 0 0px color-mix(in oklab, var(--primary) 0%, transparent)"] } : {}}
            transition={{ duration: 1.6, delay: 0.5, repeat: Infinity, repeatDelay: 2.4 }}
            className="mt-2 flex h-8 items-center overflow-hidden rounded-lg border border-border bg-secondary/60 px-2"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={inView ? { width: ["0%", "62%", "62%", "0%"] } : {}}
              transition={{ duration: 3.2, delay: 0.5, times: [0, 0.35, 0.8, 1], repeat: Infinity, repeatDelay: 0.8 }}
              className="h-1.5 rounded-full bg-foreground/20"
            />
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="ml-0.5 h-3.5 w-px bg-foreground/40"
            />
          </motion.div>
          <motion.div
            variants={{ hidden: { opacity: 0, x: -6 }, show: { opacity: 1, x: 0 } }}
            initial="hidden"
            animate={show}
            transition={{ duration: 0.4, delay: 1.1 }}
            className="mt-2 flex items-center gap-1.5 text-[11px] text-primary"
          >
            <GitBranch className="h-3 w-3" />
            <span className="font-mono">adapts to answer</span>
          </motion.div>
        </motion.div>

        {/* validation */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="rounded-xl border border-border bg-background p-3"
        >
          <div className="h-1.5 w-20 rounded-full bg-foreground/15" />
          <motion.div
            animate={inView ? { x: [0, -4, 4, -3, 3, 0] } : {}}
            transition={{ duration: 0.5, delay: 1.5, repeat: Infinity, repeatDelay: 3.5 }}
            className="mt-2 h-8 rounded-lg border border-destructive/40 bg-destructive/5"
          />
          <motion.div
            variants={{ hidden: { opacity: 0, y: -4 }, show: { opacity: 1, y: 0 } }}
            initial="hidden"
            animate={show}
            transition={{ duration: 0.35, delay: 1.7 }}
            className="mt-2 flex items-center gap-1.5 text-[11px] text-destructive"
          >
            <AlertCircle className="h-3 w-3" />
            <span className="font-mono">caught before submit</span>
          </motion.div>
        </motion.div>

        {/* responses */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="rounded-xl border border-border bg-background p-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-1.5 w-24 rounded-full bg-foreground/15" />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={inView ? { scale: 1, opacity: 1 } : {}}
              transition={{ type: "spring", stiffness: 300, damping: 14, delay: 2.1 }}
            >
              <Check className="h-3.5 w-3.5 text-primary" />
            </motion.div>
          </div>
          <div className="mt-3 space-y-2">
            {[70, 52, 84].map((w, i) => (
              <div key={w} className="flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-foreground/10" style={{ maxWidth: `${w}%` }} />
                <motion.div
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={inView ? { scaleX: 1, opacity: 1 } : {}}
                  transition={{ duration: 0.45, delay: 1.9 + i * 0.18 }}
                  style={{ originX: 0 }}
                  className="h-1.5 w-6 rounded-full bg-primary/40"
                />
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function ProblemSection() {
  const { t } = useTranslation();

  const points = [
    ["01", t("landing.prob1Title", "Rigid Forms"), t("landing.prob1Desc", "Static forms cannot adapt to what users enter.")],
    ["02", t("landing.prob2Title", "Weak Validation"), t("landing.prob2Desc", "Bad data creates problems long after submission.")],
    ["03", t("landing.prob3Title", "Scattered Responses"), t("landing.prob3Desc", "Responses should be easy to manage.")],
  ];

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8 sm:py-20 lg:px-10 md:py-24">
      <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:gap-16 items-center">
        <div className="order-2 md:order-1">
          <Reveal delay={0.08}>
            <FormWireframe />
          </Reveal>
        </div>
        <div className="order-1 md:order-2">
          <Reveal>
            <SectionHeading
              lead={t("landing.problemHeadingLead", "Forms shouldn't")}
              muted={t("landing.problemHeadingMuted", "feel complicated.")}
            />
          </Reveal>
          <div className="mt-8 sm:mt-10 divide-y divide-border border-t border-border">
            {points.map(([n, title, desc], i) => (
              <Reveal key={n} delay={0.05 * i}>
                <div className="flex gap-4 sm:gap-6 py-4 sm:py-5">
                  <span className="pt-0.5 font-mono text-[11px] text-primary">{n}</span>
                  <div>
                    <h3 className="text-[14.5px] sm:text-[15px] font-medium tracking-[-0.01em]">{title}</h3>
                    <p className="mt-1 sm:mt-1.5 text-[13px] sm:text-[13.5px] leading-relaxed text-muted-foreground">{desc}</p>
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


