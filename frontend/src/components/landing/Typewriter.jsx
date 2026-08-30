import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

export function TypewriterOnView({
  text,
  startDelay = 0,
  speed = 45,
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!inView) return;
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
  }, [inView, text, startDelay, speed]);

  return (
    <span ref={ref} className="inline-flex items-center">
      {shown}
      <span
        className="ml-0.5 inline-block h-[1em] w-[1.5px] bg-primary align-middle"
        style={{ opacity: done || !inView ? 0 : 1, animation: "typewriter-blink 1s steps(1) infinite" }}
      />
    </span>
  );
}
