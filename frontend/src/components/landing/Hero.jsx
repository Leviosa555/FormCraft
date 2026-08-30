import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ProductVisual } from "./ProductVisual";
import { useTranslation } from "@/lib/i18n";

function Counter({ target, suffix, isInfinite }) {
  const spanRef = useRef(null);
  const inView = useInView(spanRef, { once: true, margin: "-40px" });

  useEffect(() => {
    if (!inView || !spanRef.current) return;

    if (isInfinite) {
      const stages = ["0", "8", "32", "∞"];
      let idx = 0;
      const interval = setInterval(() => {
        idx++;
        if (idx < stages.length) {
          if (spanRef.current) spanRef.current.textContent = stages[idx];
        } else {
          if (spanRef.current) {
            spanRef.current.textContent = "∞";
            spanRef.current.classList.add("text-primary");
          }
          clearInterval(interval);
        }
      }, 200);
      return () => clearInterval(interval);
    } else {
      let start = 0;
      const end = target;
      const duration = 1200;
      const startTime = performance.now();
      let animId;

      const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (end - start) * ease);

        if (spanRef.current) {
          spanRef.current.textContent = `${current}${suffix}`;
        }

        if (progress < 1) {
          animId = requestAnimationFrame(step);
        } else if (spanRef.current) {
          spanRef.current.textContent = `${end}${suffix}`;
        }
      };

      animId = requestAnimationFrame(step);
      return () => cancelAnimationFrame(animId);
    }
  }, [inView, target, suffix, isInfinite]);

  return (
    <span
      ref={spanRef}
      className="inline-block tabular-nums transition-colors duration-500"
    >
      0{suffix}
    </span>
  );
}

export function Hero() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const item = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  };

  const stats = [
    { target: 10, suffix: "+", isInfinite: false, label: t("landing.statFields", "Field Types") },
    { target: 5, suffix: "", isInfinite: false, label: t("landing.statValidation", "Validation Rules") },
    { target: 0, suffix: "", isInfinite: true, label: t("landing.statConditional", "Conditional Rules") },
    { target: 1, suffix: "", isInfinite: false, label: t("landing.statSystem", "Unified Response System") },
  ];

  return (
    <section id="product" className="relative overflow-hidden pt-24 sm:pt-32 lg:pt-40 pb-10 sm:pb-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[580px] bg-[radial-gradient(ellipse_75%_65%_at_50%_0%,rgba(16,185,129,0.32)_0%,rgba(45,212,191,0.18)_40%,transparent_75%)]" />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-10">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.25fr] lg:gap-14">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          >
            <motion.p
              variants={item}
              className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
            >
              {t("landing.badge", "The Modern Form Platform")}
            </motion.p>
            <motion.h1
              variants={item}
              className="mt-4 sm:mt-5 text-2xl font-medium leading-[1.08] tracking-[-0.035em] sm:text-4xl md:text-5xl"
            >
              {t("landing.heroTitle", "Craft Intelligent Forms,")}{" "}
              <span className="text-primary">{t("landing.heroHighlight", "Automate Workflows.")}</span>
            </motion.h1>
            <motion.p
              variants={item}
              className="mt-3.5 sm:mt-5 max-w-xl text-[13.5px] sm:text-[14.5px] leading-relaxed text-muted-foreground"
            >
              {t("landing.heroSubtitle", "Design high-converting, adaptive forms with conditional branching, AI-driven form generation, real-time OTP verification, and enterprise-grade security.")}
            </motion.p>
            <motion.div variants={item} className="mt-6 sm:mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-[13.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90 shadow-xs"
              >
                {t("landing.startFree", "Start Building Free")} <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-[13.5px] font-medium transition-colors hover:bg-surface"
              >
                {t("landing.exploreFeatures", "Explore Features")} <ArrowDown className="h-4 w-4" />
              </a>
            </motion.div>
          </motion.div>

          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <ProductVisual />
          </motion.div>
        </div>

        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mx-auto mt-8 sm:mt-10 grid max-w-4xl grid-cols-2 gap-2 sm:gap-0 rounded-2xl border border-border bg-background/95 backdrop-blur-md p-3 sm:px-4 sm:py-5 shadow-[0_20px_50px_-30px_rgba(16,19,18,0.3)] md:grid-cols-4 md:divide-x md:divide-border"
        >
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col justify-center p-2.5 sm:px-4 sm:py-2 text-center md:text-left bg-surface/30 sm:bg-transparent rounded-xl sm:rounded-none">
              <div className="flex h-8 sm:h-10 items-center justify-center text-xl sm:text-2xl md:text-3xl font-medium tracking-[-0.03em] md:justify-start">
                <Counter target={s.target} suffix={s.suffix} isInfinite={s.isInfinite} />
              </div>
              <p className="mt-1 text-[10px] sm:text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                {s.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>

  );
}

