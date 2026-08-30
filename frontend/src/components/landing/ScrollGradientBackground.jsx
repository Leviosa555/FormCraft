import { motion, useScroll, useTransform, useSpring } from "framer-motion";

export function ScrollGradientBackground() {
  const { scrollYProgress } = useScroll();

  // Spring-smoothed scroll progress for fluid physics
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 65,
    damping: 22,
    restDelta: 0.001,
  });

  // Dynamic vertical travel through viewport as user scrolls
  const orb1Y = useTransform(smoothProgress, [0, 1], ["-4vh", "78vh"]);
  const orb1X = useTransform(
    smoothProgress,
    [0, 0.3, 0.65, 1],
    ["-8vw", "16vw", "-12vw", "6vw"]
  );
  const orb1Scale = useTransform(smoothProgress, [0, 0.35, 0.7, 1], [1.2, 1.45, 1.15, 1.3]);
  const orb1Rotate = useTransform(smoothProgress, [0, 1], [0, 180]);

  const orb2Y = useTransform(smoothProgress, [0, 1], ["8vh", "84vh"]);
  const orb2X = useTransform(
    smoothProgress,
    [0, 0.3, 0.65, 1],
    ["12vw", "-15vw", "12vw", "-8vw"]
  );
  const orb2Scale = useTransform(smoothProgress, [0, 0.5, 1], [1, 1.35, 1.05]);

  const heroSpotlightOpacity = useTransform(smoothProgress, [0, 0.35], [1, 0.15]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* 1. Hero Vibrant Spotlight (Highest intensity in Hero, smoothly fades on scroll) */}
      <motion.div
        style={{ opacity: heroSpotlightOpacity }}
        className="absolute -top-20 left-1/2 -translate-x-1/2 h-[720px] w-full max-w-[1300px] bg-[radial-gradient(ellipse_80%_60%_at_50%_15%,rgba(16,185,129,0.42)_0%,rgba(45,212,191,0.24)_45%,transparent_75%)] blur-[70px]"
      />

      {/* 2. Top-center radiant primary bulb */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[420px] w-[650px] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.35)_0%,rgba(52,211,153,0.18)_50%,transparent_75%)] blur-[85px]" />

      {/* 3. Primary Scroll-Driven Emerald Traveling Orb */}
      <motion.div
        style={{
          top: orb1Y,
          left: "50%",
          x: orb1X,
          scale: orb1Scale,
          rotate: orb1Rotate,
        }}
        className="absolute -translate-x-1/2 h-[520px] w-[680px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.45)_0%,rgba(5,150,105,0.28)_40%,rgba(45,212,191,0.16)_60%,transparent_75%)] blur-[95px] sm:h-[650px] sm:w-[900px] sm:blur-[120px]"
      />

      {/* 4. Secondary Scroll-Driven Cyan/Mint Counter-Orb */}
      <motion.div
        style={{
          top: orb2Y,
          left: "50%",
          x: orb2X,
          scale: orb2Scale,
        }}
        className="absolute -translate-x-1/2 h-[440px] w-[560px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.4)_0%,rgba(16,185,129,0.22)_45%,transparent_70%)] blur-[85px] sm:h-[540px] sm:w-[720px] sm:blur-[105px]"
      />
    </div>
  );
}
