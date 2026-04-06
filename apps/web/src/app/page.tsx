import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="text-3xl font-bold text-slate-100">Learning Analytics</h1>
      <p className="mt-2 text-slate-400">
        Role-based dashboards for school overview, risk, and class-level insights.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-sky-600 px-4 py-3 text-center font-medium text-white hover:bg-sky-500"
        >
          Sign in
        </Link>
        <p className="text-center text-xs text-slate-500">
          Demo: choose Admin or Teacher on the login page (mock session).
        </p>
      </div>
    </div>
  );
}
