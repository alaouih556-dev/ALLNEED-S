import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  compact?: boolean;
};

export function Logo({ className, compact = false }: LogoProps) {
  return (
    <img
      src="/allneeds-logo.jpg"
      alt="ALLNEEDS — Everything you need, right here."
      className={cn(
        "object-contain object-left",
        compact ? "h-14 w-auto md:h-16" : "h-16 w-auto md:h-[4.5rem]",
        className,
      )}
    />
  );
}
