"use client";

import { Metric, Text } from "@tremor/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/modern/ui/card";

export function KPICard(props: { title: string; metric: React.ReactNode; subtitle?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Metric>{props.metric}</Metric>
        {props.subtitle ? <Text className="mt-1 text-slate-500 dark:text-slate-400">{props.subtitle}</Text> : null}
      </CardContent>
    </Card>
  );
}
