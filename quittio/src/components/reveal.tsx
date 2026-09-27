"use client";

import { LazyMotion, m, useReducedMotion } from "framer-motion";

const loadFeatures = () => import("@/lib/motion-features").then((mod) => mod.default);

/**
 * Apparition discrète au défilement (Framer Motion). Les fonctionnalités
 * d'animation sont chargées de façon asynchrone pour ne pas pénaliser le
 * chargement initial ; désactivée si l'utilisateur préfère réduire les animations.
 */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <LazyMotion features={loadFeatures} strict>
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
