import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";

/**
 * Placeholder for a future heatmap visualization (e.g. engagement by day/hour).
 */
export function Heatmap({
  title = "Heatmap",
  description = "Density and pattern visualization will appear here once data pipelines are connected.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
          Heatmap placeholder
        </div>
      </CardContent>
    </Card>
  );
}
