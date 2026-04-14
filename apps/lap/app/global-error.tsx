"use client";

/**
 * Catches errors in the root layout (e.g. when Providers fail).
 * Must include own <html> and <body> — keep minimal.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 text-zinc-100">
        <h1 className="text-lg font-semibold">Application error</h1>
        <p className="mt-2 max-w-md text-center text-sm text-zinc-400">
          {error.message || "Please refresh the page or try again later."}
        </p>
        <button
          type="button"
          className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          onClick={() => reset()}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
