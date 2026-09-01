import { type Variants, type Transition } from "framer-motion"

// Consistent easing curve for all animations
export const silverEasing = [0.21, 0.47, 0.32, 0.98] as const

// Spring transition for interactive elements
export const springTransition: Transition = {
  type: "spring",
  bounce: 0.15,
  duration: 0.5,
}

// Smooth transition for general animations
export const smoothTransition: Transition = {
  duration: 0.3,
  ease: silverEasing,
}

// Fast transition for micro-interactions
export const fastTransition: Transition = {
  duration: 0.15,
  ease: silverEasing,
}

// Fade in from bottom animation
export const fadeInUp: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: silverEasing,
    },
  },
  exit: {
    opacity: 0,
    y: 10,
    transition: {
      duration: 0.3,
      ease: silverEasing,
    },
  },
}

// Fade in animation
export const fadeIn: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: silverEasing,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: silverEasing,
    },
  },
}

// Scale in animation
export const scaleIn: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: silverEasing,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.2,
      ease: silverEasing,
    },
  },
}

// Slide in from right animation
export const slideInRight: Variants = {
  initial: {
    opacity: 0,
    x: 20,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: silverEasing,
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: 0.2,
      ease: silverEasing,
    },
  },
}

// Slide in from left animation
export const slideInLeft: Variants = {
  initial: {
    opacity: 0,
    x: -20,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: silverEasing,
    },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: {
      duration: 0.2,
      ease: silverEasing,
    },
  },
}

// Stagger container for list animations
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

// Stagger container with faster timing
export const staggerContainerFast: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
}

// Stagger item animation
export const staggerItem: Variants = {
  initial: {
    opacity: 0,
    y: 15,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: silverEasing,
    },
  },
}

// Card hover animation
export const cardHover: Variants = {
  initial: {
    scale: 1,
  },
  hover: {
    scale: 1.02,
    transition: springTransition,
  },
  tap: {
    scale: 0.98,
    transition: {
      duration: 0.1,
    },
  },
}

// Button press animation
export const buttonPress: Variants = {
  initial: {
    scale: 1,
  },
  tap: {
    scale: 0.98,
    transition: {
      duration: 0.1,
    },
  },
}

// Tab indicator animation (for layoutId)
export const tabIndicator = {
  layoutId: "tab-indicator",
  transition: springTransition,
}

// Modal/Dialog animation
export const modalAnimation: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
    y: 10,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: silverEasing,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: {
      duration: 0.2,
      ease: silverEasing,
    },
  },
}

// Overlay/backdrop animation
export const overlayAnimation: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.2,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.15,
    },
  },
}

// Accordion/expand animation
export const expandAnimation: Variants = {
  initial: {
    height: 0,
    opacity: 0,
  },
  animate: {
    height: "auto",
    opacity: 1,
    transition: {
      height: {
        duration: 0.3,
        ease: silverEasing,
      },
      opacity: {
        duration: 0.2,
        delay: 0.1,
      },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: {
      height: {
        duration: 0.3,
        ease: silverEasing,
      },
      opacity: {
        duration: 0.15,
      },
    },
  },
}

// Tooltip animation
export const tooltipAnimation: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.15,
      ease: silverEasing,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.1,
    },
  },
}

// Page transition
export const pageTransition: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: silverEasing,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2,
      ease: silverEasing,
    },
  },
}

// Shimmer/loading animation (for skeleton)
export const shimmerAnimation = {
  animate: {
    backgroundPosition: ["200% 0", "-200% 0"],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "linear",
    },
  },
}

// Pulse animation for notifications
export const pulseAnimation: Variants = {
  initial: {
    scale: 1,
    opacity: 1,
  },
  animate: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
}

// Spin animation for loading
export const spinAnimation = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear",
    },
  },
}

// Helper to create delay variants
export const withDelay = (variants: Variants, delay: number): Variants => {
  const animate =
    variants.animate && typeof variants.animate === "object"
      ? variants.animate
      : {}
  const transition =
    animate.transition && typeof animate.transition === "object"
      ? animate.transition
      : {}

  return {
    ...variants,
    animate: {
      ...animate,
      transition: {
        ...transition,
        delay,
      },
    },
  }
}

// Helper to create stagger index delay
export const getStaggerDelay = (index: number, baseDelay = 0.08) => ({
  delay: index * baseDelay,
})
