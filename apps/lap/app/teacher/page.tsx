import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";

export default function TeacherPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Teacher dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Scoped rosters, class sections, and student support workflows.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link
            href="/students"
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Students directory →
          </Link>
          <Link
            href="/classes"
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Classes directory →
          </Link>
          <Link
            href="/interventions"
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Interventions →
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My classroom</CardTitle>
          <CardDescription>
            Use the sidebar for full lists. Chart components live in{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
              app/components/charts
            </code>{" "}
            when you wire class- or student-level metrics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            Line, bar, and pie charts use the same shells as admin and principal dashboards for a
            consistent layout on phones and desktops.
          </p>
          <p>
            <Link
              href="/interventions"
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Log and track support actions →
            </Link>
          </p>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-zinc-500">
        Your role sees the same{" "}
        <Link className="text-primary underline-offset-2 hover:underline" href="/students">
          Students
        </Link>{" "}
        and{" "}
        <Link className="text-primary underline-offset-2 hover:underline" href="/classes">
          Classes
        </Link>{" "}
        data as elsewhere in the app, filtered to your teaching scope.
      </p>
    </div>
  );
}
