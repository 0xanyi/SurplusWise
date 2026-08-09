import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[11px] text-[13px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98] [&_svg]:size-4 [&_svg]:flex-none",
  {
    variants: {
      variant: {
        // Cream on near-black in dark, ink on paper in light: the highest
        // contrast pairing in the system, and neutral — a primary action never
        // borrows a money colour.
        default: "bg-primary font-semibold text-primary-foreground hover:opacity-90",
        destructive:
          "bg-destructive font-semibold text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-card hover:border-foreground/20 hover:bg-secondary/60",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary/60 hover:text-accent-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[38px] px-[15px]",
        sm: "h-9 rounded-[10px] px-3.5 text-[12.5px]",
        // 44px clears the 2.75rem thumb-row floor for entry paths.
        lg: "h-11 px-5 text-sm",
        xl: "h-12 rounded-[13px] px-6 text-[14.5px]",
        icon: "h-[38px] w-[38px]",
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
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
