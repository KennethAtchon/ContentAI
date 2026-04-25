"use client";

import { ReactNode, useRef } from "react";
import { motion, useInView } from "framer-motion";

/**
 * Props for the AnimatedSection component.
 */
interface AnimatedSectionProps {
  /** Content to animate */
  children: ReactNode;
  /** Animation delay in seconds */
  delay?: number;
}

// Animation constants
const ANIMATION_DURATION = 1.3;
const INITIAL_Y_OFFSET = 60;
const INTERSECTION_MARGIN = "-100px";
const CUSTOM_EASE = [0.22, 1, 0.36, 1] as const;
const DEFAULT_DELAY = 0;

/**
 * A reusable component that animates children into view when they enter the viewport.
 * Uses Framer Motion for smooth fade-in and slide-up animations.
 *
 * @param children - Content to animate
 * @param delay - Animation delay in seconds (default: 0)
 */
export default function AnimatedSection({
  children,
  delay = DEFAULT_DELAY,
}: AnimatedSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, {
    once: true,
    margin: INTERSECTION_MARGIN,
  });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: INITIAL_Y_OFFSET }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: ANIMATION_DURATION,
        delay,
        ease: CUSTOM_EASE,
      }}
      style={{ willChange: "opacity, transform" }}
    >
      {children}
    </motion.div>
  );
}
