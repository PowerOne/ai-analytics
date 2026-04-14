import { Suspense } from "react";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12 dark:bg-neutral-950">
      <Suspense
        fallback={
          <div className="h-48 w-full max-w-sm animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
