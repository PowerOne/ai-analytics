import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";

import { NewInterventionForm } from "./new-intervention-form";

export default async function NewInterventionPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const classId = typeof searchParams.classId === "string" ? searchParams.classId : null;
  const studentId = typeof searchParams.studentId === "string" ? searchParams.studentId : null;

  return (
    <NewInterventionForm
      user={user}
      defaultClassId={classId}
      defaultStudentId={studentId}
    />
  );
}
