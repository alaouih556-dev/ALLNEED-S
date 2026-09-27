import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-display font-semibold transition-[transform,box-shadow,background-color,color,border-color,filter] duration-150 ease-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:not-disabled:scale-[0.96]",
  {
    variants: {
      variant: {
        primary:
          "cta-gradient text-paper shadow-[0_10px_24px_rgba(18,104,232,0.28)] hover:shadow-[0_14px_28px_rgba(18,104,232,0.38)]",
        secondary:
          "border border-royal/25 bg-paper text-navy hover:border-electric hover:bg-ice",
        ghost:
          "bg-transparent text-paper hover:bg-paper/10",
        outline:
          "border border-paper/30 bg-transparent text-paper hover:border-cyan hover:bg-paper/8",
        dark: "bg-navy text-paper hover:bg-navy-mid",
      },
      size: {
        sm: "h-10 rounded-md px-4 text-sm",
        md: "h-12 rounded-md px-5 text-[0.98rem]",
        lg: "h-14 rounded-lg px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
