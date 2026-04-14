import { cn } from "@/app/lib/utils";

export type SpinnerSize = "sm" | "md" | "lg";

const sizes: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-10 w-10 border-[3px]",
};

export function Spinner({
  className,
  size = "md",
  label = "Loading",
}: {
  className?: string;
  size?: SpinnerSize;
  /** Visually hidden label for accessibility */
  label?: string;
}) {
  return (
    <span
      role="status"
      className={cn("inline-flex items-center justify-center", className)}
    >
      <span
        className={cn(
          "animate-spin rounded-full border-zinc-200 border-t-primary dark:border-zinc-700",
          sizes[size],
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
