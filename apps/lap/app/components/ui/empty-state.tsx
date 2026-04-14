import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/app/lib/utils";

import { Button, linkButtonClass } from "./button";

/** Use inside a `Card` so the dashed border does not stack on the card frame. */
export const cardEmbeddedEmptyClassName =
  "border-0 bg-transparent py-10 shadow-none dark:bg-transparent";

export type EmptyStateProps = {
  title: string;
  description?: string;
  className?: string;
  icon?: ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
};

export function EmptyState({ title, description, className, icon, action }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-6 py-14 text-center dark:border-zinc-600 dark:bg-zinc-900/40",
        className,
      )}
    >
      {icon ?? (
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200/80 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          aria-hidden
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
      )}
      <div className="max-w-sm space-y-1">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        {description ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
        ) : null}
      </div>
      {action ? (
        action.href ? (
          <Link href={action.href} className={linkButtonClass("primary", "sm")}>
            {action.label}
          </Link>
        ) : (
          <Button type="button" variant="primary" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  );
}
