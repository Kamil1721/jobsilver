"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]",
        destructive:
          "bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 active:scale-[0.98]",
        outline:
          "border border-input bg-background hover:bg-accent active:scale-[0.98] dark:border-white/[0.08] dark:hover:border-white/[0.12] dark:text-zinc-300 dark:hover:text-white",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.98] dark:bg-white/[0.05] dark:hover:bg-white/[0.08]",
        ghost:
          "hover:bg-accent hover:text-foreground dark:text-zinc-400 dark:hover:text-white",
        link:
          "text-[var(--coral-lo)] underline-offset-4 hover:underline",
        // Metallic silver button - primary action
        metallic:
          "relative overflow-hidden text-foreground active:scale-[0.98]",
        // White button for CTAs on dark backgrounds
        white:
          "bg-card text-foreground border border-border hover:bg-secondary active:scale-[0.98]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-6",
        icon: "h-9 w-9 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    // Metallic button has special rendering
    if (variant === "metallic") {
      return (
        <Comp
          className={cn(
            buttonVariants({ variant, size }),
            "group",
            className
          )}
          ref={ref}
          {...props}
        >
          {/* Outer gradient border */}
          <div className="absolute inset-0 bg-gradient-to-r from-border via-muted-foreground/30 to-border transition-all duration-300 group-hover:scale-[1.02]" />
          {/* Inner light layer */}
          <div className="absolute inset-[1px] bg-gradient-to-b from-card to-secondary rounded-[10px]" />
          {/* Top shine highlight */}
          <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/40" />
          {/* Content */}
          <span className="relative z-10 flex items-center gap-2">
            {children}
          </span>
        </Comp>
      )
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
