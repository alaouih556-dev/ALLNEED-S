import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-md border border-line bg-paper px-4 text-base text-ink outline-none transition-colors",
        "placeholder:text-muted/70 hover:border-royal/40 focus:border-electric focus:ring-2 focus:ring-electric/20",
        "disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-36 w-full rounded-md border border-line bg-paper px-4 py-3 text-base text-ink outline-none transition-colors",
        "placeholder:text-muted/70 hover:border-royal/40 focus:border-electric focus:ring-2 focus:ring-electric/20",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "mb-2 block font-display text-[0.95rem] font-semibold text-navy",
        className,
      )}
      {...props}
    />
  );
}
