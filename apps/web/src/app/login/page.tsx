"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import type { UserRole } from "@/lib/types";

export default function LoginPage() {
  const { login, user, ready } = useAuth();
  const router = useRouter();

  function go(role: UserRole) {
    login(role);
    setTimeout(() => {
      router.push(role === "TEACHER" ? "/teacher/classes" : "/admin");
    }, 0);
  }

  if (ready && user) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-slate-400">Already signed in as {user.email}</p>
        <Link href={user.role === "TEACHER" ? "/teacher/classes" : "/admin"} className="mt-4 inline-block text-sky-400">
          Continue
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold text-slate-100">Sign in (demo)</h1>
      <p className="mt-2 text-sm text-slate-500">
        Mock session stored in localStorage. Use real JWT when the API is wired.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => go("ADMIN")}
          className="rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-3 text-left text-slate-200 hover:bg-slate-800"
        >
          <span className="font-medium">Admin</span>
          <span className="mt-1 block text-xs text-slate-500">School-wide overview & risk heatmap</span>
        </button>
        <button
          type="button"
          onClick={() => go("PRINCIPAL")}
          className="rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-3 text-left text-slate-200 hover:bg-slate-800"
        >
          <span className="font-medium">Principal</span>
          <span className="mt-1 block text-xs text-slate-500">Same views as Admin</span>
        </button>
        <button
          type="button"
          onClick={() => go("TEACHER")}
          className="rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-3 text-left text-slate-200 hover:bg-slate-800"
        >
          <span className="font-medium">Teacher</span>
          <span className="mt-1 block text-xs text-slate-500">Class dashboards & student drill-down</span>
        </button>
      </div>
      <Link href="/" className="mt-8 inline-block text-sm text-slate-500 hover:text-slate-300">
        ← Back home
      </Link>
    </div>
  );
}
