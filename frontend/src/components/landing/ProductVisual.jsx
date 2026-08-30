import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Eye, FileUp, GitBranch, Send, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

function useTypewriter(text, startDelay, speed = 55) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    let i = 0;
    let timer;
    const start = setTimeout(function tick() {
      setShown(text.slice(0, i + 1));
      i += 1;
      if (i < text.length) {
        timer = setTimeout(tick, speed);
      } else {
        setDone(true);
      }
    }, startDelay);
    return () => {
      clearTimeout(start);
      clearTimeout(timer);
    };
  }, [text, startDelay, speed]);
  return { shown, done };
}

function TypewriterField({
  text,
  startDelay,
  speed,
}) {
  const { shown, done } = useTypewriter(text, startDelay, speed);
  return (
    <span className="inline-flex items-center">
      {shown}
      <span
        className="ml-0.5 inline-block h-[1em] w-[1.5px] bg-primary align-middle"
        style={{ opacity: done ? 0 : 1, animation: "typewriter-blink 1s steps(1) infinite" }}
      />
    </span>
  );
}

export function ProductVisual() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const fields = [
    { label: t("builder.text", "Full Name"), value: "Ana Whitfield" },
    { label: t("builder.email", "Email Address"), value: "ana@formcraft.io" },
    { label: t("builder.number", "Age"), value: "24" },
    { label: t("landing.nodeLicense", "Driving License Number"), value: "DL-4471-8823" },
  ];

  const rules = [
    { icon: ShieldCheck, title: t("landing.statValidation", "Validation"), value: "", highlight: false },
    { icon: GitBranch, title: t("landing.statConditional", "Conditional Logic"), value: "", highlight: true },
    { icon: FileUp, title: t("builder.file", "File Upload"), value: "", highlight: false },
    { icon: Send, title: t("dashboard.responses", "On Submit"), value: "", highlight: false },
    { icon: Eye, title: t("builder.preview", "Preview"), value: "", highlight: false },
  ];

  const focusPulse = reduce
    ? {}
    : {
        boxShadow: [
          "0 0 0 0px color-mix(in oklab, var(--primary) 0%, transparent)",
          "0 0 0 3px color-mix(in oklab, var(--primary) 18%, transparent)",
          "0 0 0 0px color-mix(in oklab, var(--primary) 0%, transparent)",
        ],
        borderColor: ["var(--border)", "var(--primary)", "var(--border)"],
      };

  return (
    <div className="grid gap-3 sm:gap-4 rounded-2xl sm:rounded-[24px] border border-border bg-card p-3 sm:p-5 shadow-[0_24px_60px_-40px_rgba(16,19,18,0.35)] lg:grid-cols-[1.5fr_1fr]">
      {/* Builder panel */}
      <div className="rounded-xl sm:rounded-[18px] border border-border bg-background p-3.5 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] sm:text-[13px] font-medium tracking-[-0.01em]">{t("dashboard.modalFormTitle", "Registration Form")}</p>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] sm:text-[10.5px] font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {t("dashboard.statusPublished", "Published")}
          </span>
        </div>

        <div className="mt-3.5 sm:mt-5 space-y-2.5 sm:space-y-3.5">
          {fields.map((f, i) => {
            const isAge = f.label.includes("Age") || f.label.includes("आयु") || f.label.includes("ವಯಸ್ಸು");
            const delay = 400 + fields.slice(0, i).reduce((acc, x) => acc + x.value.length * 55 + 350, 0);
            return (
              <div key={f.label}>
                <p className="text-[10.5px] sm:text-[11px] text-muted-foreground">{f.label}</p>
                <motion.div
                  className="mt-1 flex h-8 sm:h-9 items-center rounded-lg border border-border bg-surface/60 px-2.5 sm:px-3 text-[11.5px] sm:text-[12px] text-foreground/80 overflow-hidden text-ellipsis whitespace-nowrap"
                  animate={isAge ? focusPulse : {}}
                  transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
                >
                  <TypewriterField text={f.value} startDelay={delay} />
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rules panel */}
      <div className="rounded-xl sm:rounded-[18px] border border-border bg-surface p-3.5 sm:p-5">
        <div className="flex items-center justify-center">
          <p className="text-[10.5px] sm:text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {t("builder.validationRules", "Response Rules")}
          </p>
        </div>

        <div className="mt-3.5 sm:mt-5 space-y-2 sm:space-y-3.5">
          {rules.map((r) => {
            const Icon = r.icon;
            return (
              <motion.div
                key={r.title}
                className="flex h-8 sm:h-9 items-center justify-between rounded-lg border border-border bg-background px-2.5 sm:px-3"
                animate={
                  r.highlight && !reduce
                    ? { backgroundColor: ["var(--background)", "color-mix(in oklab, var(--primary) 8%, white)", "var(--background)"], borderColor: ["var(--border)", "var(--primary)", "var(--border)"] }
                    : {}
                }
                transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[11px] sm:text-[11.5px] font-medium">{r.title}</p>
                </div>
                <p className="flex items-center gap-1.5 font-mono text-[10.5px] sm:text-[11px] text-muted-foreground">
                  <Check className="h-3 w-3 text-primary" />
                  {r.value}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );

}

