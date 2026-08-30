import { motion, useReducedMotion } from "framer-motion";

export function Reveal({
  children,
  delay = 0,
  className = "",
  y = 18,
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({
  lead,
  muted,
  className = "",
}) {
  return (
    <h2
      className={`text-3xl font-medium leading-[1.1] tracking-[-0.03em] sm:text-4xl md:text-5xl ${className}`}
    >
      {lead}
      <br />
      <span className="text-muted-foreground">{muted}</span>
    </h2>
  );
}
