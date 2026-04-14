import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { dashboardPathForRole } from "@/app/lib/roles";

import { PrincipalDashboardClient } from "./principal-dashboard-client";

export default async function PrincipalDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "PRINCIPAL") redirect(dashboardPathForRole(user.role));

  return <PrincipalDashboardClient user={user} />;
}
