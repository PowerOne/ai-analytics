import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";

import { ClassesListClient } from "./classes-list-client";

export default async function ClassesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <ClassesListClient user={user} />;
}
