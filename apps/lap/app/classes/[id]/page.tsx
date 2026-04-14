import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";

import { Class360PageClient } from "./class-360-page-client";

export default async function Class360Page({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <Class360PageClient user={user} classId={params.id} />;
}
