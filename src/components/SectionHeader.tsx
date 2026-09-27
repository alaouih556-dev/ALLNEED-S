import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  dark?: boolean;
  className?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  dark,
  className,
}: Props) {
  return (
    <div className={cn("max-w-3xl", className)}>
      {eyebrow ? (
        <p className={cn("eyebrow mb-4", dark && "text-cyan")}>{eyebrow}</p>
      ) : null}
      <h2 className={cn("text-section", dark ? "text-paper" : "text-navy")}>
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-5 text-lead",
            dark ? "text-paper/78" : "text-muted",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
