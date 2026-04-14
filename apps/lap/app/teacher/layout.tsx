import { redirect } from "next/navigation";

import { DashboardLayout } from "@/app/components/layout/DashboardLayout";
import { getCurrentUser } from "@/app/lib/auth";
import { dashboardPathForRole } from "@/app/lib/roles";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "TEACHER") redirect(dashboardPathForRole(user.role));

  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
