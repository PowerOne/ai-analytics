import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";

import { InterventionsListClient } from "./interventions-list-client";

export default async function InterventionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <InterventionsListClient user={user} />;
}
