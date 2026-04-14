import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";

import { StudentsListClient } from "./students-list-client";

export default async function StudentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <StudentsListClient user={user} />;
}
