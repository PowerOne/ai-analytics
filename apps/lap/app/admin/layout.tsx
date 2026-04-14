import { redirect } from "next/navigation";

import { DashboardLayout } from "@/app/components/layout/DashboardLayout";
import { getCurrentUser } from "@/app/lib/auth";
import { dashboardPathForRole } from "@/app/lib/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect(dashboardPathForRole(user.role));

  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
