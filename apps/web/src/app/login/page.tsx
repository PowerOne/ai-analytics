"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";

export default function LoginPage() {
  const { loginWithCredentials, user, ready, logout } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = await loginWithCredentials(email.trim(), password);
      if (session.role === "TEACHER") router.replace("/teacher/classes");
      else if (session.role === "ADMIN" || session.role === "PRINCIPAL") router.replace("/admin");
      else router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (ready && user) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-slate-400">Signed in as {user.email}</p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={user.role === "TEACHER" ? "/teacher/classes" : "/admin"}
            className="inline-block rounded-lg bg-sky-600 px-4 py-3 font-medium text-white hover:bg-sky-500"
          >
            Continue to app
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            className="text-sm text-slate-500 hover:text-slate-300"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold text-slate-100">Sign in</h1>
      <p className="mt-2 text-sm text-slate-500">Use your school account. Password must be at least 8 characters.</p>

      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none ring-sky-500/50 focus:ring-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none ring-sky-500/50 focus:ring-2"
          />
        </div>
        {error ? (
          <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-sky-600 py-3 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <Link href="/" className="mt-8 inline-block text-sm text-slate-500 hover:text-slate-300">
        ← Back home
      </Link>
    </div>
  );
}
