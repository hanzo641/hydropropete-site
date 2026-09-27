"use client";

import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";

/** Apparition discrète au défilement. Désactivée si l'utilisateur préfère réduire les animations. */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        className={className}
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
