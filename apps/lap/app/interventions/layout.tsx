import { redirect } from "next/navigation";

import { DashboardLayout } from "@/app/components/layout/DashboardLayout";
import { getCurrentUser } from "@/app/lib/auth";

export default async function InterventionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
