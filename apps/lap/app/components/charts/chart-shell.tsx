import type { ReactNode } from "react";

import { cn } from "@/app/lib/utils";

/**
 * Recharts needs a sized parent; in flex layouts use `min-w-0` so charts shrink correctly.
 */
export function ChartShell({
  height,
  className,
  children,
}: {
  height: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("w-full min-w-0 shrink-0", className)}
      style={{ height, minHeight: height }}
    >
      {children}
    </div>
  );
}
