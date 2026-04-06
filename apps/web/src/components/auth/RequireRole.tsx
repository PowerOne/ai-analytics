"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import type { UserRole } from "@/lib/types";

export function RequireRole({
  allow,
  children,
}: {
  allow: UserRole[];
  children: React.ReactNode;
}) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allow.includes(user.role)) {
      router.replace("/");
    }
  }, [ready, user, allow, router]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!allow.includes(user.role)) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-400">You don&apos;t have access to this area.</p>
        <Link href="/" className="mt-4 inline-block text-sky-400 hover:underline">
          Home
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
