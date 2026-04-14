"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { AuthError } from "@/app/lib/auth-types";
import { getPostLoginPath, login } from "@/app/lib/auth";
import { isAllowedAppPath } from "@/app/lib/roles";

const MIN_PASSWORD_LEN = 8;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    if (password.length < MIN_PASSWORD_LEN) {
      setError(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
      return;
    }

    setLoading(true);
    try {
      const user = await login(trimmed, password);
      const from = searchParams.get("from");
      const safeFrom =
        from && from.startsWith("/") && !from.startsWith("//") && isAllowedAppPath(from, user.role)
          ? from
          : null;
      router.replace(safeFrom ?? getPostLoginPath(user));
      router.refresh();
    } catch (err) {
      const message =
        err instanceof AuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Learning Analytics Platform
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-800 dark:text-neutral-200">
          Email
        </span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none ring-offset-2 focus:ring-2 focus:ring-neutral-400 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:ring-neutral-600"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-800 dark:text-neutral-200">
          Password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={MIN_PASSWORD_LEN}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none ring-offset-2 focus:ring-2 focus:ring-neutral-400 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:ring-neutral-600"
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-10 items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
