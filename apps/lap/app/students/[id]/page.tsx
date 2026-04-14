import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";

import { Student360PageClient } from "./student-360-page-client";

export default async function Student360Page({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <Student360PageClient user={user} studentId={params.id} />;
}
