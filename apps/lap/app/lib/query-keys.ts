export const qk = {
  interventions: (schoolId: string) => ["interventions", schoolId] as const,
  intervention: (schoolId: string, id: string) => ["interventions", schoolId, id] as const,
  teachers: (schoolId: string) => ["teachers", schoolId] as const,
  principalDashboard: (schoolId: string) => ["dashboard", "principal", schoolId] as const,
  student360: (schoolId: string, studentId: string) =>
    ["dashboard", "student", schoolId, studentId] as const,
  class360: (schoolId: string, classId: string) =>
    ["dashboard", "class", schoolId, classId] as const,
  students: () => ["students", "roster"] as const,
  classes: () => ["classes", "directory"] as const,
  cohortsGrades: (schoolId: string) => ["cohorts", "grades", schoolId] as const,
};
