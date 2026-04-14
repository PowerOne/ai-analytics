import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";

import { InterventionDetailClient } from "./intervention-detail-client";

export default async function InterventionDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <InterventionDetailClient user={user} interventionId={params.id} />;
}
