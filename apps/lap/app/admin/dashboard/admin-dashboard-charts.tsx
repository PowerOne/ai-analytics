"use client";

import { BarChart } from "@/app/components/charts/BarChart";
import { LineChart } from "@/app/components/charts/LineChart";
import { PieChart } from "@/app/components/charts/PieChart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  EmptyState,
  cardEmbeddedEmptyClassName,
} from "@/app/components/ui/empty-state";

export type AdminChartsPayload = {
  gradeBars: { grade: string; count: number }[];
  interventionStatus: { name: string; value: number }[];
  interventionTrend: { day: string; count: number }[];
};

export function AdminDashboardCharts({
  gradeBars,
  interventionStatus,
  interventionTrend,
}: AdminChartsPayload) {
  const gradeData = gradeBars.map((g) => ({ name: g.grade, count: g.count }));
  const trendData = interventionTrend.map((t) => ({ date: t.day, count: t.count }));
  const pieData = interventionStatus.filter((s) => s.value > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Students by grade</CardTitle>
          <CardDescription>
            Distribution of enrolled students across grade levels in your school.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gradeData.length === 0 ? (
            <EmptyState
              className={cardEmbeddedEmptyClassName}
              title="No grade distribution yet"
              description="Student grade data will appear here once rosters are populated."
            />
          ) : (
            <BarChart data={gradeData} xKey="name" yKey="count" height={300} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interventions (14 days)</CardTitle>
          <CardDescription>New interventions recorded per day.</CardDescription>
        </CardHeader>
        <CardContent>
          {trendData.length === 0 ? (
            <EmptyState
              className={cardEmbeddedEmptyClassName}
              title="No intervention activity"
              description="New interventions in the last 14 days will show as a trend here."
            />
          ) : (
            <LineChart
              data={trendData}
              xKey="date"
              yKey="count"
              height={280}
              stroke="#0ea5e9"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interventions by status</CardTitle>
          <CardDescription>Current mix of intervention workflow states.</CardDescription>
        </CardHeader>
        <CardContent>
          {pieData.length === 0 ? (
            <EmptyState
              className={cardEmbeddedEmptyClassName}
              title="Nothing to chart"
              description="Intervention status counts will appear once records exist."
            />
          ) : (
            <PieChart data={pieData} height={280} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
