import { redirect } from "next/navigation";

import { DashboardLayout } from "@/app/components/layout/DashboardLayout";
import { getCurrentUser } from "@/app/lib/auth";

/** Keeps sidebar/top nav when opening Classes from any role dashboard. */
export default async function ClassesSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
