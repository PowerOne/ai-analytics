"use client";

import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StudentAnalytics, TrendPoint } from "@/lib/types";

export function StudentDetailTabs({
  analytics,
  trends,
}: {
  analytics: StudentAnalytics;
  trends: TrendPoint[];
}) {
  const chartData = trends.map((t) => ({
    name: t.week,
    score: t.score,
    attendancePct: Math.round(t.attendance * 100),
    engagement: t.engagement,
  }));

  return (
    <TabGroup>
      <TabList className="flex gap-1 rounded-lg bg-slate-900 p-1">
        {["Performance", "Attendance", "Engagement", "Trends"].map((label) => (
          <Tab
            key={label}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-400 outline-none ring-sky-500/50 focus:ring-2 data-[selected]:bg-slate-800 data-[selected]:text-sky-300"
          >
            {label}
          </Tab>
        ))}
      </TabList>
      <TabPanels className="mt-4">
        <TabPanel className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h4 className="text-sm font-medium text-slate-400">Assessments</h4>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Avg score %</dt>
              <dd className="text-2xl font-semibold text-slate-100">
                {analytics.performance.avgScorePercent ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Results count</dt>
              <dd className="text-2xl font-semibold text-slate-100">
                {analytics.performance.assessmentResultCount}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            AI risk placeholder:{" "}
            <span className="text-slate-400">
              {analytics.ai.riskScore ?? "—"} ({analytics.ai.source})
            </span>
          </p>
        </TabPanel>
        <TabPanel className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500">Sessions</dt>
              <dd className="text-xl font-semibold">{analytics.attendance.sessionsRecorded}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Present-like</dt>
              <dd className="text-xl font-semibold">{analytics.attendance.presentLikeSessions}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Rate</dt>
              <dd className="text-xl font-semibold">
                {analytics.attendance.presentRate == null
                  ? "—"
                  : `${Math.round(analytics.attendance.presentRate * 100)}%`}
              </dd>
            </div>
          </dl>
        </TabPanel>
        <TabPanel className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">LMS events</dt>
              <dd className="text-xl font-semibold">{analytics.engagement.lmsEventCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Avg engagement (LMS)</dt>
              <dd className="text-xl font-semibold">
                {analytics.engagement.avgEngagementScoreFromLms == null
                  ? "—"
                  : analytics.engagement.avgEngagementScoreFromLms.toFixed(2)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            AI engagement placeholder: {analytics.ai.engagementScore ?? "—"}
          </p>
        </TabPanel>
        <TabPanel className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="mb-4 text-xs text-slate-500">
            Weekly trends (mock / API TBD) — scores, attendance %, engagement index
          </p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
                />
                <Legend />
                <Line type="monotone" dataKey="score" name="Avg score" stroke="#38bdf8" dot={false} />
                <Line
                  type="monotone"
                  dataKey="attendancePct"
                  name="Attendance %"
                  stroke="#4ade80"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="engagement"
                  name="Engagement"
                  stroke="#fbbf24"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabPanel>
      </TabPanels>
    </TabGroup>
  );
}
