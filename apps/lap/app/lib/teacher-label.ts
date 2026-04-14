import type { TeacherOption } from "./intervention-types";

export function teacherDisplayName(t: Pick<TeacherOption, "displayName" | "givenName" | "familyName" | "email" | "id">): string {
  const n =
    t.displayName?.trim() ||
    [t.givenName, t.familyName].filter(Boolean).join(" ").trim() ||
    t.email?.trim();
  return n || t.id;
}
